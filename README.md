# [eyp-calls.tk](https://eyp-calls.tk)

A simple list of all calls that are currently up on the [Members Platform](https://members.eyp.org), allows for sorting
and filtering by event type and position. There's not much else to
say, [have a look at it yourself](https://eyp-calls.tk)
yourself. The info below is mainly for developers.

---

Contributions are welcome, hit me up via [mail](mailto:volf@eyp.cz) or [Telegram](https://t.me/mvolfik) if you have
questions or ideas, I'll be very happy to hear from you!

## API Endpoint

Don't want to go through the hassle of scraping yourself, but think you could deliver a better presentation? This is
possible too! Build your own app using the JSON endpoint at
[`https://eyp-calls.tk/data.json`](https://eyp-calls.tk/data.json)

I'm not a frontend dev, so I'll be happy to ditch this presentation, keep only the data source and provide a link to
your app.

## Repository structure

There are currently two main components – the scraper and the worker. The scraper is a scrapy project, which contains
the main spider `call_spider`. The worker contains a cron job which periodically starts the scraper and downloads the
items, and the presentation frontend.

### Scraper (`/scraper`)

Main source code is `scraper/scraper/spiders/call_spider.py`.

Run scraper locally (virtualenv is, of course, recommended):

```shell script
cd scraper
pip install scrapy
scrapy crawl call_spider -L INFO -O calls.json
```

Deploy to [ScrapingHub Scrapy Cloud](https://www.scrapinghub.com/scrapy-cloud/):

```shell script
cd scraper
pip install shub
shub deploy --version 1.0 # use your own version identifier
```

### Frontend (`/frontend-worker`)

A [Cloudflare Worker](https://developers.cloudflare.com/workers/). Contains the Worker code (`src/index.js`), which
starts the scraper on cron triggers, serves the data endpoint, and contains some boilerplate magic for serving static
files. These are in the `src/` directory, important is the `index.html`.

```shell script
npm install -g @cloudflare/wrangler
cd frontend-worker
wrangler preview --watch
```
