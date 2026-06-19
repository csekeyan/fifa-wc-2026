/**
 * Data layer - fetches from /api/results (Cloudflare Worker)
 * Falls back to local scraper output for dev mode.
 */

const API_URL = "/api/results";
const LOCAL_FALLBACK = "/scraper/latest.json";
const POLL_INTERVAL = 60000; // 1 minute

let _data = null;
let _listeners = [];

export function subscribe(fn) {
  _listeners.push(fn);
  if (_data) fn(_data);
}

function notify() {
  _listeners.forEach(fn => fn(_data));
}

export async function fetchData() {
  try {
    // Try API first
    let resp = await fetch(API_URL);
    
    // In dev mode, API won't exist - fall back to local file
    if (!resp.ok) {
      resp = await fetch(LOCAL_FALLBACK);
    }
    
    if (resp.ok) {
      _data = await resp.json();
      notify();
      return _data;
    }
  } catch (e) {
    console.warn("Fetch failed, trying fallback:", e.message);
    try {
      const resp = await fetch(LOCAL_FALLBACK);
      if (resp.ok) {
        _data = await resp.json();
        notify();
        return _data;
      }
    } catch (e2) {
      console.error("All fetches failed:", e2.message);
    }
  }
  return _data;
}

export function getData() {
  return _data;
}

// Start polling
export function startPolling() {
  fetchData();
  setInterval(fetchData, POLL_INTERVAL);
}

// R32 bracket mapping (static - doesn't change)
export const R32_BRACKET = [
  { id: 1, home: "A1", away: "C3/D3/E3", label: "Match 49" },
  { id: 2, home: "B1", away: "A3/D3/F3", label: "Match 50" },
  { id: 3, home: "C1", away: "B2", label: "Match 51" },
  { id: 4, home: "D1", away: "A2", label: "Match 52" },
  { id: 5, home: "E1", away: "B3/F3/G3", label: "Match 53" },
  { id: 6, home: "F1", away: "E2", label: "Match 54" },
  { id: 7, home: "G1", away: "H2", label: "Match 55" },
  { id: 8, home: "H1", away: "G2", label: "Match 56" },
  { id: 9, home: "I1", away: "J2", label: "Match 57" },
  { id: 10, home: "J1", away: "I2", label: "Match 58" },
  { id: 11, home: "K1", away: "L2", label: "Match 59" },
  { id: 12, home: "L1", away: "K2", label: "Match 60" },
  { id: 13, home: "C2", away: "D3/E3/F3", label: "Match 61" },
  { id: 14, home: "D2", away: "G3/H3/I3", label: "Match 62" },
  { id: 15, home: "F2", away: "H3/I3/J3", label: "Match 63" },
  { id: 16, home: "E2", away: "J3/K3/L3", label: "Match 64" },
];
