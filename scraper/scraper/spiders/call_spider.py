import scrapy
from datetime import datetime, timezone, timedelta

deadlineshift = timedelta(hours=23, minutes=59)

class CallSpider(scrapy.Spider):
    name = "call_spider"
    allowed_domains = ["members.eyp.org"]
    start_urls = [
        "https://members.eyp.org/events?event_date=1&field_associated_nc_value=All&field_event_type_tid=All&page=0"
    ]

    def parse(self, response):
        next = response.css(".pager-next > a::attr(href)").get()
        if next:
            yield scrapy.Request(response.urljoin(next), callback=self.parse)
        for event_url in response.css(
            ".view-events-list > .views-row  h2 a::attr(href)"
        ).getall():
            yield scrapy.Request(
                response.urljoin(event_url), callback=self.parse_event_page
            )

    def parse_event_page(self, response):
        data = {
            "name": response.css("#page-title::text").get().strip(),
            "url": response.url,
            "event_type": " ".join(
                response.css(
                    ".field-name-field-event-type .field-items ::text"
                ).getall()
            ),
            "host_nc": " ".join(
                response.css(".field-name-field-event-nc .field-items ::text").getall()
            ),
            "event_city": " ".join(
                response.css(
                    ".field-name-field-event-location-city .field-items ::text"
                ).getall()
            ),
            "event_country": " ".join(
                response.css(
                    ".field-name-field-event-location-country .field-items ::text"
                ).getall()
            ),
        }

        date_single = response.css(
            ".field-name-field-event-date .date-display-single::attr(content)"
        ).get()
        if date_single is not None:
            data["event_start"] = data["event_end"] = (
                datetime.fromisoformat(date_single).date().isoformat()
            )
        else:
            data["event_start"] = (
                datetime.fromisoformat(
                    response.css(
                        ".field-name-field-event-date .date-display-start::attr(content)"
                    ).get()
                )
                .date()
                .isoformat()
            )
            data["event_end"] = (
                datetime.fromisoformat(
                    response.css(
                        ".field-name-field-event-date .date-display-end::attr(content)"
                    ).get()
                )
                .date()
                .isoformat()
            )

        for app in response.css(".applic-times .applic-time"):
            try:
                position = app.css(".label::text").get()
                if "general" in app.attrib["class"]:
                    start = (
                        datetime.fromisoformat(
                            response.css(
                                ".field-name-field-event-general-deadline .date-display-start::attr(content)"
                            ).get()
                        ).replace(tzinfo=timezone.utc)
                        + deadlineshift
                    )
                    end = (
                        datetime.fromisoformat(
                            response.css(
                                ".field-name-field-event-general-deadline .date-display-end::attr(content)"
                            ).get()
                        ).replace(tzinfo=timezone.utc)
                        + deadlineshift
                    )
                else:
                    t = app.xpath("text()").get().split(" - ")
                    start = (
                        datetime.strptime(t[0] + t[1], "%d/%m/%Y%H:%M").replace(
                            tzinfo=timezone.utc
                        )
                        + deadlineshift
                    )
                    end = (
                        datetime.strptime(t[2] + t[3], "%d/%m/%Y%H:%M").replace(
                            tzinfo=timezone.utc
                        )
                        + deadlineshift
                    )
                if end > datetime.now(timezone.utc):
                    yield {
                        **data,
                        "position": position,
                        "application_start": start.replace(tzinfo=None).isoformat(
                            " ", "minutes"
                        ),
                        "application_end": end.replace(tzinfo=None).isoformat(
                            " ", "minutes"
                        ),
                    }
            except Exception as e:
                self.logger.error(
                    f"Error when parsing application deadlines info on {response.url}: {app.get()}"
                )
                self.logger.exception(e)
