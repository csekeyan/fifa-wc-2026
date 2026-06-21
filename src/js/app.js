import { subscribe, startPolling, getData, R32_BRACKET } from './data.js';
import { startLivePolling, renderLiveScoreboard } from './livescore.js';
import { 
  setPrediction, getPrediction, clearAllPredictions, getPredictionCount,
  setUpdateCallback, simulateStandings, getSimulatedThirds, getSimulatedBracket 
} from './simulator.js';
import { attachTeamClickHandlers, openMatchModal } from './modals.js';

// --- Init ---
function init() {
  initTabs();
  startPolling();
  subscribe(render);
  setUpdateCallback(() => {
    const data = getData();
    if (data) renderSimulator(data);
  });
  // Live scoreboard polls ESPN directly every 30s
  startLivePolling((liveData) => {
    const container = document.getElementById('tab-live');
    renderLiveScoreboard(container, liveData);
    // Highlight tab if live matches exist
    const liveBtn = document.querySelector('.tab-btn[data-tab="live"]');
    const hasLive = liveData?.events?.some(e => 
      ['STATUS_IN_PROGRESS','STATUS_FIRST_HALF','STATUS_SECOND_HALF','STATUS_HALFTIME'].includes(e.competitions[0].status.type.name)
    );
    if (liveBtn) liveBtn.classList.toggle('has-live', hasLive);
  });
}

function render(data) {
  renderSummary(data);
  renderGroups(data);
  renderThirdPlace(data);
  renderBracket(data);
  renderSchedule(data);
  renderSimulator(data);
  updateMeta(data);
  // Make all team names clickable for detail popup
  attachTeamClickHandlers(document.querySelector('main'));
}

