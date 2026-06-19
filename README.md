# FIFA World Cup 2026 - Live Bracket Tracker

Live-updating bracket tracker for the 2026 FIFA World Cup (USA/Mexico/Canada). Shows group standings, third-place rankings, knockout bracket, and match schedule with data refreshed every 30 minutes from ESPN.

**Live:** [fifa-wc-2026.pages.dev](https://fifa-wc-2026.pages.dev)

## Features

- **12 Group Standings** with qualification indicators
- **Third-Place Rankings** - the new 48-team "best 8 of 12" rule visualized
- **Full Bracket** - R32 through Final with live team resolution
- **Match Schedule** - live scores, upcoming, and recent results
- **Auto-refresh** - data updates every 30 minutes, page polls every minute
- **Mobile-first** - responsive dark theme, works great on phones
- **Edge-cached** - Cloudflare KV + edge cache = instant loads worldwide

## Architecture

```
ESPN API → Python Scraper (every 30m) → POST → Cloudflare Worker → KV
                                                                    ↓
                                        User ← Edge Cache ← GET /api/results
```

## Development

```bash
npm install
npm run scrape   # fetch latest data
npm run dev      # start dev server at localhost:5190
```

## Deployment

1. Create Cloudflare Pages project linked to this repo
2. Create KV namespace: `wrangler kv namespace create FIFA_KV`
3. Update `wrangler.toml` with namespace ID
4. Deploy: `wrangler pages deploy dist`
5. Install LaunchAgent for scraping:
   ```bash
   cp scraper/com.csekeyan.fifa-scraper.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.csekeyan.fifa-scraper.plist
   ```

## Stack

- Frontend: Vanilla JS + Vite (no framework, <50KB total)
- Backend: Cloudflare Pages Functions + KV
- Scraper: Python 3 (stdlib only, no dependencies)
- Data: ESPN public API

## License

MIT
