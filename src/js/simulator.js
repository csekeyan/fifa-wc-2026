/**
 * Simulator Module
 * Users pick results for unplayed matches → standings recalculate → bracket updates live.
 * Predictions stored in localStorage.
 */

import { getData, R32_BRACKET } from './data.js';

const STORAGE_KEY = 'fifa-wc-2026-predictions';
let predictions = loadPredictions();
let onUpdate = null;

function loadPredictions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function savePredictions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
}

export function setPrediction(matchId, result) {
  // result: 'home' | 'draw' | 'away' | null (clear)
  if (result === null) {
    delete predictions[matchId];
  } else {
    predictions[matchId] = result;
  }
  savePredictions();
  if (onUpdate) onUpdate();
}

export function getPrediction(matchId) {
  return predictions[matchId] || null;
}

export function clearAllPredictions() {
  predictions = {};
  savePredictions();
  if (onUpdate) onUpdate();
}

export function getPredictionCount() {
  return Object.keys(predictions).length;
}

export function setUpdateCallback(fn) {
  onUpdate = fn;
}

/**
 * Given real data + user predictions, compute simulated standings.
 */
export function simulateStandings(data) {
  if (!data) return null;
  
  // Deep clone the real standings
  const groups = {};
  for (const [g, group] of Object.entries(data.groups)) {
    groups[g] = {
      city: group.city,
      teams: group.teams.map(t => ({ ...t })),
    };
  }
  
  // Apply predictions to unplayed matches
  const matches = data.matches || [];
  const unplayed = matches.filter(m => m.status === 'STATUS_SCHEDULED');
  
  for (const match of unplayed) {
    const pred = predictions[match.id];
    if (!pred || !match.group) continue;
    
    const group = groups[match.group];
    if (!group) continue;
    
    const homeTeam = group.teams.find(t => t.team === match.home.team);
    const awayTeam = group.teams.find(t => t.team === match.away.team);
    if (!homeTeam || !awayTeam) continue;
    
    // Apply result: simple 1-0 or 0-0 logic
    if (pred === 'home') {
      homeTeam.p += 1; homeTeam.w += 1; homeTeam.pts += 3;
      homeTeam.gf += 1; awayTeam.ga += 1;
      homeTeam.gd += 1; awayTeam.gd -= 1;
      awayTeam.p += 1; awayTeam.l += 1;
    } else if (pred === 'away') {
      awayTeam.p += 1; awayTeam.w += 1; awayTeam.pts += 3;
      awayTeam.gf += 1; homeTeam.ga += 1;
      awayTeam.gd += 1; homeTeam.gd -= 1;
      homeTeam.p += 1; homeTeam.l += 1;
    } else if (pred === 'draw') {
      homeTeam.p += 1; homeTeam.d += 1; homeTeam.pts += 1;
      awayTeam.p += 1; awayTeam.d += 1; awayTeam.pts += 1;
    }
  }
  
  // Re-sort each group by pts, gd, gf
  for (const group of Object.values(groups)) {
    group.teams.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }
  
  return groups;
}

/**
 * Get third-place ranking from simulated standings.
 */
export function getSimulatedThirds(simGroups) {
  if (!simGroups) return [];
  return Object.keys(simGroups).sort()
    .map(g => ({ ...simGroups[g].teams[2], group: g }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

/**
 * Resolve bracket matchups from simulated standings.
 */
export function getSimulatedBracket(simGroups) {
  if (!simGroups) return [];
  
  const thirds = getSimulatedThirds(simGroups);
  const qualifiedThirds = thirds.slice(0, 8).map(t => t.group);
  
  return R32_BRACKET.map(m => {
    const home = resolveTeamFromSim(m.home, simGroups);
    const away = resolveTeamFromSim(m.away, simGroups, qualifiedThirds);
    return { ...m, homeTeam: home, awayTeam: away };
  });
}

function resolveTeamFromSim(seed, simGroups, qualifiedThirds) {
  if (!seed.includes('/')) {
    // Direct seed like "A1"
    const group = seed[0];
    const pos = parseInt(seed[1]) - 1;
    return simGroups[group]?.teams[pos] || { team: 'TBD', flag: '' };
  }
  
  // Third-place slot like "C3/D3/E3"
  if (!qualifiedThirds) return { team: 'TBD (3rd)', flag: '' };
  
  const options = seed.split('/').map(s => s[0]);
  const matched = options.find(g => qualifiedThirds.includes(g));
  if (matched) {
    return simGroups[matched]?.teams[2] || { team: 'TBD (3rd)', flag: '' };
  }
  return { team: 'TBD (3rd)', flag: '' };
}
