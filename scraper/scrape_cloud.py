#!/usr/bin/env python3
"""
FIFA World Cup 2026 Scraper - Cloud Desktop Edition
Runs on cloud desktop via cron every 15 minutes.
Uses Cloudflare KV API directly (bypasses Pages Function bot protection).
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone

# ESPN endpoints
ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings"
ESPN_SCORES = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
TOURNAMENT_START = "2026-06-11"
TOURNAMENT_END = "2026-07-19"

# Cloudflare config
CF_ACCOUNT_ID = "b6a703eceaeda78c83f3d2ec15e51c09"
CF_NAMESPACE_ID = "fce7bde466cb4ae7863ba9abd620ccee"
CF_KV_KEY = "fifa-wc-2026-data"
CF_CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7"
CF_REFRESH_TOKEN = os.environ.get("CF_REFRESH_TOKEN", "")

# Group cities
GROUP_CITIES = {
    "Group A": "Mexico City / Monterrey", "Group B": "Vancouver / Toronto",
    "Group C": "Los Angeles", "Group D": "Houston / Dallas",
    "Group E": "Philadelphia", "Group F": "Miami / Atlanta",
    "Group G": "New York/NJ", "Group H": "Kansas City",
    "Group I": "Seattle / San Francisco", "Group J": "Miami",
    "Group K": "Dallas", "Group L": "Boston / New York",
}

FLAGS = {
    'Mexico':'🇲🇽','South Korea':'🇰🇷','Czechia':'🇨🇿','Czech Republic':'🇨🇿','South Africa':'🇿🇦',
    'Canada':'🇨🇦','Switzerland':'🇨🇭','Bosnia-Herzegovina':'🇧🇦','Bosnia And Herzegovina':'🇧🇦','Qatar':'🇶🇦',
    'Scotland':'🏴\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074\U000e007f','Morocco':'🇲🇦','Brazil':'🇧🇷','Haiti':'🇭🇹',
    'United States':'🇺🇸','Australia':'🇦🇺','Türkiye':'🇹🇷','Turkey':'🇹🇷','Paraguay':'🇵🇾',
    'Germany':'🇩🇪','Ivory Coast':'🇨🇮',"Côte d'Ivoire":'🇨🇮','Ecuador':'🇪🇨','Curaçao':'🇨🇼','Curacao':'🇨🇼',
    'Sweden':'🇸🇪','Japan':'🇯🇵','Netherlands':'🇳🇱','Tunisia':'🇹🇳',
    'New Zealand':'🇳🇿','Iran':'🇮🇷','Belgium':'🇧🇪','Egypt':'🇪🇬',
    'Uruguay':'🇺🇾','Saudi Arabia':'🇸🇦','Spain':'🇪🇸','Cape Verde':'🇨🇻',
    'Norway':'🇳🇴','France':'🇫🇷','Senegal':'🇸🇳','Iraq':'🇮🇶',
    'Argentina':'🇦🇷','Austria':'🇦🇹','Jordan':'🇯🇴','Algeria':'🇩🇿',
    'Colombia':'🇨🇴','Congo DR':'🇨🇩','DR Congo':'🇨🇩','Portugal':'🇵🇹','Uzbekistan':'🇺🇿',
    'England':'🏴\U000e0067\U000e0062\U000e0065\U000e006e\U000e0067\U000e007f','Ghana':'🇬🇭','Panama':'🇵🇦','Croatia':'🇭🇷',
}

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
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (FIFA-WC-Scraper/1.0)"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2)


def get_cf_token():
    """Exchange refresh token for a fresh access token."""
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": CF_REFRESH_TOKEN,
        "client_id": CF_CLIENT_ID,
    }).encode()
    req = urllib.request.Request("https://dash.cloudflare.com/oauth2/token", data=data,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
    return result["access_token"]


def write_to_kv(payload):
    """Write directly to Cloudflare KV API."""
    token = get_cf_token()
    url = "https://api.cloudflare.com/client/v4/accounts/{}/storage/kv/namespaces/{}/values/{}".format(
        CF_ACCOUNT_ID, CF_NAMESPACE_ID, CF_KV_KEY)
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PUT",
                                 headers={"Authorization": "Bearer " + token,
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
    return result.get("success", False)


def fetch_standings():
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
                "team": team_name, "flag": FLAGS.get(team_name, ""), "logo": logo,
                "p": int(stats.get("gamesPlayed", 0)), "w": int(stats.get("wins", 0)),
                "d": int(stats.get("ties", 0)), "l": int(stats.get("losses", 0)),
                "gf": int(stats.get("pointsFor", 0)), "ga": int(stats.get("pointsAgainst", 0)),
                "gd": int(stats.get("pointDifferential", 0)), "pts": int(stats.get("points", 0)),
            })
        teams.sort(key=lambda t: (-t["pts"], -t["gd"], -t["gf"]))
        groups[group_letter] = {"teams": teams, "city": city}
    return groups


def fetch_matches():
    data = fetch_json("{0}?dates={1}-{2}".format(
        ESPN_SCORES, TOURNAMENT_START.replace('-',''), TOURNAMENT_END.replace('-','')))
    matches = []
    for event in data.get("events", []):
        comp = event["competitions"][0]
        status = comp.get("status", {}).get("type", {}).get("name", "STATUS_SCHEDULED")
        competitors = comp["competitors"]
        home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
        away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1] if len(competitors) > 1 else competitors[0])
        match = {
            "id": event["id"], "date": event["date"],
            "home": {"team": home["team"]["displayName"], "flag": FLAGS.get(home["team"]["displayName"], ""), "score": home.get("score", "")},
            "away": {"team": away["team"]["displayName"], "flag": FLAGS.get(away["team"]["displayName"], ""), "score": away.get("score", "")},
            "status": status, "group": "", "venue": event.get("venue", {}).get("fullName", ""),
        }
        if status == "STATUS_FULL_TIME":
            match["home"]["winner"] = home.get("winner", False)
            match["away"]["winner"] = away.get("winner", False)
        matches.append(match)
    return matches


def build_payload(groups, matches):
    # Infer groups
    team_to_group = {}
    for g, group in groups.items():
        for t in group["teams"]:
            team_to_group[t["team"]] = g
    for match in matches:
        home_g = team_to_group.get(match["home"]["team"], "")
        away_g = team_to_group.get(match["away"]["team"], "")
        if home_g and home_g == away_g:
            match["group"] = home_g

    # Tag rounds
    for match in matches:
        if match.get("group"):
            match["round"] = "group"
            continue
        combined = match["home"]["team"] + " " + match["away"]["team"]
        if "Semifinal" in combined or "Semi-final" in combined:
            match["round"] = "sf"
        elif "Round of 16" in combined:
            match["round"] = "qf"
        elif "Round of 32" in combined:
            match["round"] = "r16"
        elif "Final" in combined and "Semi" not in combined:
            match["round"] = "final"
        else:
            match["round"] = "r32"

    # Stats
    played = sum(1 for m in matches if m["status"] == "STATUS_FULL_TIME")
    goals = sum(int(m["home"]["score"] or 0) + int(m["away"]["score"] or 0)
                for m in matches if m["status"] == "STATUS_FULL_TIME")
    max_played = max(t["p"] for g in groups.values() for t in g["teams"])
    phase = "Group Stage \u00b7 Matchday {} of 3".format(max_played + 1) if max_played < 3 else "Knockout Stage"

    return {
        "groups": groups, "matches": matches, "bracket": R32_BRACKET, "flags": FLAGS,
        "info": {"startDate": TOURNAMENT_START, "endDate": TOURNAMENT_END, "totalTeams": 48,
                 "totalMatches": 104, "hostCountries": "USA, Mexico, Canada",
                 "matchesPlayed": played, "matchesInProgress": 0, "goalsScored": goals, "phase": phase},
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def run():
    print("[{}] Scraping ESPN...".format(datetime.now().strftime('%H:%M:%S')))
    groups = fetch_standings()
    print("  {} groups".format(len(groups)))
    matches = fetch_matches()
    print("  {} matches".format(len(matches)))
    payload = build_payload(groups, matches)
    print("  {} played, {} goals".format(payload["info"]["matchesPlayed"], payload["info"]["goalsScored"]))

    # Save locally
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "latest.json")
    with open(out, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    print("  Saved: {} ({}KB)".format(out, os.path.getsize(out) // 1024))

    # Write to Cloudflare KV
    if CF_REFRESH_TOKEN:
        ok = write_to_kv(payload)
        print("  KV write: {}".format("OK" if ok else "FAILED"))
    else:
        print("  Skipping KV (no CF_REFRESH_TOKEN)")


if __name__ == "__main__":
    run()
