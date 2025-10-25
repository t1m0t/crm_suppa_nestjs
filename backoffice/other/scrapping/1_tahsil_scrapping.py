import asyncio
import json
from crawl4ai import JsonCssExtractionStrategy, AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def main():
    district_urls = []

    with open("ressources/district_urls.json", "r") as f:
        district_urls = json.load(f)

    schema = {
        "name": "Extract Tahsil data",
        "baseSelector": "table tr:nth-child(n+2)",
        "fields": [
            {
                "name": "tahsil_name",
                "selector": "td:nth-child(2) a",
                "type": "text"
            },
            {
                "name": "tahsil_url",
                "selector": "td:nth-child(2) a",
                "type": "attribute",
                "attribute": "href"
            }
        ]
    }

    run_conf = CrawlerRunConfig(
        extraction_strategy=JsonCssExtractionStrategy(schema, verbose=True)
    )

    async with AsyncWebCrawler(verbose=True) as crawler:
        jsonRes = []
        for url in district_urls:
            result = await crawler.arun(
                url=url,
                config=run_conf
            )
            if not result.success:
                print("Crawl failed:", result.error_message)
                return

            data = json.loads(result.extracted_content)
            jsonRes.extend(data)
            await asyncio.sleep(30) 

        if jsonRes:
            with open("ressources/tahsil.json", "w") as f:
                # overwrite the file
                f.write(json.dumps(jsonRes, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
