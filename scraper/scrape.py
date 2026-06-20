#!/usr/bin/env python3
"""
FIFA World Cup 2026 Scraper
Fetches live data from ESPN API every 30 minutes and POSTs to Cloudflare Worker.
Same architecture as TN Elections dashboard.
"""

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

# Config
ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings"
ESPN_SCORES = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
WORKER_URL = os.environ.get("WORKER_URL", "https://fifa-wc-2026.pages.dev/api/results")
API_KEY = os.environ.get("API_KEY", "fifa-wc-2026-scraper-key")
TOURNAMENT_START = "2026-06-11"
TOURNAMENT_END = "2026-07-19"

# Group cities
GROUP_CITIES = {
    "Group A": "Mexico City / Monterrey",
    "Group B": "Vancouver / Toronto",
    "Group C": "Los Angeles",
    "Group D": "Houston / Dallas",
    "Group E": "Philadelphia",
    "Group F": "Miami / Atlanta",
    "Group G": "New York/NJ",
    "Group H": "Kansas City",
    "Group I": "Seattle / San Francisco",
    "Group J": "Miami",
    "Group K": "Dallas",
    "Group L": "Boston / New York",
}

# Flags
FLAGS = {
    'Mexico':'🇲🇽','South Korea':'🇰🇷','Czechia':'🇨🇿','Czech Republic':'🇨🇿','South Africa':'🇿🇦',
    'Canada':'🇨🇦','Switzerland':'🇨🇭','Bosnia-Herzegovina':'🇧🇦','Bosnia And Herzegovina':'🇧🇦','Qatar':'🇶🇦',
    'Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Morocco':'🇲🇦','Brazil':'🇧🇷','Haiti':'🇭🇹',
    'United States':'🇺🇸','Australia':'🇦🇺','Türkiye':'🇹🇷','Turkey':'🇹🇷','Paraguay':'🇵🇾',
    'Germany':'🇩🇪','Ivory Coast':'🇨🇮',"Côte d'Ivoire":'🇨🇮','Ecuador':'🇪🇨','Curaçao':'🇨🇼','Curacao':'🇨🇼',
    'Sweden':'🇸🇪','Japan':'🇯🇵','Netherlands':'🇳🇱','Tunisia':'🇹🇳',
    'New Zealand':'🇳🇿','Iran':'🇮🇷','Belgium':'🇧🇪','Egypt':'🇪🇬',
    'Uruguay':'🇺🇾','Saudi Arabia':'🇸🇦','Spain':'🇪🇸','Cape Verde':'🇨🇻',
    'Norway':'🇳🇴','France':'🇫🇷','Senegal':'🇸🇳','Iraq':'🇮🇶',
    'Argentina':'🇦🇷','Austria':'🇦🇹','Jordan':'🇯🇴','Algeria':'🇩🇿',
    'Colombia':'🇨🇴','Congo DR':'🇨🇩','DR Congo':'🇨🇩','Portugal':'🇵🇹','Uzbekistan':'🇺🇿',
    'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Ghana':'🇬🇭','Panama':'🇵🇦','Croatia':'🇭🇷',
}

# R32 bracket mapping (FIFA official)
R32_BRACKET = [
    {"id": 1, "home": "A1", "away": "C3/D3/E3", "label": "Match 49"},
    {"id": 2, "home": "B1", "away": "A3/D3/F3", "label": "Match 50"},
    {"id": 3, "home": "C1", "away": "B2", "label": "Match 51"},
    {"id": 4, "home": "D1", "away": "A2", "label": "Match 52"},
    {"id": 5, "home": "E1", "away": "B3/F3/G3", "label": "Match 53"},
    {"id": 6, "home": "F1", "away": "E2", "label": "Match 54"},
    {"id": 7, "home": "G1", "away": "H2", "label": "Match 55"},
    {"id": 8, "home": "H1", "away": "G2", "label": "Match 56"},
    {"id": 9, "home": "I1", "away": "J2", "label": "Match 57"},
    {"id": 10, "home": "J1", "away": "I2", "label": "Match 58"},
    {"id": 11, "home": "K1", "away": "L2", "label": "Match 59"},
    {"id": 12, "home": "L1", "away": "K2", "label": "Match 60"},
    {"id": 13, "home": "C2", "away": "D3/E3/F3", "label": "Match 61"},
    {"id": 14, "home": "D2", "away": "G3/H3/I3", "label": "Match 62"},
    {"id": 15, "home": "F2", "away": "H3/I3/J3", "label": "Match 63"},
    {"id": 16, "home": "E2", "away": "J3/K3/L3", "label": "Match 64"},
]


def fetch_json(url):
    """Fetch JSON from URL with retry."""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (FIFA-WC-Scraper/1.0)"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt == 2:
                raise
            print(f"  Retry {attempt+1}: {e}")
            time.sleep(2)


def fetch_standings():
    """Fetch group standings from ESPN API."""
    data = fetch_json(ESPN_STANDINGS)
    groups = {}
    
    for child in data["children"]:
        group_letter = child["name"].replace("Group ", "")
        entries = child["standings"]["entries"]
        city = GROUP_CITIES.get(child["name"], "")
        
        teams = []
        for e in entries:
            team_name = e["team"]["displayName"]
            logo = e["team"].get("logos", [{}])[0].get("href", "") if e["team"].get("logos") else ""
            stats = {s["name"]: s["value"] for s in e.get("stats", []) if "value" in s}
            
            teams.append({
                "team": team_name,
                "flag": FLAGS.get(team_name, ""),
                "logo": logo,
                "p": int(stats.get("gamesPlayed", 0)),
                "w": int(stats.get("wins", 0)),
                "d": int(stats.get("ties", 0)),
                "l": int(stats.get("losses", 0)),
                "gf": int(stats.get("pointsFor", 0)),
                "ga": int(stats.get("pointsAgainst", 0)),
                "gd": int(stats.get("pointDifferential", 0)),
                "pts": int(stats.get("points", 0)),
            })
        
        # Sort by Pts desc, GD desc, GF desc (FIFA standard)
        teams.sort(key=lambda t: (-t["pts"], -t["gd"], -t["gf"]))
        groups[group_letter] = {"teams": teams, "city": city}
    
    return groups


