/**
 * Simulator Module v2
 * Score-based predictions (not just win/draw/away).
 * Shareable via URL encoding.
 */

import { getData, R32_BRACKET } from './data.js';

const STORAGE_KEY = 'fifa-wc-2026-predictions-v2';
let predictions = loadPredictions();
let onUpdate = null;

// --- Persistence ---
function loadPredictions() {
  // Check URL first (shared link takes priority)
  const urlPreds = loadFromURL();
  if (urlPreds) return urlPreds;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function savePredictions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('sim');
  if (!encoded) return null;
  try {
    const decoded = atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));
    const preds = JSON.parse(decoded);
    // Mark as shared view
    preds._shared = true;
    return preds;
  } catch { return null; }
}

// --- Public API ---
export function setPrediction(matchId, homeScore, awayScore) {
  if (homeScore === null || awayScore === null) {
    delete predictions[matchId];
  } else {
    predictions[matchId] = { h: homeScore, a: awayScore };
  }
  delete predictions._shared; // no longer a shared view once you edit
  savePredictions();
  if (onUpdate) onUpdate();
}

export function getPrediction(matchId) {
  return predictions[matchId] || null;
}

export function clearAllPredictions() {
  predictions = {};
  savePredictions();
  // Clear URL params
  if (window.location.search.includes('sim=')) {
    history.replaceState(null, '', window.location.pathname);
  }
  if (onUpdate) onUpdate();
}

export function getPredictionCount() {
  return Object.keys(predictions).filter(k => k !== '_shared').length;
}

export function isSharedView() {
  return predictions._shared === true;
}

export function setUpdateCallback(fn) {
  onUpdate = fn;
}

// --- Share link ---
export function generateShareLink() {
  const clean = { ...predictions };
  delete clean._shared;
  if (Object.keys(clean).length === 0) return null;
  const json = JSON.stringify(clean);
  const encoded = btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return window.location.origin + window.location.pathname + '?sim=' + encoded;
}

// --- Simulation engine ---
export function simulateStandings(data) {
  if (!data) return null;
  
  const groups = {};
  for (const [g, group] of Object.entries(data.groups)) {
    groups[g] = {
      city: group.city,
      teams: group.teams.map(t => ({ ...t })),
    };
  }
  
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
    
    const hGoals = pred.h;
    const aGoals = pred.a;
    
    homeTeam.p += 1;
    awayTeam.p += 1;
    homeTeam.gf += hGoals;
    homeTeam.ga += aGoals;
    awayTeam.gf += aGoals;
    awayTeam.ga += hGoals;
    homeTeam.gd += (hGoals - aGoals);
    awayTeam.gd += (aGoals - hGoals);
    
    if (hGoals > aGoals) {
      homeTeam.w += 1; homeTeam.pts += 3;
      awayTeam.l += 1;
    } else if (aGoals > hGoals) {
      awayTeam.w += 1; awayTeam.pts += 3;
      homeTeam.l += 1;
    } else {
      homeTeam.d += 1; homeTeam.pts += 1;
      awayTeam.d += 1; awayTeam.pts += 1;
    }
  }
  
  for (const group of Object.values(groups)) {
    group.teams.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }
  
  return groups;
}

export function getSimulatedThirds(simGroups) {
  if (!simGroups) return [];
  return Object.keys(simGroups).sort()
    .map(g => ({ ...simGroups[g].teams[2], group: g }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

export function getSimulatedBracket(simGroups) {
  if (!simGroups) return [];
  const thirds = getSimulatedThirds(simGroups);
  const qualifiedThirds = thirds.slice(0, 8).map(t => t.group);
  
  // Track which third-placed teams have been assigned
  const assigned = new Set();
  
  // First pass: identify which matches need a third-placed team
  const thirdSlots = R32_BRACKET.filter(m => m.away.includes('/'));
  
  // Assign third-placed teams to slots (each team used exactly once)
  // Sort slots by fewest options first (most constrained first) for better matching
  const slotAssignments = {};
  const sortedSlots = [...thirdSlots].sort((a, b) => {
    const aOpts = a.away.split('/').map(s => s[0]).filter(g => qualifiedThirds.includes(g));
    const bOpts = b.away.split('/').map(s => s[0]).filter(g => qualifiedThirds.includes(g));
    return aOpts.length - bOpts.length;
  });
  
  for (const slot of sortedSlots) {
    const options = slot.away.split('/').map(s => s[0]);
    // Find best available (highest ranked in thirds table) from allowed groups
    const available = thirds.filter(t => 
      options.includes(t.group) && qualifiedThirds.includes(t.group) && !assigned.has(t.group)
    );
    if (available.length > 0) {
      slotAssignments[slot.id] = available[0];
      assigned.add(available[0].group);
    }
  }
  
  return R32_BRACKET.map(m => {
    const home = resolveTeamDirect(m.home, simGroups);
    let away;
    if (m.away.includes('/')) {
      const assignedTeam = slotAssignments[m.id];
      away = assignedTeam || { team: 'TBD (3rd)', flag: '' };
    } else {
      away = resolveTeamDirect(m.away, simGroups);
    }
    return { ...m, homeTeam: home, awayTeam: away };
  });
}

function resolveTeamDirect(seed, simGroups) {
  const group = seed[0];
  const pos = parseInt(seed[1]) - 1;
  return simGroups[group]?.teams[pos] || { team: 'TBD', flag: '' };
}
