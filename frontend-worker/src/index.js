import {getAssetFromKV} from '@cloudflare/kv-asset-handler'
import {BUILD_ID, BUILD_TIMESTAMP, COMMIT, COMMIT_TIMESTAMP} from "./metadata";

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to
 *    debug.
 * 2. we will return an error message on exception in your Response rather
 *    than the default 404.html page.
 */
const DEBUG = false;

/* global STORAGE, APIKEY, ADMIN_SECRET */
const BUILD_TIME = formatDateTime(new Date(BUILD_TIMESTAMP), true);
const COMMIT_DATE = formatDate(new Date(COMMIT_TIMESTAMP));
const PROJECT_ID = "487035";
const SCRAPER_NAME = "call_spider";

let lastJobFinished;
let calls;


function formatDate(d) {
  if (isNaN(d.getDate())) {
    return "unknown";
  }
  return `${d.getUTCFullYear().toString().padStart(4, "0")}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;
}

function formatTime(d, seconds) {
  if (isNaN(d.getDate())) {
    return "unknown";
  }
  let output = `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  if (seconds) {
    output += `:${d.getUTCSeconds().toString().padStart(2, "0")}`;
  }
  return output;
}

function formatDateTime(d, seconds) {
  if (isNaN(d.getDate())) {
    return "unknown";
  }
  return formatDate(d) + " " + formatTime(d, seconds);
}


function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

addEventListener('scheduled', event => {
  event.waitUntil(
    scrapeNewData()
  )
});

addEventListener('fetch', event => {
  try {

    const url = new URL(event.request.url);
    if (url.pathname === "/data.json") {
      event.respondWith(serveData())
    } else if (url.pathname === "/force-refresh" && event.request.headers.get("X-Admin-Key") === ADMIN_SECRET) {
      event.respondWith(waitForScrape());
    } else {
      event.respondWith(serveStatic(event))
    }
  } catch (e) {
    console.log(e);
    if (DEBUG) {
      return event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500,
        }),
      )
    }
    event.respondWith(new Response('500 Internal Server Error', {status: 500, headers: {"Content-type": "text/plain"}}))
  }
});

// this is some boilerplate for the worker sites I don't understand that much. Skip to serveData function and below
// region boilerplate
async function serveStatic(event) {
  let options = {};

  /**
   * You can add custom logic to how we fetch your assets
   * by configuring the function `mapRequestToAsset`
   */
  // options.mapRequestToAsset = handlePrefix(/^\/docs/)

  try {
    if (DEBUG) {
      // customize caching
      options.cacheControl = {
        bypassCache: true,
      }
    }

    const page = await getAssetFromKV(event, options);

    // allow headers to be altered
    const response = new Response(page.body, page);

    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response

  } catch (e) {
    // if an error is thrown try to serve the asset at 404.html
    if (!DEBUG) {
      try {
        let notFoundResponse = await getAssetFromKV(event, {
          mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/404.html`, req),
        });

        return new Response(notFoundResponse.body, {...notFoundResponse, status: 404})
      } catch (e) {
      }
    }

    return new Response(e.message || e.toString(), {status: 500})
  }
}

// endregion


async function serveData() {
  const newLastJobFinished = new Date(await STORAGE.get("last_job_finished"));
  if (newLastJobFinished > lastJobFinished || calls === undefined || calls === null) {
    calls = JSON.parse(await STORAGE.get("calls"));
    lastJobFinished = newLastJobFinished;
  }
  let data = JSON.stringify({
    "commit": COMMIT,
    "commit_date": COMMIT_DATE,
    "build_id": BUILD_ID,
    "build_time": BUILD_TIME,
    "last_scrape": formatDateTime(lastJobFinished),
    "calls": calls
  });
  let contentType = "application/json;charset=UTF-8";
  return new Response(data, {
    status: 200,
    headers: {
      "Content-type": contentType,
      "Access-Control-Allow-Origin": "*"
    }
  })
}


async function scrapeNewData() {
  const jobID = await startImport();
  console.log(jobID);
  const jobMeta = await waitForJobComplete(jobID);
  if (jobMeta["close_reason"] !== "finished") {
    throw Error(`Job close_reason != 'finished': ${jobID}`)
  }

  const req = await fetch(`https://storage.scrapinghub.com/items/${jobID}?apikey=${APIKEY}`,
    {headers: {"Accept": "application/json"}});
  const items = await req.json();
  lastJobFinished = new Date(jobMeta["finished_time"]);
  calls = items;
  await Promise.all([
    STORAGE.put("calls", JSON.stringify(calls)),
    STORAGE.put("last_job_finished", lastJobFinished.toJSON())
  ])
}

async function startImport() {
  console.log("Starting");
  const request = await fetch(`https://app.scrapinghub.com/api/run.json?apikey=${APIKEY}`, {
    method: "POST",
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: `project=${PROJECT_ID}&spider=${SCRAPER_NAME}&add_tag=from_worker`
  });
  const data = await request.json();
  return data["jobid"]
}

async function waitForJobComplete(jobID) {
  console.log("Polling");
  while (true) {
    await sleep(5000);
    console.log("Poll...");
    const req = await fetch(`https://storage.scrapinghub.com/jobs/${jobID}?apikey=${APIKEY}`,
      {headers: {"Accept": "application/json"}});
    const data = (await req.json())[0];
    if (data["state"] === "finished") {
      return data
    }
  }
}

async function waitForScrape() {
  await scrapeNewData();
  return new Response("Successfully scraped, redirecting to main page", {
    status: 303,
    headers: {"Location": "/", "Content-type": "text/plain"}
  })
}