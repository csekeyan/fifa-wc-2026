/**
 * Traditional tournament bracket tree visualization
 * Shows the full knockout path: R32 → R16 → QF → SF → Final
 * Uses CSS flex/grid with border-based connectors.
 */

export function renderBracketTree(data) {
  const { matches } = data;
  if (!matches || matches.length === 0) return '<div class="stage-empty">No bracket data yet.</div>';

  const r32 = (matches || []).filter(m => m.round === 'r32').sort((a,b) => new Date(a.date) - new Date(b.date));
  const r16 = (matches || []).filter(m => m.round === 'r16').sort((a,b) => new Date(a.date) - new Date(b.date));
  const qf = (matches || []).filter(m => m.round === 'qf').sort((a,b) => new Date(a.date) - new Date(b.date));
  const sf = (matches || []).filter(m => m.round === 'sf').sort((a,b) => new Date(a.date) - new Date(b.date));
  const final = (matches || []).filter(m => m.round === 'final');

  if (r32.length === 0) return '<div class="stage-empty">Knockout stage not yet started.</div>';

  // The R32→R16 bracket mapping (from the data):
  // R16[0]: R32[0] vs R32[2]
  // R16[1]: R32[1] vs R32[4]
  // R16[2]: R32[3] vs R32[5]
  // R16[3]: R32[6] vs R32[7]
  // R16[4]: R32[10] vs R32[11]
  // R16[5]: R32[8] vs R32[9]
  // R16[6]: R32[13] vs R32[15]
  // R16[7]: R32[12] vs R32[14]

  // Left bracket half (8 R32 → 4 R16 → 2 QF → 1 SF)
  const leftR32 = [r32[0], r32[2], r32[1], r32[4], r32[3], r32[5], r32[6], r32[7]];
  const leftR16 = r16.slice(0, 4);
  const leftQF = qf.slice(0, 2);
  const leftSF = sf.length > 0 ? [sf[0]] : [null];

  // Right bracket half
  const rightR32 = [r32[10], r32[11], r32[8], r32[9], r32[13], r32[15], r32[12], r32[14]];
  const rightR16 = r16.slice(4, 8);
  const rightQF = qf.slice(2, 4);
  const rightSF = sf.length > 1 ? [sf[1]] : [null];

  let html = '<div class="tree-bracket">';
  
  // Scroll hint
  html += '<div class="tree-scroll-hint">← Scroll to see full bracket →</div>';

  html += '<div class="tree-container">';

  // LEFT HALF (flows right)
  html += '<div class="tree-half left">';
  html += renderCol(leftR32, 'r32');
  html += '<div class="tree-connectors c8"></div>';
  html += renderCol(leftR16, 'r16');
  html += '<div class="tree-connectors c4"></div>';
  html += renderCol(leftQF, 'qf');
  html += '<div class="tree-connectors c2"></div>';
  html += renderCol(leftSF, 'sf');
  html += '</div>';

  // FINAL (center)
  html += '<div class="tree-center">';
  html += '<div class="tree-connector-final"></div>';
  if (final.length > 0) {
    html += renderTreeMatch(final[0], true);
  } else {
    html += `<div class="tree-match final-match tbd">
      <div class="tree-team"><span class="tree-name">SF1 Winner</span></div>
      <div class="tree-team"><span class="tree-name">SF2 Winner</span></div>
    </div>`;
  }
  html += '<div class="tree-trophy">🏆</div>';
  html += '<div class="tree-connector-final"></div>';
  html += '</div>';

  // RIGHT HALF (flows left, rendered right to left)
  html += '<div class="tree-half right">';
  html += renderCol(rightSF, 'sf');
  html += '<div class="tree-connectors c2"></div>';
  html += renderCol(rightQF, 'qf');
  html += '<div class="tree-connectors c4"></div>';
  html += renderCol(rightR16, 'r16');
  html += '<div class="tree-connectors c8"></div>';
  html += renderCol(rightR32, 'r32');
  html += '</div>';

  html += '</div>'; // tree-container
  html += '</div>'; // tree-bracket

  return html;
}

function renderCol(matches, roundClass) {
  let html = `<div class="tree-col tree-col-${roundClass}">`;
  matches.forEach((m, i) => {
    if (m) {
      html += renderTreeMatch(m);
    } else {
      html += `<div class="tree-match tbd"><div class="tree-team"><span class="tree-name">TBD</span></div><div class="tree-team"><span class="tree-name">TBD</span></div></div>`;
    }
  });
  html += '</div>';
  return html;
}

function renderTreeMatch(m, isFinal = false) {
  const isComplete = ['STATUS_FULL_TIME','STATUS_FINAL_PEN','STATUS_FINAL_AET','STATUS_FINAL'].includes(m.status);
  const isLive = ['STATUS_IN_PROGRESS','STATUS_FIRST_HALF','STATUS_SECOND_HALF','STATUS_HALFTIME','STATUS_END_PERIOD','STATUS_EXTRA_TIME','STATUS_PENALTY_SHOOTOUT','STATUS_OVERTIME'].includes(m.status);
  const isTbd = m.home.team.includes('Winner') || m.home.team.includes('Place');

  const homeWin = isComplete && m.home.winner;
  const awayWin = isComplete && m.away.winner;
  const homeScore = (isComplete || isLive) ? m.home.score : '';
  const awayScore = (isComplete || isLive) ? m.away.score : '';

  const stateClass = isLive ? 'live' : isComplete ? 'complete' : isTbd ? 'tbd' : '';
  const finalClass = isFinal ? 'final-match' : '';

  const homeName = shortName(m.home.team);
  const awayName = shortName(m.away.team);

  let html = `<div class="tree-match ${stateClass} ${finalClass}" data-match-id="${m.id}">`;
  html += `<div class="tree-team ${homeWin ? 'winner' : ''}">`;
  html += `<span class="tree-flag">${m.home.flag || ''}</span>`;
  html += `<span class="tree-name">${homeName}</span>`;
  if (homeScore !== '') html += `<span class="tree-score">${homeScore}</span>`;
  html += `</div>`;
  html += `<div class="tree-team ${awayWin ? 'winner' : ''}">`;
  html += `<span class="tree-flag">${m.away.flag || ''}</span>`;
  html += `<span class="tree-name">${awayName}</span>`;
  if (awayScore !== '') html += `<span class="tree-score">${awayScore}</span>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

function shortName(name) {
  return name
    .replace('Round of 32 ', 'R32-')
    .replace(' Winner', '')
    .replace('Group ', '')
    .replace(' 2nd Place', ' 2nd')
    .replace('Third Place ', '3rd ')
    .replace('Quarter-Final ', 'QF')
    .replace('Semi-Final ', 'SF');
}
