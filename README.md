# [eyp-calls.tk](https://eyp-calls.tk)

A simple list of all calls that are currently up on the [Members Platform](https://members.eyp.org), allows for sorting
and filtering by event type and position. There's not much else to say, [have a look at it yourself](https://eyp-calls.tk)
yourself. The info below is mainly for developers.

## Structure

There are currently two main components – the scraper and the worker. The scraper is a scrapy project, which contains
the main spider `call_spider`. The worker contains a cron job which periodically starts the scraper and downloads the
items and the presentation frontend.

### Scraper

```shell script
cd scraper
python3 -m virtualenv env
source env/bin/activate # use appropriate script for your shell
pip install scrapy
scrapy crawl call_spider -L INFO -O calls.json
```

This spider is hosted in [ScrapingHub Scrapy Cloud](https://www.scrapinghub.com/scrapy-cloud/), which you can do too:

```shell script
# after the above script
pip install shub
shub deploy --version 1.0 # use your own version identifier
```

### Frontend

A [Cloudflare Worker](https://developers.cloudflare.com/workers/). Contains the code to start the scraper, which is
invoked on cron triggers. And the front page static assets

```shell script
npm install -g @cloudflare/wrangler
cd worker
wrangler preview --watch
```

## Developers of EYP

Contributions are welcome, hit me up via [mail](mailto:volf@eyp.cz) or [Telegram](https://t.me/mvolfik) if you have questions or ideas

### Usage as a data source

Don't want to go through the hassle of scraping yourself, but think you could deliver a better presentation? This is
possible too! Build your own app using the following data endpoints:

[JSONP](https://eyp-calls.tk/data.jsonp) – Padded JSON (see [wiki](https://en.wikipedia.org/wiki/JSONP)) – solves the
issues with cross-origin requests: the data is wrapped in a function call, so you just define the
`processCallsData(data)` callback and then load the endpoint as a normal JavaScript. The callback is called with the
data as an only argument.

[JSON](https://eyp-calls.tk/data.json) – a normal data format

I'm not a frontend dev, so I'll be happy to ditch this presentation, keep only the data source and provide a link to
your app.