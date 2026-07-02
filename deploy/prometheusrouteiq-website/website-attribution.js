const ATTRIBUTION_VERSION = "prometheus-website-attribution.v1";
const FIRST_TOUCH_KEY = "prometheus.website.attribution.firstTouch";
const SESSION_KEY = "prometheus.website.attribution.session";
const EVENT_LOG_KEY = "prometheus.website.attribution.events";
const MAX_EVENTS = 20;

const SOCIAL_HOSTS = Object.freeze({
  instagram: ["instagram.com", "l.instagram.com"],
  facebook: ["facebook.com", "fb.com", "lm.facebook.com", "m.facebook.com"],
  linkedin: ["linkedin.com", "lnkd.in"],
  x: ["x.com", "twitter.com", "t.co"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"]
});

const TRACKED_PARAMS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "campaign_id",
  "campaign_platform"
]);

function safeNowIso(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function storageGet(storage, key) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function storageSet(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Attribution should never break the public website experience.
  }
}

function randomId(prefix = "id") {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `${prefix}_${[...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeUrl(value) {
  try {
    return new URL(String(value));
  } catch {
    return null;
  }
}

function sameHost(url, host) {
  return url?.hostname && host && url.hostname.replace(/^www\./, "") === host.replace(/^www\./, "");
}

function socialProviderFromHost(hostname = "") {
  const normalized = hostname.replace(/^www\./, "").toLowerCase();
  for (const [provider, hosts] of Object.entries(SOCIAL_HOSTS)) {
    if (hosts.some(host => normalized === host || normalized.endsWith(`.${host}`))) return provider;
  }
  return null;
}

function socialProviderFromSource(source = "") {
  const normalized = source.toLowerCase();
  if (normalized.includes("instagram") || normalized === "ig") return "instagram";
  if (normalized.includes("facebook") || normalized === "fb") return "facebook";
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized === "x" || normalized.includes("twitter")) return "x";
  if (normalized.includes("tiktok")) return "tiktok";
  if (normalized.includes("youtube")) return "youtube";
  return null;
}

function trackedParams(searchParams) {
  return Object.fromEntries(TRACKED_PARAMS.map(key => [
    key,
    normalizeText(searchParams.get(key), 220)
  ]).filter(([, value]) => value));
}

function sanitizedLandingUrl(locationUrl) {
  const url = safeUrl(locationUrl);
  if (!url) return "";
  const safe = new URL(`${url.origin}${url.pathname}`);
  for (const key of TRACKED_PARAMS) {
    const value = normalizeText(url.searchParams.get(key), 220);
    if (value) safe.searchParams.set(key, value);
  }
  return safe.toString();
}

function referrerInfo(referrer, currentHost) {
  const url = safeUrl(referrer);
  if (!url || sameHost(url, currentHost)) {
    return {
      referrer: "",
      referrerHost: "",
      referrerProvider: null
    };
  }

  return {
    referrer: `${url.origin}${url.pathname}`.slice(0, 500),
    referrerHost: url.hostname.replace(/^www\./, ""),
    referrerProvider: socialProviderFromHost(url.hostname)
  };
}

export function createWebsiteAttributionSession({
  locationHref,
  referrer = "",
  localStorage,
  sessionStorage,
  now = new Date()
} = {}) {
  const url = safeUrl(locationHref);
  const occurredAt = safeNowIso(now);
  const params = trackedParams(url?.searchParams || new URLSearchParams());
  const source = params.utm_source || params.campaign_platform || "";
  const provider = socialProviderFromSource(source) || referrerInfo(referrer, url?.hostname).referrerProvider;
  const campaignId = params.utm_campaign || params.campaign_id || null;
  const existingVisitor = storageGet(localStorage, FIRST_TOUCH_KEY);
  const visitorId = existingVisitor?.visitorId || randomId("web_visitor");
  const sessionId = randomId("web_session");
  const referrerData = referrerInfo(referrer, url?.hostname);
  const landingPath = `${url?.pathname || "/"}${url?.hash || ""}`;
  const hasCampaignSignal = Boolean(params.utm_source || params.utm_medium || campaignId);
  const hasSocialSignal = Boolean(provider || referrerData.referrerHost);

  const event = {
    id: randomId("website_visit"),
    type: "website_visit",
    target: "website_traffic",
    source: "website_contract",
    provider,
    campaignId,
    occurredAt,
    visitorId,
    value: 0,
    confidence: hasCampaignSignal ? 1 : hasSocialSignal ? 0.65 : 0.15,
    metadata: {
      attribution_version: ATTRIBUTION_VERSION,
      session_id: sessionId,
      utm_source: params.utm_source || "",
      utm_medium: params.utm_medium || "",
      utm_campaign: params.utm_campaign || "",
      utm_content: params.utm_content || "",
      utm_term: params.utm_term || "",
      campaign_id: params.campaign_id || "",
      campaign_platform: params.campaign_platform || "",
      landing_path: landingPath,
      landing_url: sanitizedLandingUrl(locationHref),
      referrer: referrerData.referrer,
      referrer_host: referrerData.referrerHost,
      source_detected: provider || "direct_or_unknown"
    }
  };

  const session = {
    version: ATTRIBUTION_VERSION,
    visitorId,
    sessionId,
    startedAt: occurredAt,
    firstTouch: existingVisitor?.firstTouch || event,
    currentTouch: event
  };

  storageSet(localStorage, FIRST_TOUCH_KEY, {
    version: ATTRIBUTION_VERSION,
    visitorId,
    firstTouch: session.firstTouch
  });
  storageSet(sessionStorage, SESSION_KEY, session);

  const events = storageGet(localStorage, EVENT_LOG_KEY);
  const nextEvents = Array.isArray(events) ? events : [];
  nextEvents.push(event);
  storageSet(localStorage, EVENT_LOG_KEY, nextEvents.slice(-MAX_EVENTS));

  return session;
}

export function readWebsiteAttribution(storage = globalThis.localStorage) {
  const events = storageGet(storage, EVENT_LOG_KEY);
  return Array.isArray(events) ? events : [];
}

export function initializeWebsiteAttribution({
  windowRef = globalThis.window,
  documentRef = globalThis.document
} = {}) {
  if (!windowRef?.location || !documentRef) return null;
  const session = createWebsiteAttributionSession({
    locationHref: windowRef.location.href,
    referrer: documentRef.referrer,
    localStorage: windowRef.localStorage,
    sessionStorage: windowRef.sessionStorage
  });

  windowRef.prometheusWebsiteAttribution = Object.freeze({
    version: ATTRIBUTION_VERSION,
    getSession: () => session,
    getEvents: () => readWebsiteAttribution(windowRef.localStorage)
  });

  return session;
}