def fetch_matches():
    """Fetch all match results and schedule from ESPN API."""
    data = fetch_json(f"{ESPN_SCORES}?dates={TOURNAMENT_START.replace('-','')}-{TOURNAMENT_END.replace('-','')}")
    
    matches = []
    for event in data.get("events", []):
        comp = event["competitions"][0]
        status_obj = comp.get("status", {}).get("type", {})
        status = status_obj.get("name", "STATUS_SCHEDULED")
        
        competitors = comp["competitors"]
        home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
        away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1] if len(competitors) > 1 else competitors[0])
        
        # Get group info from notes
        group = ""
        for note in comp.get("notes", []):
            if "Group" in note.get("headline", ""):
                group = note["headline"].replace("Group ", "")
                break
        
        match = {
            "id": event["id"],
            "date": event["date"],
            "home": {
                "team": home["team"]["displayName"],
                "flag": FLAGS.get(home["team"]["displayName"], ""),
                "score": home.get("score", ""),
            },
            "away": {
                "team": away["team"]["displayName"],
                "flag": FLAGS.get(away["team"]["displayName"], ""),
                "score": away.get("score", ""),
            },
            "status": status,
            "group": group,
            "venue": event.get("venue", {}).get("fullName", ""),
        }
        
        # Add winner info for completed matches
        if status == "STATUS_FULL_TIME":
            match["home"]["winner"] = home.get("winner", False)
            match["away"]["winner"] = away.get("winner", False)
        
        matches.append(match)
    
    return matches


def compute_tournament_info(groups, matches):
    """Compute summary stats."""
    played = sum(1 for m in matches if m["status"] == "STATUS_FULL_TIME")
    goals = sum(
        int(m["home"]["score"] or 0) + int(m["away"]["score"] or 0)
        for m in matches if m["status"] == "STATUS_FULL_TIME"
    )
    in_progress = sum(1 for m in matches if m["status"] in ("STATUS_IN_PROGRESS", "STATUS_FIRST_HALF", "STATUS_SECOND_HALF", "STATUS_HALFTIME"))
    
    # Determine phase
    max_played = max(t["p"] for g in groups.values() for t in g["teams"])
    if max_played < 3:
        phase = f"Group Stage · Matchday {max_played + 1} of 3"
    else:
        phase = "Knockout Stage"
    
    return {
        "startDate": TOURNAMENT_START,
        "endDate": TOURNAMENT_END,
        "totalTeams": 48,
        "totalMatches": 104,
        "hostCountries": "USA, Mexico, Canada",
        "matchesPlayed": played,
        "matchesInProgress": in_progress,
        "goalsScored": goals,
        "phase": phase,
    }


def build_payload(groups, matches, info):
    """Build the full payload for the Worker."""
    # Infer group for matches that lack it (ESPN does not always provide it)
    team_to_group = {}
    for g, group in groups.items():
        for t in group["teams"]:
            team_to_group[t["team"]] = g
    
    for match in matches:
        if not match.get("group"):
            home_g = team_to_group.get(match["home"]["team"], "")
            away_g = team_to_group.get(match["away"]["team"], "")
            if home_g and home_g == away_g:
                match["group"] = home_g
    
    return {
        "groups": groups,
        "matches": matches,
        "bracket": R32_BRACKET,
        "info": info,
        "flags": FLAGS,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def post_to_worker(payload):
    """POST payload to Cloudflare Worker."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        WORKER_URL,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = resp.read().decode()
            print(f"  POST OK ({resp.status}): {result[:100]}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  POST FAILED ({e.code}): {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"  POST ERROR: {e}")
        return False


def save_local(payload):
    """Save payload locally as fallback."""
    out_path = os.path.join(os.path.dirname(__file__), "latest.json")
    with open(out_path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"  Saved locally: {out_path} ({os.path.getsize(out_path)//1024}KB)")


def run_once():
    """Single scrape cycle."""
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Fetching ESPN data...")
    
    groups = fetch_standings()
    print(f"  Standings: {len(groups)} groups")
    
    matches = fetch_matches()
    print(f"  Matches: {len(matches)} total")
    
    info = compute_tournament_info(groups, matches)
    print(f"  Stats: {info['matchesPlayed']} played, {info['goalsScored']} goals, {info['phase']}")
    
    payload = build_payload(groups, matches, info)
    save_local(payload)
    
    # POST to worker (skip if no URL configured)
    if "pages.dev" in WORKER_URL or "workers.dev" in WORKER_URL:
        post_to_worker(payload)
    else:
        print("  Skipping POST (no worker URL configured)")
    
    return payload


def main():
    """Main loop - runs every 30 minutes."""
    interval = int(os.environ.get("INTERVAL", "1800"))  # 30 min default
    
    if "--once" in sys.argv:
        run_once()
        return
    
    print(f"FIFA WC 2026 Scraper starting (interval: {interval}s)")
    while True:
        try:
            run_once()
        except Exception as e:
            print(f"  ERROR: {e}")
        
        print(f"  Next run in {interval//60} minutes...")
        time.sleep(interval)


if __name__ == "__main__":
    main()
