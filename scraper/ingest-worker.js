// Standalone Worker for data ingestion from cloud desktop
// Deployed separately, no bot fight protection
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, X-API-Key" }});
    }
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405 });
    }
    const key = request.headers.get("X-API-Key");
    if (key !== "fifa-wc-2026-cloud-scraper-9x7k2m") {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const body = await request.text();
      await env.FIFA_KV.put("fifa-wc-2026-data", body);
      return new Response(JSON.stringify({ ok: true, size: body.length }), { headers: { "Content-Type": "application/json" }});
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
