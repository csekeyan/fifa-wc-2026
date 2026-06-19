# FIFA World Cup 2026 - Live Bracket Tracker

## Architecture (same as TN Elections)
```
[My Laptop] → Python scraper (every 30 min) → POST → [Cloudflare Worker]
                                                            ↓
                                                      [Workers KV]
                                                            ↓
                                                   [Edge Cache (5 min)]
                                                            ↓
                                                    [Users worldwide]
```

## Data Sources
- ESPN standings: https://www.espn.com/soccer/table/_/league/FIFA.WORLD
- Wikipedia group pages: match details, scorers
- FIFA API v3: match events (need correct 2026 season ID)

## Pages
1. Groups overview (12 groups, live standings)
2. Third-place ranking table (which 8 advance)
3. Full knockout bracket (R32 → R16 → QF → SF → Final)
4. Team path view ("Show me Argentina's path to the final")

## Stack
- Vite + Vanilla JS + Chart.js
- Cloudflare Pages + Workers + KV
- Python scraper (local laptop)
- Same dark theme as TN Elections

## Deploy
- Cloudflare Pages: fifa-wc-2026.pages.dev
- GitHub: csekeyan/fifa-wc-2026
- Git email: 20188684+csekeyan@users.noreply.github.com
