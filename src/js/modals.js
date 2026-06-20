/**
 * Modal System - Team, Match, and Player detail popups
 * Data fetched on-demand from ESPN API (proxied through our worker for caching).
 */

import { getData } from './data.js';

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=';
const ESPN_ATHLETE = 'https://site.api.espn.com/apis/common/v3/sports/soccer/fifa.world/athletes/';
const ESPN_OVERVIEW = 'https://site.web.api.espn.com/apis/common/v3/sports/soccer/fifa.world/athletes/';

// Cache fetched details
const cache = { matches: {}, players: {} };

// --- Modal Infrastructure ---
let modalStack = [];

function createModal(content, size = 'large') {
  const overlay = document.createElement('div');
  overlay.className = `modal-overlay ${size}`;
  overlay.innerHTML = `<div class="modal-container">
    <button class="modal-close" aria-label="Close">&times;</button>
    <div class="modal-body">${content}</div>
  </div>`;
  
  overlay.querySelector('.modal-close').onclick = () => closeModal(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
  
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  modalStack.push(overlay);
  
  // ESC key
  const handler = (e) => { if (e.key === 'Escape') closeModal(overlay); };
  document.addEventListener('keydown', handler);
  overlay._escHandler = handler;
  
  return overlay;
}

function closeModal(overlay) {
  if (!overlay) return;
  overlay.classList.remove('open');
  document.removeEventListener('keydown', overlay._escHandler);
  setTimeout(() => overlay.remove(), 200);
  modalStack = modalStack.filter(m => m !== overlay);
}

function showLoading(text = 'Loading...') {
  return createModal(`<div class="modal-loading"><div class="spinner"></div><p>${text}</p></div>`, 'small');
}

// --- Team Modal ---
export function openTeamModal(teamName) {
  const data = getData();
  if (!data) return;
  
  // Find team's group
  let teamGroup = '';
  let teamData = null;
  for (const [g, group] of Object.entries(data.groups)) {
    const found = group.teams.find(t => t.team === teamName);
    if (found) { teamGroup = g; teamData = found; break; }
  }
  if (!teamData) return;
  
  // Get all matches for this team
  const teamMatches = data.matches.filter(m => 
    m.home.team === teamName || m.away.team === teamName
  ).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const completed = teamMatches.filter(m => m.status === 'STATUS_FULL_TIME');
  const upcoming = teamMatches.filter(m => m.status === 'STATUS_SCHEDULED');
  const live = teamMatches.filter(m => !['STATUS_FULL_TIME', 'STATUS_SCHEDULED'].includes(m.status));
  
  // Stats
  const wins = completed.filter(m => {
    if (m.home.team === teamName) return m.home.winner;
    return m.away.winner;
  }).length;
  const draws = completed.filter(m => !m.home.winner && !m.away.winner).length;
  const losses = completed.length - wins - draws;
  const goalsFor = completed.reduce((sum, m) => {
    return sum + parseInt(m.home.team === teamName ? m.home.score : m.away.score) || 0;
  }, 0);
  const goalsAgainst = completed.reduce((sum, m) => {
    return sum + parseInt(m.home.team === teamName ? m.away.score : m.home.score) || 0;
  }, 0);
  
  let html = `<div class="team-modal">
    <div class="team-modal-header">
      <span class="team-flag-large">${teamData.flag}</span>
      <div>
        <h2>${teamName}</h2>
        <span class="team-group-badge">Group ${teamGroup}</span>
        <span class="team-standing">${getOrdinal(teamData)} in group</span>
      </div>
    </div>
    
    <div class="team-stats-row">
      <div class="ts-item"><span class="ts-val">${teamData.p}</span><span class="ts-lbl">Played</span></div>
      <div class="ts-item win"><span class="ts-val">${wins}</span><span class="ts-lbl">Won</span></div>
      <div class="ts-item"><span class="ts-val">${draws}</span><span class="ts-lbl">Drawn</span></div>
      <div class="ts-item loss"><span class="ts-val">${losses}</span><span class="ts-lbl">Lost</span></div>
      <div class="ts-item"><span class="ts-val">${goalsFor}</span><span class="ts-lbl">GF</span></div>
      <div class="ts-item"><span class="ts-val">${goalsAgainst}</span><span class="ts-lbl">GA</span></div>
      <div class="ts-item pts"><span class="ts-val">${teamData.pts}</span><span class="ts-lbl">Points</span></div>
    </div>`;
  
  // Match list
  if (live.length > 0) {
    html += '<h3 class="tm-section-title live-title">LIVE</h3>';
    live.forEach(m => { html += renderTeamMatchRow(m, teamName, 'live'); });
  }
  
  if (completed.length > 0) {
    html += '<h3 class="tm-section-title">RESULTS</h3>';
    completed.forEach(m => { html += renderTeamMatchRow(m, teamName, 'completed'); });
  }
  
  if (upcoming.length > 0) {
    html += '<h3 class="tm-section-title">UPCOMING</h3>';
    upcoming.forEach(m => { html += renderTeamMatchRow(m, teamName, 'upcoming'); });
  }
  
  html += '</div>';
  
  const modal = createModal(html);
  
  // Attach click handlers for match rows
  modal.querySelectorAll('.tm-match-row[data-match-id]').forEach(row => {
    row.addEventListener('click', () => {
      const matchId = row.dataset.matchId;
      const status = row.dataset.status;
      if (status === 'STATUS_FULL_TIME') {
        openMatchModal(matchId);
      }
    });
  });
}

function renderTeamMatchRow(m, teamName, type) {
  const isHome = m.home.team === teamName;
  const opponent = isHome ? m.away : m.home;
  const teamScore = isHome ? m.home.score : m.away.score;
  const oppScore = isHome ? m.away.score : m.home.score;
  const date = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const clickable = type === 'completed' ? 'clickable' : '';
  
  let result = '';
  if (type === 'completed') {
    const ts = parseInt(teamScore), os = parseInt(oppScore);
    if (ts > os) result = '<span class="tm-result win">W</span>';
    else if (ts < os) result = '<span class="tm-result loss">L</span>';
    else result = '<span class="tm-result draw">D</span>';
  }
  
  let scoreDisplay = '';
  if (type === 'completed' || type === 'live') {
    scoreDisplay = `<span class="tm-score">${teamScore} - ${oppScore}</span>`;
  } else {
    const time = new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    scoreDisplay = `<span class="tm-time">${time}</span>`;
  }
  
  return `<div class="tm-match-row ${type} ${clickable}" data-match-id="${m.id}" data-status="${m.status}">
    ${result}
    <span class="tm-date">${date}</span>
    <span class="tm-vs">${isHome ? 'vs' : '@'}</span>
    <span class="tm-opponent">${opponent.flag} ${opponent.team}</span>
    ${scoreDisplay}
    ${clickable ? '<span class="tm-arrow">&#8250;</span>' : ''}
  </div>`;
}

function getOrdinal(teamData) {
  const data = getData();
  for (const [g, group] of Object.entries(data.groups)) {
    const idx = group.teams.findIndex(t => t.team === teamData.team);
    if (idx >= 0) return `#${idx + 1}`;
  }
  return '';
}

// --- Match Detail Modal ---
export async function openMatchModal(matchId) {
  const loadingModal = showLoading('Loading match details...');
  
  try {
    const detail = await fetchMatchDetail(matchId);
    closeModal(loadingModal);
    
    if (!detail) {
      createModal('<p style="text-align:center;color:var(--text-muted)">Match details not available.</p>', 'small');
      return;
    }
    
    const html = buildMatchDetailHTML(detail, matchId);
    const modal = createModal(html);
    
    // Player click handlers
    modal.querySelectorAll('[data-player-id]').forEach(el => {
      el.addEventListener('click', () => openPlayerModal(el.dataset.playerId));
    });
  } catch (e) {
    closeModal(loadingModal);
    createModal(`<p style="text-align:center;color:var(--red)">Failed to load: ${e.message}</p>`, 'small');
  }
}

async function fetchMatchDetail(matchId) {
  if (cache.matches[matchId]) return cache.matches[matchId];
  
  const resp = await fetch(ESPN_SUMMARY + matchId);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  cache.matches[matchId] = data;
  return data;
}

function buildMatchDetailHTML(detail, matchId) {
  const gi = detail.gameInfo || {};
  const header = detail.header?.competitions?.[0] || {};
  const competitors = header.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
  
  const venue = gi.venue || {};
  const attendance = gi.attendance;
  const matchDate = new Date(header.date || '');
  
  // Get key events (goals, cards, subs)
  const events = (detail.keyEvents || []).filter(e => 
    ['Goal', 'Yellow Card', 'Red Card', 'Substitution'].includes(e.type?.text)
  );
  
  // Get rosters
  const rosters = detail.rosters || [];
  
  let html = `<div class="match-modal">
    <div class="mm-header">
      <div class="mm-team home">
        <span class="mm-team-name">${home?.team?.displayName || 'Home'}</span>
      </div>
      <div class="mm-score-block">
        <div class="mm-score">${home?.score || 0} - ${away?.score || 0}</div>
        <div class="mm-halftime">HT: ${home?.linescores?.[0]?.displayValue || '0'} - ${away?.linescores?.[0]?.displayValue || '0'}</div>
      </div>
      <div class="mm-team away">
        <span class="mm-team-name">${away?.team?.displayName || 'Away'}</span>
      </div>
    </div>
    
    <div class="mm-info">
      <div class="mm-info-item"><span class="mm-info-icon">&#9673;</span> ${venue.fullName || 'Unknown Venue'}${venue.address?.city ? `, ${venue.address.city}` : ''}</div>
      <div class="mm-info-item"><span class="mm-info-icon">&#9743;</span> ${matchDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
      ${attendance ? `<div class="mm-info-item"><span class="mm-info-icon">&#9786;</span> Attendance: ${attendance.toLocaleString()}</div>` : ''}
    </div>`;
  
  // Key events timeline
  if (events.length > 0) {
    html += '<div class="mm-events"><h4>Match Events</h4>';
    events.forEach(e => {
      const clock = e.clock?.displayValue || '';
      const type = e.type?.text || '';
      const text = e.text || '';
      let icon = '';
      if (type === 'Goal') icon = '&#9917;';
      else if (type === 'Yellow Card') icon = '<span class="card yellow"></span>';
      else if (type === 'Red Card') icon = '<span class="card red"></span>';
      else if (type === 'Substitution') icon = '&#8644;';
      
      html += `<div class="mm-event ${type.toLowerCase().replace(' ', '-')}">
        <span class="mm-ev-time">${clock}</span>
        <span class="mm-ev-icon">${icon}</span>
        <span class="mm-ev-text">${text}</span>
      </div>`;
    });
    html += '</div>';
  }
  
  // Lineups
  if (rosters.length > 0) {
    html += '<div class="mm-lineups"><h4>Lineups</h4><div class="mm-lineups-grid">';
    rosters.forEach(teamRoster => {
      const teamName = teamRoster.team?.displayName || 'Team';
      const starters = teamRoster.roster?.filter(p => p.starter) || [];
      const subs = teamRoster.roster?.filter(p => !p.starter) || [];
      
      html += `<div class="mm-lineup-team">
        <h5>${teamName}</h5>
        <div class="mm-starters">`;
      starters.forEach(p => {
        const pid = p.athlete?.id;
        html += `<div class="mm-player" data-player-id="${pid}">
          <span class="mm-jersey">${p.jersey || ''}</span>
          <span class="mm-pname">${p.athlete?.displayName || '?'}</span>
          <span class="mm-pos">${p.position?.abbreviation || ''}</span>
        </div>`;
      });
      html += '</div>';
      
      if (subs.length > 0) {
        html += '<div class="mm-subs-label">Substitutes</div><div class="mm-subs">';
        subs.forEach(p => {
          const pid = p.athlete?.id;
          html += `<div class="mm-player sub" data-player-id="${pid}">
            <span class="mm-jersey">${p.jersey || ''}</span>
            <span class="mm-pname">${p.athlete?.displayName || '?'}</span>
            <span class="mm-pos">${p.position?.abbreviation || ''}</span>
          </div>`;
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  }
  
  html += '</div>';
  return html;
}

// --- Player Modal ---
export async function openPlayerModal(playerId) {
  if (!playerId) return;
  const loadingModal = showLoading('Loading player...');
  
  try {
    // Fetch both bio and stats in parallel
    const [bioData, overviewData] = await Promise.all([
      fetchPlayerBio(playerId),
      fetchPlayerOverview(playerId),
    ]);
    closeModal(loadingModal);
    
    if (!bioData && !overviewData) {
      createModal('<p style="text-align:center;color:var(--text-muted)">Player info not available.</p>', 'small');
      return;
    }
    
    const html = buildPlayerHTML(bioData, overviewData);
    createModal(html, 'large');
  } catch (e) {
    closeModal(loadingModal);
    createModal(`<p style="text-align:center;color:var(--red)">Failed to load player: ${e.message}</p>`, 'small');
  }
}

async function fetchPlayerBio(playerId) {
  const key = 'bio_' + playerId;
  if (cache.players[key]) return cache.players[key];
  try {
    const resp = await fetch(ESPN_ATHLETE + playerId);
    if (!resp.ok) return null;
    const data = await resp.json();
    cache.players[key] = data;
    return data;
  } catch { return null; }
}

async function fetchPlayerOverview(playerId) {
  const key = 'ov_' + playerId;
  if (cache.players[key]) return cache.players[key];
  try {
    const resp = await fetch(ESPN_OVERVIEW + playerId + '/overview');
    if (!resp.ok) return null;
    const data = await resp.json();
    cache.players[key] = data;
    return data;
  } catch { return null; }
}

function buildPlayerHTML(bioData, overviewData) {
  const p = bioData?.athlete || {};
  const headshot = p.headshot?.href || '';
  
  let html = `<div class="player-modal">
    <div class="pm-header">
      ${headshot ? `<img class="pm-photo" src="${headshot}" alt="${p.displayName}">` : '<div class="pm-photo-placeholder"></div>'}
      <div class="pm-info">
        <h3>${p.displayName || 'Unknown'}</h3>
        <div class="pm-meta">
          ${p.jersey ? `<span class="pm-jersey">#${p.jersey}</span>` : ''}
          <span class="pm-position">${p.position?.displayName || ''}</span>
        </div>
        <div class="pm-details">
          ${p.team ? `<div>Club: ${p.team.displayName}</div>` : ''}
          ${p.citizenship ? `<div>Nationality: ${p.citizenship}</div>` : ''}
          ${p.age ? `<div>Age: ${p.age}</div>` : ''}
          ${p.displayHeight ? `<div>Height: ${p.displayHeight}</div>` : ''}
          ${p.displayDOB ? `<div>Born: ${p.displayDOB}</div>` : ''}
        </div>
      </div>
    </div>`;
  
  // World Cup tournament stats from overview
  if (overviewData?.statistics) {
    const stats = overviewData.statistics;
    const labels = stats.labels || [];
    const names = stats.names || [];
    const displayNames = stats.displayNames || [];
    
    // Find WC split
    const wcSplit = (stats.splits || []).find(s => 
      s.displayName?.includes('FIFA World Cup')
    );
    
    if (wcSplit && wcSplit.stats) {
      const values = wcSplit.stats;
      html += '<div class="pm-stats"><h4>World Cup 2026 Stats</h4><div class="pm-stats-grid">';
      
      // Show key stats with nice formatting
      const keyStats = ['totalGoals', 'goalAssists', 'totalShots', 'shotsOnTarget', 'starts', 'foulsCommitted', 'foulsSuffered', 'yellowCards', 'redCards', 'offsides', 'cleanSheet', 'saves', 'goalsConceded'];
      const statIcons = { totalGoals: '&#9917;', goalAssists: '&#127942;', totalShots: '&#127919;', shotsOnTarget: '&#9678;', starts: '&#9654;', yellowCards: '&#128993;', redCards: '&#128308;', saves: '&#128588;', cleanSheet: '&#128170;' };
      
      names.forEach((name, i) => {
        if (keyStats.includes(name) && values[i] !== undefined) {
          const val = values[i];
          const display = displayNames[i] || name;
          const icon = statIcons[name] || '';
          const highlight = (name === 'totalGoals' && parseInt(val) > 0) ? 'highlight' : 
                           (name === 'goalAssists' && parseInt(val) > 0) ? 'highlight-assist' : '';
          html += `<div class="pm-stat-item ${highlight}">
            <span class="pm-stat-val">${val}</span>
            <span class="pm-stat-lbl">${icon} ${display}</span>
          </div>`;
        }
      });
      html += '</div></div>';
    }
    
    // Club season stats (from other splits)
    const clubSplit = (stats.splits || []).find(s => 
      !s.displayName?.includes('FIFA') && !s.displayName?.includes('Friendly') && s.stats
    );
    if (clubSplit) {
      html += `<div class="pm-club-stats"><h4>${clubSplit.displayName} (Club)</h4><div class="pm-stats-grid mini">`;
      names.forEach((name, i) => {
        if (['totalGoals', 'goalAssists', 'starts'].includes(name) && clubSplit.stats[i]) {
          html += `<div class="pm-stat-item"><span class="pm-stat-val">${clubSplit.stats[i]}</span><span class="pm-stat-lbl">${displayNames[i]}</span></div>`;
        }
      });
      html += '</div></div>';
    }
  }
  
  // Last 5 matches gamelog
  if (overviewData?.gameLog) {
    const gl = overviewData.gameLog;
    const glStats = gl.statistics?.[0];
    const events = gl.events;
    
    if (glStats && events && Object.keys(events).length > 0) {
      html += '<div class="pm-gamelog"><h4>Recent Matches</h4>';
      html += '<div class="pm-gl-table"><div class="pm-gl-header">';
      const glLabels = glStats.labels || [];
      html += '<span class="pm-gl-match">Match</span>';
      glLabels.slice(0, 6).forEach(l => { html += `<span class="pm-gl-col">${l}</span>`; });
      html += '</div>';
      
      Object.entries(events).forEach(([eid, ev]) => {
        const matchName = ev.links?.[0]?.href?.split('/')?. pop()?.replace(/-/g, ' ') || 'Match';
        const evStats = ev.stats || [];
        html += '<div class="pm-gl-row">';
        html += `<span class="pm-gl-match">${matchName}</span>`;
        evStats.slice(0, 6).forEach(s => { html += `<span class="pm-gl-col">${s}</span>`; });
        html += '</div>';
      });
      html += '</div></div>';
    }
  }
  
  html += '</div>';
  return html;
}

// --- Public: make team names clickable ---
export function attachTeamClickHandlers(container) {
  container.querySelectorAll('.team-name, .mc-team, .bm-name, .sim-name').forEach(el => {
    const text = el.textContent.trim().replace(/^[\u{1F1E0}-\u{1F1FF}\u{1F3F4}][\u{1F1E0}-\u{1F1FF}\u{E0000}-\u{E007F}]* ?/u, '');
    if (text && text !== 'TBD' && text !== 'TBD (3rd)') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openTeamModal(text);
      });
    }
  });
}
