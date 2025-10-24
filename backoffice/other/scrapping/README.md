# venv setup

1. in scrapping dir `python3 -m venv venv`
2. install scrawl4ai `./venv/bin/pip install crawl4ai`
3. install playwright `./venv/bin/playwright install` 
4. install playwright dependencies `sudo venv/bin/playwright install-deps`

# Scrapping
1. Gather array of district urls (json format) in file `district_urls.json`
2. Run `1_tahsil_scrapping.py`
3. Run `2_village_scrapping.py`