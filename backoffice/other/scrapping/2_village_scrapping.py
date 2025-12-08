import asyncio
import json
import os
from crawl4ai import JsonCssExtractionStrategy, AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def main():
    BASE_URL = os.getenv('SCRAPPING_BASE_URL')
    if not BASE_URL:
        raise ValueError("SCRAPPING_BASE_URL environment variable is not set.")

    tahsils = []

    with open("ressources/tahsil.json", "r") as f:
        jsonRes = json.load(f)
        for item in jsonRes:
            tahsils.append({
                "url":  BASE_URL + item["tahsil_url"],
                "tahsil_name": item["tahsil_name"],
            })

    schema = {
        "name": "Extract Village data",
        "baseSelector": "table tr:nth-child(n+2)",
        "fields": [
            {
                "name": "village_name",
                "selector": "td:nth-child(2) a",
                "type": "text"
            },
            {
                "name": "village_url",
                "selector": "td:nth-child(2) a",
                "type": "attribute",
                "attribute": "href"
            },
            {
                "name": "village_code",
                "selector": "td:nth-child(3)",
                "type": "text"
            }
        ]
    }

    browser_conf = BrowserConfig(headless=True)  # or False to see the browser
    run_conf = CrawlerRunConfig(
        extraction_strategy=JsonCssExtractionStrategy(schema, verbose=True)
    )

    async with AsyncWebCrawler(verbose=True) as crawler:
        jsonRes = []
        for tahsil in tahsils:
            result = await crawler.arun(
                url=tahsil["url"],
                config=run_conf
            )
            if not result.success:
                print("Crawl failed:", result.error_message)
                return

            data = json.loads(result.extracted_content)
            # Add tahsil to each village item
            for item in data:
                item['tahsil_name'] = tahsil['tahsil_name']
                
            print(f"Extracted {len(data)} villages from {tahsil['url']}")
            print(json.dumps(data, indent=2))
            jsonRes.extend(data)
            await asyncio.sleep(30)

        if jsonRes:
            with open("ressources/villages.json", "a") as f:
                f.write(json.dumps(jsonRes, indent=2))
        else:
            print("No data extracted.")

if __name__ == "__main__":
    asyncio.run(main())
