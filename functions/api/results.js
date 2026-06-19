/**
 * Cloudflare Pages Function: /api/results
 * GET: Serve cached data from KV
 * POST: Accept new data from scraper (auth required)
 */

const API_KEY = "fifa-wc-2026-scraper-key";
const KV_KEY = "fifa-wc-2026-data";
const CACHE_TTL = 300; // 5 min edge cache

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const data = await env.FIFA_KV.get(KV_KEY, { type: "json" });
    if (!data) {
      return new Response(JSON.stringify({ error: "No data available yet" }), {
        status: 503,
        headers: corsHeaders("application/json"),
      });
    }
    
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders("application/json"),
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders("application/json"),
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Auth check
  const key = request.headers.get("X-API-Key");
  if (key !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders("application/json"),
    });
  }
  
  try {
    const body = await request.json();
    
    // Validate payload
    if (!body.groups || !body.matches || !body.info) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: corsHeaders("application/json"),
      });
    }
    
    // Store in KV
    await env.FIFA_KV.put(KV_KEY, JSON.stringify(body));
    
    return new Response(JSON.stringify({ 
      ok: true, 
      matchesPlayed: body.info.matchesPlayed,
      updatedAt: body.updatedAt,
    }), {
      headers: corsHeaders("application/json"),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders("application/json"),
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

function corsHeaders(contentType) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}
