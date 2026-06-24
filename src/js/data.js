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

// R32 bracket mapping (from ESPN/FIFA official draw)
export const R32_BRACKET = [
  { id: 1, home: "A2", away: "B2", label: "Match 49" },
  { id: 2, home: "C1", away: "F2", label: "Match 50" },
  { id: 3, home: "E1", away: "A3/B3/C3/D3/F3", label: "Match 51" },
  { id: 4, home: "F1", away: "C2", label: "Match 52" },
  { id: 5, home: "E2", away: "I2", label: "Match 53" },
  { id: 6, home: "I1", away: "C3/D3/F3/G3/H3", label: "Match 54" },
  { id: 7, home: "A1", away: "C3/E3/F3/H3/I3", label: "Match 55" },
  { id: 8, home: "L1", away: "E3/H3/I3/J3/K3", label: "Match 56" },
  { id: 9, home: "G1", away: "A3/E3/H3/I3/J3", label: "Match 57" },
  { id: 10, home: "D1", away: "B3/E3/F3/I3/J3", label: "Match 58" },
  { id: 11, home: "H1", away: "J2", label: "Match 59" },
  { id: 12, home: "K2", away: "L2", label: "Match 60" },
  { id: 13, home: "B1", away: "E3/F3/G3/I3/J3", label: "Match 61" },
  { id: 14, home: "D2", away: "G2", label: "Match 62" },
  { id: 15, home: "J1", away: "H2", label: "Match 63" },
  { id: 16, home: "K1", away: "D3/E3/I3/J3/L3", label: "Match 64" },
];
