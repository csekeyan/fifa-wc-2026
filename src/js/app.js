import { subscribe, startPolling, R32_BRACKET } from './data.js';

// --- Init ---
function init() {
  initTabs();
  startPolling();
  subscribe(render);
}

function render(data) {
  renderSummary(data);
  renderGroups(data);
  renderThirdPlace(data);
  renderBracket(data);
  renderSchedule(data);
  updateMeta(data);
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
  const { groups } = data;
  
  function resolveTeam(seed) {
    if (seed.includes('/')) return { team: 'TBD (3rd)', flag: '' };
    const group = seed[0];
    const pos = parseInt(seed[1]) - 1;
    const team = groups[group]?.teams[pos];
    return team || { team: 'TBD', flag: '' };
  }

  let html = `<div class="bracket-section">
    <div class="bracket-legend">
      <p>Round of 32 matchups based on current group standings. Third-place slots depend on which groups' 3rd-place teams qualify.</p>
    </div>`;
    
  // Split into two halves for the bracket tree visual
  const leftHalf = R32_BRACKET.slice(0, 8);
  const rightHalf = R32_BRACKET.slice(8, 16);
  
  html += '<div class="bracket-halves">';
  
  // Left half
  html += '<div class="bracket-half"><h4>Left Bracket</h4><div class="bracket-matches">';
  leftHalf.forEach(m => {
    const home = resolveTeam(m.home);
    const away = resolveTeam(m.away);
    const isTbd = away.team.includes('TBD');
    html += renderBracketMatch(m, home, away, isTbd);
  });
  html += '</div></div>';
  
  // Right half
  html += '<div class="bracket-half"><h4>Right Bracket</h4><div class="bracket-matches">';
  rightHalf.forEach(m => {
    const home = resolveTeam(m.home);
    const away = resolveTeam(m.away);
    const isTbd = away.team.includes('TBD');
    html += renderBracketMatch(m, home, away, isTbd);
  });
  html += '</div></div>';
  
  html += '</div>'; // bracket-halves

  // Tournament tree (later rounds)
  html += `<div class="bracket-tree">
    <div class="tree-header">
      <span class="tree-stage">R32</span>
      <span class="tree-stage">R16</span>
      <span class="tree-stage">QF</span>
      <span class="tree-stage">SF</span>
      <span class="tree-stage">Final</span>
    </div>
    <div class="tree-note">Knockout bracket will fill in as matches are decided (starts ~June 28)</div>
  </div>`;

  container.innerHTML = html;
}

function renderBracketMatch(m, home, away, isTbd) {
  return `<div class="bracket-match ${isTbd ? 'tbd' : ''}">
    <div class="bm-label">${m.label}</div>
    <div class="bm-team"><span class="bm-name">${home.flag} ${home.team}</span><span class="bm-seed">${m.home}</span></div>
    <div class="bm-vs">vs</div>
    <div class="bm-team"><span class="bm-name">${away.flag} ${away.team}</span><span class="bm-seed">${m.away}</span></div>
  </div>`;
}

// --- Schedule ---
function renderSchedule(data) {
  const container = document.getElementById('tab-schedule');
  const { matches } = data;
  
  // Split into live, upcoming, and completed
  const live = matches.filter(m => ['STATUS_IN_PROGRESS', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF', 'STATUS_HALFTIME'].includes(m.status));
  const upcoming = matches.filter(m => m.status === 'STATUS_SCHEDULED').slice(0, 20);
  const completed = matches.filter(m => m.status === 'STATUS_FULL_TIME').slice(-10).reverse();
  
  let html = '<div class="schedule-section">';
  
  // Live matches
  if (live.length > 0) {
    html += '<h3 class="schedule-heading live-heading">LIVE NOW</h3>';
    html += '<div class="schedule-matches live-matches">';
    live.forEach(m => { html += renderMatchCard(m, 'live'); });
    html += '</div>';
  }
  
  // Upcoming
  if (upcoming.length > 0) {
    html += '<h3 class="schedule-heading">UPCOMING</h3>';
    html += '<div class="schedule-matches">';
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
  
  // Recent results
  if (completed.length > 0) {
    html += '<h3 class="schedule-heading">RECENT RESULTS</h3>';
    html += '<div class="schedule-matches">';
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
  if (type === 'live') {
    center = `<span class="match-score live">${homeScore} - ${awayScore}</span>`;
  } else if (type === 'completed') {
    center = `<span class="match-score">${homeScore} - ${awayScore}</span>`;
  } else {
    center = `<span class="match-time">${time}</span>`;
  }
  
  const groupBadge = m.group ? `<span class="match-group">Grp ${m.group}</span>` : '';
  
  return `<div class="match-card ${type}">
    <div class="mc-team home ${m.home.winner ? 'winner' : ''}">${m.home.flag} ${m.home.team}</div>
    ${center}
    <div class="mc-team away ${m.away.winner ? 'winner' : ''}">${m.away.flag} ${m.away.team}</div>
    ${groupBadge}
  </div>`;
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
