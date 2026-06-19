#!/bin/bash
# Run scraper and copy output to public dir for dev + deploy
cd "$(dirname "$0")/.."
python3 scraper/scrape.py --once
cp scraper/latest.json public/scraper/latest.json 2>/dev/null
echo "Copied to public/scraper/latest.json"
