/**
 * Live Scoreboard - polls ESPN every 30s directly from client.
 * Shows live matches with animated clock, goal scorers, and match events.
 */

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const POLL_INTERVAL = 30000; // 30 seconds

let liveData = null;
let pollTimer = null;

export function startLivePolling(onUpdate) {
  fetchLive(onUpdate);
  pollTimer = setInterval(() => fetchLive(onUpdate), POLL_INTERVAL);
}

export function stopLivePolling() {
  if (pollTimer) clearInterval(pollTimer);
}

async function fetchLive(onUpdate) {
  try {
    const resp = await fetch(ESPN_SCOREBOARD);
    if (!resp.ok) return;
    liveData = await resp.json();
    if (onUpdate) onUpdate(liveData);
  } catch (e) {
    console.warn('Live fetch failed:', e.message);
  }
}

export function renderLiveScoreboard(container, data) {
  if (!data || !data.events) {
    container.innerHTML = '';
    return;
  }

  const events = data.events;
  const live = events.filter(e => isLive(e));
  const isComplete = (e) => ['STATUS_FULL_TIME','STATUS_FINAL_PEN','STATUS_FINAL_AET','STATUS_FINAL'].includes(e.competitions[0].status.type.name);
  const completed = events.filter(e => isComplete(e));
  const upcoming = events.filter(e => e.competitions[0].status.type.name === 'STATUS_SCHEDULED');

  let html = '<div class="live-scoreboard">';

  // Live matches - hero treatment
  if (live.length > 0) {
    html += '<div class="ls-live-section">';
    html += `<div class="ls-live-header"><span class="ls-pulse"></span> LIVE NOW</div>`;
    html += '<div class="ls-live-grid">';
    live.forEach(e => { html += renderLiveMatch(e); });
    html += '</div></div>';
  }

  // Completed today
  if (completed.length > 0) {
    html += '<div class="ls-section">';
    html += '<div class="ls-section-title">FULL TIME</div>';
    html += '<div class="ls-matches-grid">';
    completed.forEach(e => { html += renderCompletedMatch(e); });
    html += '</div></div>';
  }

  // Upcoming today
  if (upcoming.length > 0) {
    html += '<div class="ls-section">';
    html += '<div class="ls-section-title">COMING UP</div>';
    html += '<div class="ls-matches-grid">';
    upcoming.forEach(e => { html += renderUpcomingMatch(e); });
    html += '</div></div>';
  }

  if (events.length === 0) {
    html += '<div class="ls-empty">No matches today. Check the Schedule tab for upcoming fixtures.</div>';
  }

  // Auto-refresh indicator
  html += `<div class="ls-refresh-bar"><span class="ls-refresh-dot"></span> Auto-updates every 30 seconds</div>`;

  html += '</div>';
  container.innerHTML = html;
}

