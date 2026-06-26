/**
 * FIFA WC 2026 Scraper Worker
 * Cron trigger every 15 minutes - fetches ESPN, writes to KV
 * Replaces the cloud desktop scraper.
 */

const ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";
const ESPN_SCORES = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const KV_KEY = "fifa-wc-2026-data";
const TOURNAMENT_START = "20260611";
const TOURNAMENT_END = "20260719";

const FLAGS = {
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
};

const R32_BRACKET = [
  {id:1,home:"A1",away:"C3/D3/E3"},{id:2,home:"B1",away:"A3/D3/F3"},
  {id:3,home:"C1",away:"B2"},{id:4,home:"D1",away:"A2"},
  {id:5,home:"E1",away:"B3/F3/G3"},{id:6,home:"F1",away:"E2"},
  {id:7,home:"G1",away:"H2"},{id:8,home:"H1",away:"G2"},
  {id:9,home:"I1",away:"J2"},{id:10,home:"J1",away:"I2"},
  {id:11,home:"K1",away:"L2"},{id:12,home:"L1",away:"K2"},
  {id:13,home:"C2",away:"D3/E3/F3"},{id:14,home:"D2",away:"G3/H3/I3"},
  {id:15,home:"F2",away:"H3/I3/J3"},{id:16,home:"E2",away:"J3/K3/L3"},
];

const GROUP_CITIES = {
  'A':'Mexico City/Monterrey','B':'Vancouver/Toronto','C':'Los Angeles',
  'D':'Houston/Dallas','E':'Philadelphia','F':'Miami/Atlanta',
  'G':'Seattle/San Francisco','H':'Kansas City/Dallas','I':'New York/Boston',
  'J':'Los Angeles/Atlanta','K':'Houston/Miami','L':'Toronto/Philadelphia',
};

async function fetchJSON(url) {
  const resp = await fetch(url, {
    headers: { "User-Agent": "FIFA-WC-Scraper/2.0 (Cloudflare Worker)" }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return resp.json();
}

async function fetchStandings() {
  const data = await fetchJSON(ESPN_STANDINGS);
  const groups = {};
  for (const child of data.children || []) {
    const groupLetter = child.name.replace("Group ", "");
    const entries = child.standings.entries;
    const city = GROUP_CITIES[groupLetter] || "";
    const teams = entries.map(e => {
      const name = e.team.displayName;
      const stats = {};
      for (const s of (e.stats || [])) { if (s.value !== undefined) stats[s.name] = s.value; }
      return {
        team: name, flag: FLAGS[name] || "", logo: (e.team.logos?.[0]?.href || ""),
        p: parseInt(stats.gamesPlayed || 0), w: parseInt(stats.wins || 0),
        d: parseInt(stats.ties || 0), l: parseInt(stats.losses || 0),
        gf: parseInt(stats.pointsFor || 0), ga: parseInt(stats.pointsAgainst || 0),
        gd: parseInt(stats.pointDifferential || 0), pts: parseInt(stats.points || 0),
      };
    });
    teams.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    groups[groupLetter] = { teams, city };
  }
  return groups;
}

async function fetchMatches() {
  const data = await fetchJSON(`${ESPN_SCORES}?dates=${TOURNAMENT_START}-${TOURNAMENT_END}`);
  return (data.events || []).map(event => {
    const comp = event.competitions[0];
    const status = comp.status?.type?.name || "STATUS_SCHEDULED";
    const competitors = comp.competitors;
    const home = competitors.find(c => c.homeAway === "home") || competitors[0];
    const away = competitors.find(c => c.homeAway === "away") || competitors[1] || competitors[0];
    const match = {
      id: event.id, date: event.date,
      home: { team: home.team.displayName, flag: FLAGS[home.team.displayName] || "", score: home.score || "" },
      away: { team: away.team.displayName, flag: FLAGS[away.team.displayName] || "", score: away.score || "" },
      status, group: "", venue: event.venue?.fullName || "", round: "r32",
    };
    if (status === "STATUS_FULL_TIME") {
      match.home.winner = home.winner || false;
      match.away.winner = away.winner || false;
    }
    return match;
  });
}

function buildPayload(groups, matches) {
  const teamToGroup = {};
  for (const [g, group] of Object.entries(groups)) {
    for (const t of group.teams) teamToGroup[t.team] = g;
  }
  for (const m of matches) {
    const hg = teamToGroup[m.home.team] || "";
    const ag = teamToGroup[m.away.team] || "";
    if (hg && hg === ag) m.group = hg;
  }
  for (const m of matches) {
    if (m.group) { m.round = "group"; continue; }
    const combined = m.home.team + " " + m.away.team;
    if (combined.includes("Semifinal") || combined.includes("Semi-final")) m.round = "sf";
    else if (combined.includes("Round of 16")) m.round = "r16";
    else if (combined.includes("Quarter")) m.round = "qf";
    else if (combined.includes("Final") && !combined.includes("Semi")) m.round = "final";
    else m.round = "r32";
  }

  const played = matches.filter(m => m.status === "STATUS_FULL_TIME").length;
  const goals = matches.filter(m => m.status === "STATUS_FULL_TIME")
    .reduce((sum, m) => sum + parseInt(m.home.score || 0) + parseInt(m.away.score || 0), 0);
  const maxPlayed = Math.max(...Object.values(groups).flatMap(g => g.teams.map(t => t.p)));
  const phase = maxPlayed < 3 ? `Group Stage \u00b7 Matchday ${maxPlayed + 1} of 3` : "Knockout Stage";

  return {
    groups, matches, bracket: R32_BRACKET, flags: FLAGS,
    info: {
      startDate: "2026-06-11", endDate: "2026-07-19", totalTeams: 48,
      totalMatches: 104, hostCountries: "USA, Mexico, Canada",
      matchesPlayed: played, matchesInProgress: 0, goalsScored: goals, phase,
    },
    updatedAt: new Date().toISOString(),
  };
}

export default {
  async scheduled(event, env, ctx) {
    try {
      const [groups, matches] = await Promise.all([fetchStandings(), fetchMatches()]);
      const payload = buildPayload(groups, matches);
      await env.FIFA_KV.put(KV_KEY, JSON.stringify(payload));
      console.log(`Scrape OK: ${payload.info.matchesPlayed} played, ${payload.info.goalsScored} goals`);
    } catch (e) {
      console.error("Scrape failed:", e.message);
    }
  },

  async fetch(request, env) {
    // Manual trigger via GET /run
    if (new URL(request.url).pathname === "/run") {
      try {
        const [groups, matches] = await Promise.all([fetchStandings(), fetchMatches()]);
        const payload = buildPayload(groups, matches);
        await env.FIFA_KV.put(KV_KEY, JSON.stringify(payload));
        return new Response(`OK: ${payload.info.matchesPlayed} played, ${payload.info.goalsScored} goals`, { status: 200 });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }
    return new Response("FIFA WC 2026 Scraper Worker. Use /run to trigger manually.", { status: 200 });
  }
};