function updateMeta(data) {
  document.getElementById('lastUpdated').textContent = 
    `Updated: ${new Date(data.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  document.getElementById('tournamentStatus').textContent = data.info.phase;
}

function renderSummary(data) {
  const el = document.getElementById('summaryBar');
  const info = data.info;
  const gpg = info.matchesPlayed > 0 ? (info.goalsScored / info.matchesPlayed).toFixed(1) : '0.0';
  el.innerHTML = `
    <div class="stat-item"><div class="num">${info.totalTeams}</div><div class="lbl">Teams</div></div>
    <div class="stat-item"><div class="num">${info.matchesPlayed}</div><div class="lbl">Played</div></div>
    <div class="stat-item"><div class="num">${info.goalsScored}</div><div class="lbl">Goals</div></div>
    <div class="stat-item"><div class="num">${gpg}</div><div class="lbl">Per Match</div></div>
    <div class="stat-item"><div class="num">${info.totalMatches - info.matchesPlayed}</div><div class="lbl">Remaining</div></div>
  `;
}

// --- Groups ---
function renderGroups(data) {
  const container = document.getElementById('tab-groups');
  const { groups } = data;
  
  let html = '<div class="groups-grid">';
  Object.keys(groups).sort().forEach(g => {
    const group = groups[g];
    const standings = group.teams;
    html += `<div class="group-card"><h3>Group ${g} <span style="font-weight:400;color:var(--text-muted);font-size:0.65rem;text-transform:none">\u00b7 ${group.city}</span></h3>`;
    html += `<table class="standings-table"><thead><tr><th class="pos">#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th class="pts">Pts</th></tr></thead><tbody>`;
    standings.forEach((t, i) => {
      const cls = i < 2 ? 'qual-top2' : (i === 2 ? 'qual-3rd' : 'elim');
      const gd = t.gd > 0 ? `+${t.gd}` : t.gd;
      html += `<tr class="${cls}"><td class="pos">${i+1}</td><td class="team-name">${t.flag || ''} ${t.team}</td><td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${gd}</td><td class="pts">${t.pts}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  html += '</div>';
  html += `<div style="margin-top:12px;text-align:center;font-size:0.7rem;color:var(--text-muted)">
    <span style="display:inline-block;width:10px;height:10px;background:rgba(52,211,153,0.15);border-radius:2px;margin-right:4px"></span> Top 2 advance
    <span style="margin-left:12px;display:inline-block;width:10px;height:10px;background:rgba(245,158,11,0.15);border-radius:2px;margin-right:4px"></span> 3rd: best 8 of 12 advance
  </div>`;
  container.innerHTML = html;
}

// --- Third Place ---
function renderThirdPlace(data) {
  const container = document.getElementById('tab-third');
  const { groups } = data;
  
  const thirds = Object.keys(groups).sort().map(g => ({ ...groups[g].teams[2], group: g }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  let html = `<div class="third-section">
    <h3>Best Third-Placed Teams</h3>
    <p class="info">Top 8 of 12 third-placed teams advance to the Round of 32. This is the new rule for the expanded 48-team format.</p>
    <table class="third-table"><thead><tr><th>#</th><th>Grp</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Status</th></tr></thead><tbody>`;
  thirds.forEach((t, i) => {
    const status = i < 8 ? '<span class="badge-advance">Advances</span>' : '<span class="badge-elim">Eliminated</span>';
    const gd = t.gd > 0 ? `+${t.gd}` : t.gd;
    html += `<tr class="${i < 8 ? 'qual-3rd' : 'elim'}"><td>${i+1}</td><td style="color:var(--accent)">${t.group}</td><td>${t.flag || ''} ${t.team}</td><td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${gd}</td><td style="font-weight:700;color:var(--accent)">${t.pts}</td><td>${status}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// --- Bracket ---
function renderBracket(data) {
  const container = document.getElementById('tab-bracket');
  const { groups, matches } = data;
  
  // Get knockout matches by round
  const r32 = (matches || []).filter(m => m.round === 'r32').sort((a,b) => new Date(a.date) - new Date(b.date));
  const r16 = (matches || []).filter(m => m.round === 'r16').sort((a,b) => new Date(a.date) - new Date(b.date));
  const qf = (matches || []).filter(m => m.round === 'qf').sort((a,b) => new Date(a.date) - new Date(b.date));
  const sf = (matches || []).filter(m => m.round === 'sf').sort((a,b) => new Date(a.date) - new Date(b.date));
  const final = (matches || []).filter(m => m.round === 'final').sort((a,b) => new Date(a.date) - new Date(b.date));
  
  let html = '<div class="bracket-full">';
  
  // Stage navigation
  html += '<div class="stage-nav">';
  const stages = [
    { id: 'r32', label: 'Round of 32', count: r32.length, matches: r32 },
    { id: 'r16', label: 'Round of 16', count: r16.length, matches: r16 },
    { id: 'qf', label: 'Quarter-Finals', count: qf.length, matches: qf },
    { id: 'sf', label: 'Semi-Finals', count: sf.length, matches: sf },
    { id: 'final', label: 'Final', count: final.length, matches: final },
  ];
  stages.forEach((s, i) => {
    const played = s.matches.filter(m => m.status === 'STATUS_FULL_TIME').length;
    const active = i === 0 ? 'active' : '';
    const disabled = s.count === 0 ? 'disabled' : '';
    html += `<button class="stage-btn ${active} ${disabled}" data-stage="${s.id}">${s.label}<span class="stage-count">${played}/${s.count}</span></button>`;
  });
  html += '</div>';
  
  // Stage content panels
  stages.forEach((s, i) => {
    const activeClass = i === 0 ? 'active' : '';
    html += `<div class="stage-panel ${activeClass}" id="stage-${s.id}">`;
    
    if (s.count === 0) {
      html += '<div class="stage-empty">Matches not yet scheduled. Will appear as earlier rounds are completed.</div>';
    } else {
      html += '<div class="stage-matches">';
      s.matches.forEach(m => {
        html += renderKnockoutMatch(m);
      });
      html += '</div>';
    }
    html += '</div>';
  });
  
  // Visual bracket path
  html += `<div class="bracket-path">
    <div class="path-line"></div>
    <div class="path-stages">
      <span class="path-dot ${r32.length > 0 ? 'has-data' : ''}">32</span>
      <span class="path-dot ${r16.length > 0 ? 'has-data' : ''}">16</span>
      <span class="path-dot ${qf.length > 0 ? 'has-data' : ''}">8</span>
      <span class="path-dot ${sf.length > 0 ? 'has-data' : ''}">4</span>
      <span class="path-dot ${final.length > 0 ? 'has-data' : ''}">F</span>
    </div>
  </div>`;
  
  html += '</div>';
  container.innerHTML = html;
  
  // Stage nav click handlers
  container.querySelectorAll('.stage-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.stage-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector('#stage-' + btn.dataset.stage)?.classList.add('active');
    });
  });
  
  // Click completed knockout matches to open detail
  container.querySelectorAll('.ko-match.complete').forEach(el => {
    el.addEventListener('click', () => openMatchModal(el.dataset.matchId));
  });
}

function renderKnockoutMatch(m) {
  const date = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isComplete = m.status === 'STATUS_FULL_TIME';
  const isLive = ['STATUS_IN_PROGRESS','STATUS_FIRST_HALF','STATUS_SECOND_HALF','STATUS_HALFTIME'].includes(m.status);
  const isTbd = m.home.team.includes('Winner') || m.home.team.includes('Place') || m.away.team.includes('Winner') || m.away.team.includes('Place');
  
  let statusBadge = '';
  if (isLive) statusBadge = '<span class="ko-badge live">LIVE</span>';
  else if (isComplete) statusBadge = '<span class="ko-badge done">FT</span>';
  else statusBadge = `<span class="ko-badge">${time}</span>`;
  
  const homeClass = isComplete && m.home.winner ? 'winner' : '';
  const awayClass = isComplete && m.away.winner ? 'winner' : '';
  const homeScore = isComplete || isLive ? m.home.score : '';
  const awayScore = isComplete || isLive ? m.away.score : '';
  
  return `<div class="ko-match ${isLive ? 'live' : ''} ${isTbd ? 'tbd' : ''} ${isComplete ? 'complete' : ''}" data-match-id="${m.id}">
    <div class="ko-date">${date} ${statusBadge}</div>
    <div class="ko-team ${homeClass}">
      <span class="ko-name">${m.home.flag} ${m.home.team}</span>
      <span class="ko-score">${homeScore}</span>
    </div>
    <div class="ko-team ${awayClass}">
      <span class="ko-name">${m.away.flag} ${m.away.team}</span>
      <span class="ko-score">${awayScore}</span>
    </div>
  </div>`;
}

// --- Schedule ---
function renderSchedule(data) {
  const container = document.getElementById('tab-schedule');
  const { matches } = data;
  
  const live = matches.filter(m => ['STATUS_IN_PROGRESS', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF', 'STATUS_HALFTIME'].includes(m.status));
  const upcoming = matches.filter(m => m.status === 'STATUS_SCHEDULED').slice(0, 20);
  const completed = matches.filter(m => m.status === 'STATUS_FULL_TIME').slice(-10).reverse();
  
  let html = '<div class="schedule-section">';
  
  if (live.length > 0) {
    html += '<h3 class="schedule-heading live-heading">LIVE NOW</h3><div class="schedule-matches live-matches">';
    live.forEach(m => { html += renderMatchCard(m, 'live'); });
    html += '</div>';
  }
  
  if (upcoming.length > 0) {
    html += '<h3 class="schedule-heading">UPCOMING</h3><div class="schedule-matches">';
    let currentDate = '';
    upcoming.forEach(m => {
      const d = new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (d !== currentDate) {
        if (currentDate) html += '<div class="schedule-divider"></div>';
        currentDate = d;
        html += `<div class="schedule-date">${d}</div>`;
      }
      html += renderMatchCard(m, 'upcoming');
    });
    html += '</div>';
  }
  
  if (completed.length > 0) {
    html += '<h3 class="schedule-heading">RECENT RESULTS</h3><div class="schedule-matches">';
    completed.forEach(m => { html += renderMatchCard(m, 'completed'); });
    html += '</div>';
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function renderMatchCard(m, type) {
  const time = new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const homeScore = m.home.score ?? '';
  const awayScore = m.away.score ?? '';
  
  let center = '';
  if (type === 'live') center = `<span class="match-score live">${homeScore} - ${awayScore}</span>`;
  else if (type === 'completed') center = `<span class="match-score">${homeScore} - ${awayScore}</span>`;
  else center = `<span class="match-time">${time}</span>`;
  
  const groupBadge = m.group ? `<span class="match-group">Grp ${m.group}</span>` : '';
  
  return `<div class="match-card ${type}">
    <div class="mc-team home ${m.home.winner ? 'winner' : ''}">${m.home.flag} ${m.home.team}</div>
    ${center}
    <div class="mc-team away ${m.away.winner ? 'winner' : ''}">${m.away.flag} ${m.away.team}</div>
    ${groupBadge}
  </div>`;
}

// --- Simulator ---
function renderSimulator(data) {
  const container = document.getElementById('tab-simulate');
  if (!data) return;
  
  const matches = data.matches.filter(m => m.status === 'STATUS_SCHEDULED' && m.group);
  const predCount = getPredictionCount();
  const totalUnplayed = matches.length;
  
  // Simulate standings with current predictions
  const simGroups = simulateStandings(data);
  const simThirds = getSimulatedThirds(simGroups);
  const simBracket = getSimulatedBracket(simGroups);
  
  let html = `<div class="sim-container">`;
  
  // Header
  html += `<div class="sim-header">
    <h3>Match Simulator</h3>
    <p class="sim-desc">Pick results for upcoming group matches. The standings, third-place table, and knockout bracket update instantly.</p>
    <div class="sim-progress">
      <div class="sim-progress-bar"><div class="sim-progress-fill" style="width:${totalUnplayed > 0 ? (predCount / totalUnplayed * 100) : 0}%"></div></div>
      <span class="sim-progress-text">${predCount} of ${totalUnplayed} predicted</span>
      ${predCount > 0 ? `<button class="sim-reset" id="simReset">Reset All</button>` : ''}
    </div>
  </div>`;
  
  // Match picker by group
  html += '<div class="sim-matches">';
  const groupedMatches = {};
  matches.forEach(m => {
    if (!groupedMatches[m.group]) groupedMatches[m.group] = [];
    groupedMatches[m.group].push(m);
  });
  
  Object.keys(groupedMatches).sort().forEach(g => {
    html += `<div class="sim-group-section">
      <div class="sim-group-header">Group ${g}</div>`;
    groupedMatches[g].forEach(m => {
      const pred = getPrediction(m.id);
      const date = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      html += `<div class="sim-match" data-match-id="${m.id}">
        <div class="sim-match-date">${date}</div>
        <div class="sim-match-row">
          <button class="sim-pick ${pred === 'home' ? 'active' : ''}" data-pick="home" data-match="${m.id}">
            ${m.home.flag} ${m.home.team}
          </button>
          <button class="sim-pick draw ${pred === 'draw' ? 'active' : ''}" data-pick="draw" data-match="${m.id}">
            Draw
          </button>
          <button class="sim-pick ${pred === 'away' ? 'active' : ''}" data-pick="away" data-match="${m.id}">
            ${m.away.team} ${m.away.flag}
          </button>
        </div>
      </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  
  // Simulated Results Panel (only show if predictions exist)
  if (predCount > 0) {
    html += '<div class="sim-results">';
    
    // Simulated standings
    html += '<h4 class="sim-results-title">Simulated Standings</h4>';
    html += '<div class="sim-standings-grid">';
    Object.keys(simGroups).sort().forEach(g => {
      const group = simGroups[g];
      html += `<div class="sim-group-card"><div class="sim-group-label">Group ${g}</div>`;
      group.teams.forEach((t, i) => {
        const cls = i < 2 ? 'sim-qual' : (i === 2 ? 'sim-third' : 'sim-elim');
        html += `<div class="sim-team-row ${cls}"><span class="sim-pos">${i+1}</span><span class="sim-name">${t.flag} ${t.team}</span><span class="sim-pts">${t.pts}</span></div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    
    // Simulated third place
    html += '<h4 class="sim-results-title">Simulated 3rd Place</h4>';
    html += '<div class="sim-thirds">';
    simThirds.forEach((t, i) => {
      const status = i < 8 ? 'advance' : 'out';
      html += `<div class="sim-third-item ${status}"><span class="sim-third-rank">${i+1}</span><span class="sim-third-group">${t.group}</span><span class="sim-third-name">${t.flag} ${t.team}</span><span class="sim-third-pts">${t.pts}pts</span><span class="sim-third-status">${i < 8 ? 'IN' : 'OUT'}</span></div>`;
    });
    html += '</div>';
    
    // Simulated bracket
    html += '<h4 class="sim-results-title">Simulated R32 Bracket</h4>';
    html += '<div class="sim-bracket-grid">';
    simBracket.forEach(m => {
      html += `<div class="sim-bracket-match">
        <div class="sim-bm-label">${m.label}</div>
        <div class="sim-bm-team">${m.homeTeam.flag} ${m.homeTeam.team}</div>
        <div class="sim-bm-vs">vs</div>
        <div class="sim-bm-team">${m.awayTeam.flag} ${m.awayTeam.team}</div>
      </div>`;
    });
    html += '</div>';
  }
  
  html += '</div></div>';
  container.innerHTML = html;
  
  // Attach event listeners
  container.querySelectorAll('.sim-pick').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const matchId = e.currentTarget.dataset.match;
      const pick = e.currentTarget.dataset.pick;
      const current = getPrediction(matchId);
      // Toggle off if same pick
      setPrediction(matchId, current === pick ? null : pick);
    });
  });
  
  const resetBtn = container.querySelector('#simReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', clearAllPredictions);
  }
}

// --- Tabs ---
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// --- Boot ---
init();