function isLive(event) {
  const status = event.competitions[0].status.type.name;
  return ['STATUS_IN_PROGRESS', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF', 'STATUS_HALFTIME', 'STATUS_END_PERIOD', 'STATUS_EXTRA_TIME', 'STATUS_PENALTY_SHOOTOUT', 'STATUS_OVERTIME'].includes(status);
}

function renderLiveMatch(event) {
  const comp = event.competitions[0];
  const status = comp.status;
  const h = comp.competitors.find(c => c.homeAway === 'home') || comp.competitors[0];
  const a = comp.competitors.find(c => c.homeAway === 'away') || comp.competitors[1];
  const clock = status.displayClock || '';
  const period = status.period || 0;
  const isHT = status.type.name === 'STATUS_HALFTIME';
  
  const timeDisplay = isHT ? 'HT' : clock;
  const periodLabel = period === 1 ? '1st Half' : period === 2 ? '2nd Half' : '';
  
  // Goal scorers
  const details = comp.details || [];
  const goals = details.filter(d => d.type?.text === 'Goal');
  const homeGoals = goals.filter(g => g.team?.id === h.team.id);
  const awayGoals = goals.filter(g => g.team?.id === a.team.id);
  
  const homeLogo = h.team.logos?.[0]?.href || '';
  const awayLogo = a.team.logos?.[0]?.href || '';

  let html = `<div class="ls-live-card">
    <div class="ls-live-clock">
      <span class="ls-clock-time">${timeDisplay}</span>
      <span class="ls-clock-period">${periodLabel}</span>
    </div>
    <div class="ls-live-teams">
      <div class="ls-live-team">
        ${homeLogo ? `<img class="ls-team-logo" src="${homeLogo}" alt="">` : ''}
        <span class="ls-team-name">${h.team.displayName}</span>
        <span class="ls-live-score">${h.score || 0}</span>
      </div>
      <div class="ls-live-team">
        ${awayLogo ? `<img class="ls-team-logo" src="${awayLogo}" alt="">` : ''}
        <span class="ls-team-name">${a.team.displayName}</span>
        <span class="ls-live-score">${a.score || 0}</span>
      </div>
    </div>`;

  // Goal scorers
  if (homeGoals.length > 0 || awayGoals.length > 0) {
    html += '<div class="ls-scorers">';
    if (homeGoals.length > 0) {
      html += '<div class="ls-scorer-side home">';
      homeGoals.forEach(g => {
        const name = g.athletesInvolved?.[0]?.displayName || '?';
        const time = g.clock?.displayValue || '';
        html += `<span class="ls-scorer">${name} ${time}</span>`;
      });
      html += '</div>';
    }
    if (awayGoals.length > 0) {
      html += '<div class="ls-scorer-side away">';
      awayGoals.forEach(g => {
        const name = g.athletesInvolved?.[0]?.displayName || '?';
        const time = g.clock?.displayValue || '';
        html += `<span class="ls-scorer">${name} ${time}</span>`;
      });
      html += '</div>';
    }
    html += '</div>';
  }

  // Venue
  const venue = event.venue?.fullName || '';
  if (venue) html += `<div class="ls-venue">${venue}</div>`;

  html += '</div>';
  return html;
}

function renderCompletedMatch(event) {
  const comp = event.competitions[0];
  const h = comp.competitors.find(c => c.homeAway === 'home') || comp.competitors[0];
  const a = comp.competitors.find(c => c.homeAway === 'away') || comp.competitors[1];
  const details = comp.details || [];
  const goals = details.filter(d => d.type?.text === 'Goal');
  const homeGoals = goals.filter(g => g.team?.id === h.team.id);
  const awayGoals = goals.filter(g => g.team?.id === a.team.id);
  const homeLogo = h.team.logos?.[0]?.href || '';
  const awayLogo = a.team.logos?.[0]?.href || '';

  let html = `<div class="ls-match-card completed">
    <div class="ls-ft-badge">FT</div>
    <div class="ls-match-teams">
      <div class="ls-match-team ${h.winner ? 'winner' : ''}">
        ${homeLogo ? `<img class="ls-team-logo" src="${homeLogo}" alt="">` : ''}
        <span class="ls-team-name">${h.team.displayName}</span>
        <span class="ls-match-score">${h.score}</span>
      </div>
      <div class="ls-match-team ${a.winner ? 'winner' : ''}">
        ${awayLogo ? `<img class="ls-team-logo" src="${awayLogo}" alt="">` : ''}
        <span class="ls-team-name">${a.team.displayName}</span>
        <span class="ls-match-score">${a.score}</span>
      </div>
    </div>`;

  if (homeGoals.length > 0 || awayGoals.length > 0) {
    html += '<div class="ls-scorers compact">';
    [...homeGoals, ...awayGoals].forEach(g => {
      const name = g.athletesInvolved?.[0]?.displayName || '?';
      const time = g.clock?.displayValue || '';
      html += `<span class="ls-scorer">${name} ${time}</span>`;
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderUpcomingMatch(event) {
  const comp = event.competitions[0];
  const h = comp.competitors.find(c => c.homeAway === 'home') || comp.competitors[0];
  const a = comp.competitors.find(c => c.homeAway === 'away') || comp.competitors[1];
  const time = new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const homeLogo = h.team.logos?.[0]?.href || '';
  const awayLogo = a.team.logos?.[0]?.href || '';
  const venue = event.venue?.fullName || '';

  return `<div class="ls-match-card upcoming">
    <div class="ls-kickoff">${time}</div>
    <div class="ls-match-teams">
      <div class="ls-match-team">
        ${homeLogo ? `<img class="ls-team-logo" src="${homeLogo}" alt="">` : ''}
        <span class="ls-team-name">${h.team.displayName}</span>
      </div>
      <div class="ls-match-vs">vs</div>
      <div class="ls-match-team">
        ${awayLogo ? `<img class="ls-team-logo" src="${awayLogo}" alt="">` : ''}
        <span class="ls-team-name">${a.team.displayName}</span>
      </div>
    </div>
    ${venue ? `<div class="ls-venue">${venue}</div>` : ''}
  </div>`;
}
