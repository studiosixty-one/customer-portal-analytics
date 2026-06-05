/**
 * Studio 61 — Analytics edge collector (Cloudflare Worker).
 *
 * Serves the tracking script and ingests pageview/event beacons, writing them
 * to Workers Analytics Engine. Runs at the edge so ingestion is cheap and never
 * touches the dashboard's Postgres.
 *
 * Privacy: cookieless. The visitor id is a one-way hash of a daily-rotating
 * random salt + tracking id + IP + user-agent. No cookie is set and no IP is
 * stored, so customer sites don't need a consent banner.
 *
 * IMPORTANT: the Analytics Engine column map below MUST stay in sync with the
 * dashboard's reader at ../../src/lib/analytics/event-schema.ts.
 *   index1 = tracking id (the site; primary filter + sampling key)
 *   blob1=event_type blob2=path blob3=hostname blob4=referrer_host blob5=country
 *   blob6=device blob7=browser blob8=os blob9=visitor_id
 *   blob10=utm_source blob11=utm_medium blob12=utm_campaign
 *   double1=1 (count)
 */

interface Env {
  ANALYTICS: AnalyticsEngineDataset;
  SALT_KV: KVNamespace;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Known bots/crawlers/preview-fetchers/tools — not counted as visitors.
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|pinterest|vkshare|w3c_validator|whatsapp|telegram|headless|lighthouse|gtmetrix|pagespeed|curl|wget|python-requests|axios|go-http|java\/|okhttp|scrapy|phantomjs|ahrefs|semrush|mj12bot|dotbot|applebot/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    if (url.pathname === "/script.js") return serveScript();
    if (url.pathname === "/event" && request.method === "POST") {
      return handleEvent(request, env);
    }
    return new Response("Not found", { status: 404, headers: CORS });
  },
};

// ── Tracking script ───────────────────────────────────────────────────────────
function serveScript(): Response {
  // Minified-ish, dependency-free. Derives its own endpoint from the script src,
  // so the same Worker can be reached at any hostname. Tracks the initial
  // pageview plus client-side (SPA) route changes via the History API.
  // Sends a non-credentialed text/plain POST: no cookies (cookieless) and a
  // CORS "simple request", so there's no preflight and wildcard ACAO is valid.
  // `keepalive` lets it survive the page unload like sendBeacon would.
  const js = `(function(){
  var s=document.currentScript;if(!s)return;
  var site=s.getAttribute("data-site");if(!site)return;
  var endpoint=new URL(s.src).origin+"/event";
  function send(type){try{
    var q=new URLSearchParams(location.search);
    var body=JSON.stringify({s:site,e:type||"pageview",p:location.pathname,h:location.hostname,r:document.referrer||"",w:screen.width||0,
      utm_source:q.get("utm_source")||"",utm_medium:q.get("utm_medium")||"",utm_campaign:q.get("utm_campaign")||""});
    fetch(endpoint,{method:"POST",body:body,mode:"cors",credentials:"omit",keepalive:true,headers:{"Content-Type":"text/plain"}});
  }catch(e){}}
  send("pageview");
  var last=location.pathname;
  function nav(){if(location.pathname!==last){last=location.pathname;send("pageview");}}
  var p=history.pushState;history.pushState=function(){p.apply(this,arguments);nav();};
  addEventListener("popstate",nav);
})();`;
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // 1h cache: short enough to roll out script changes quickly, long enough
      // to keep request volume (and cost) down.
      "Cache-Control": "public, max-age=3600",
      ...CORS,
    },
  });
}

// ── Event ingestion ─────────────────────────────────────────────────────────--
async function handleEvent(request: Request, env: Env): Promise<Response> {
  const ua = request.headers.get("user-agent") || "";
  // Silently accept bot traffic (200 so the client doesn't retry) but don't store.
  if (BOT_RE.test(ua)) return noContent();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noContent();
  }

  const site = str(body.s, 64);
  if (!site) return noContent();

  const hostname = str(body.h, 255);
  const path = normalizePath(str(body.p, 1024) || "/");
  const referrer = str(body.r, 1024);
  const cf = request.cf;
  const country = (cf?.country as string | undefined) || "XX";
  const city = (cf?.city as string | undefined) || "";
  const lat = Number(cf?.latitude) || 0;
  const lng = Number(cf?.longitude) || 0;
  const ip = request.headers.get("cf-connecting-ip") || "";

  const salt = await getDailySalt(env);
  const visitorId = await sha256hex(`${salt}:${site}:${ip}:${ua}`);
  const { device, browser, os } = parseUA(ua);

  env.ANALYTICS.writeDataPoint({
    indexes: [site],
    blobs: [
      str(body.e, 64) || "pageview", // blob1 event_type
      path, // blob2
      hostname, // blob3
      referrerHost(referrer, hostname), // blob4
      country, // blob5
      device, // blob6
      browser, // blob7
      os, // blob8
      visitorId, // blob9
      str(body.utm_source, 255), // blob10
      str(body.utm_medium, 255), // blob11
      str(body.utm_campaign, 255), // blob12
      city, // blob13
    ],
    doubles: [1, lat, lng], // double1 count · double2 lat · double3 lng
  });

  return noContent();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function noContent(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function normalizePath(p: string): string {
  // Drop any accidental query/hash, collapse trailing slash (except root).
  const clean = p.split(/[?#]/)[0];
  return clean.length > 1 ? clean.replace(/\/+$/, "") || "/" : clean;
}

function referrerHost(referrer: string, selfHost: string): string {
  if (!referrer) return "(direct)";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host === selfHost.replace(/^www\./, "")) return "(direct)"; // internal nav
    return host;
  } catch {
    return "(direct)";
  }
}

// Per-isolate cache so we hit KV at most once per day, not per request.
let cachedSalt: { date: string; value: string } | null = null;

async function getDailySalt(env: Env): Promise<string> {
  const date = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  if (cachedSalt && cachedSalt.date === date) return cachedSalt.value;

  const key = `salt:${date}`;
  let value = await env.SALT_KV.get(key);
  if (!value) {
    value = crypto.randomUUID() + crypto.randomUUID();
    // 48h TTL: yesterday's salt lingers briefly, then is gone for good, so
    // visitor ids can't be linked across days.
    await env.SALT_KV.put(key, value, { expirationTtl: 60 * 60 * 48 });
  }
  cachedSalt = { date, value };
  return value;
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function parseUA(ua: string): { device: string; browser: string; os: string } {
  const u = ua.toLowerCase();

  let device = "desktop";
  if (/ipad|tablet|playbook|silk/.test(u) || (/android/.test(u) && !/mobile/.test(u))) {
    device = "tablet";
  } else if (/mobi|iphone|ipod|windows phone/.test(u)) {
    device = "mobile";
  }

  // Order matters: Edge/Opera UAs contain "chrome"; Chrome contains "safari".
  let browser = "Other";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera/.test(u)) browser = "Opera";
  else if (/chrome|crios/.test(u)) browser = "Chrome";
  else if (/firefox|fxios/.test(u)) browser = "Firefox";
  else if (/safari/.test(u)) browser = "Safari";

  let os = "Other";
  if (/windows/.test(u)) os = "Windows";
  else if (/iphone|ipad|ipod/.test(u)) os = "iOS";
  else if (/mac os x|macintosh/.test(u)) os = "macOS";
  else if (/android/.test(u)) os = "Android";
  else if (/linux/.test(u)) os = "Linux";

  return { device, browser, os };
}
