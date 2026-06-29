const EARTH_MILES = 3958.8;

export const QUALIFIED_HEADERS = [
  "prospect_id",
  "business_name",
  "full_address",
  "category",
  "estimated_distance_miles",
  "access_type",
  "ask_for",
  "notes",
  "sources",
  "source_type",
  "google_place_id",
  "google_maps_url",
  "latitude",
  "longitude",
  "rep_status",
  "shared_approval",
  "recommendation_for_anthony",
  "max_radius_miles",
  "is_generic_place",
  "quality_status"
];

export const CATEGORY_PRIORITY = [
  "Auto",
  "Tire",
  "Oil Change",
  "Car Wash",
  "Barber",
  "Salon",
  "Restaurant",
  "Apartment",
  "Medical Office",
  "Dental Office",
  "Business Services",
  "Small Retail",
  "Local Employer",
  "Other Storefront",
  "Event"
];

export function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(records, headers = QUALIFIED_HEADERS) {
  return [headers.join(","), ...records.map(record => headers.map(header => csvCell(record[header])).join(","))].join("\n") + "\n";
}

export function distanceMiles(origin, destination) {
  const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
  const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
  const lat1 = origin.latitude * Math.PI / 180;
  const lat2 = destination.latitude * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function miles(record) {
  const value = Number(record.estimated_distance_miles);
  return Number.isFinite(value) ? value : 999;
}

export function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function hasNormalizedPhrase(text, term) {
  const normalizedText = ` ${normalizeText(text)} `;
  const normalizedTerm = normalizeText(term);
  return Boolean(normalizedTerm) && normalizedText.includes(` ${normalizedTerm} `);
}

export function isGenericOrRestricted(record, config) {
  const text = `${record.business_name} ${record.full_address} ${record.notes}`;
  const name = normalizeText(record.business_name);
  const blockedExactNames = (config.blocked_exact_names || []).map(normalizeText);
  const blockedNames = config.blocked_names || [];
  const blockedTerms = config.blocked_generic_terms || [];
  if (blockedExactNames.some(term => term && name === term)) return true;
  return [...blockedNames, ...blockedTerms].some(term => hasNormalizedPhrase(text, term));
}

export function isQualifiedForAnthony(record, config) {
  if (!record.business_name || !record.full_address) return false;
  if (record.quality_status !== "verified") return false;
  if (record.source_type !== "Google Places API") return false;
  if (record.rep_status !== "Anthony unvisited") return false;
  if (record.recommendation_for_anthony !== "yes") return false;
  if (record.access_type === "Do not recommend") return false;
  if (isGenericOrRestricted(record, config) && record.access_type !== "Event-based") return false;
  if (miles(record) > Number(config.base_location?.max_radius_miles || 20)) return false;
  return true;
}

export function scoreProspect(record, options = {}) {
  const recentNames = new Set((options.recentNames || []).map(normalizeText));
  const successfulDiscoveryNames = new Set((options.successfulDiscoveryNames || []).map(normalizeText));
  const name = normalizeText(record.business_name);
  const distance = miles(record);
  const categoryIndex = CATEGORY_PRIORITY.indexOf(record.category);
  const categoryScore = categoryIndex >= 0 ? Math.max(0, CATEGORY_PRIORITY.length - categoryIndex) : 4;

  let score = 0;
  score += record.access_type === "Walk-in ready" ? 40 : 0;
  score += record.access_type === "Event-based" ? 20 : 0;
  score += categoryScore * 2;
  score += Math.max(0, 25 - distance);
  score += recentNames.has(name) ? -45 : 18;
  score += successfulDiscoveryNames.has(name) ? 20 : 0;
  score += Number(record.is_generic_place === "yes" ? -30 : 8);
  return Number(score.toFixed(2));
}

export function recommendationReason(record, score) {
  const distance = Number(miles(record).toFixed(1));
  const access = record.access_type === "Walk-in ready" ? "walk-in ready" : record.access_type.toLowerCase();
  return `${record.business_name} is a ${access} ${record.category.toLowerCase()} prospect ${distance} miles from the base. Ask for the ${record.ask_for}. Route score: ${score}.`;
}

export function diverseRoute(records, limit, options = {}) {
  const selected = [];
  const categoryCounts = new Map();
  const maxPerCategoryFirstPass = options.maxPerCategoryFirstPass || 1;
  const maxPerCategorySecondPass = options.maxPerCategorySecondPass || 2;

  function add(record, maxPerCategory) {
    if (selected.length >= limit || selected.includes(record)) return;
    const count = categoryCounts.get(record.category) || 0;
    if (count >= maxPerCategory) return;
    selected.push(record);
    categoryCounts.set(record.category, count + 1);
  }

  records.forEach(record => add(record, maxPerCategoryFirstPass));
  records.forEach(record => add(record, maxPerCategorySecondPass));
  records.forEach(record => {
    if (selected.length < limit && !selected.includes(record)) selected.push(record);
  });
  return selected;
}

export function buildAnthonyRoutePreview(records, config, options = {}) {
  const qualified = records.filter(record => isQualifiedForAnthony(record, config));
  const preferredRadius = Number(config.base_location?.preferred_first_route_radius_miles || 10);
  const expandedRadius = Number(config.base_location?.expanded_route_radius_miles || 15);
  const maxRadius = Number(config.base_location?.max_radius_miles || 20);
  const insidePreferred = qualified.filter(record => miles(record) <= preferredRadius);
  const insideExpanded = qualified.filter(record => miles(record) <= expandedRadius);
  const pool = insidePreferred.length >= 25 ? insidePreferred : insideExpanded.length >= 25 ? insideExpanded : qualified.filter(record => miles(record) <= maxRadius);

  const ranked = pool
    .map(record => ({ record, score: scoreProspect(record, options) }))
    .sort((a, b) => b.score - a.score)
    .map(({ record, score }) => ({ ...record, route_score: score, why_this_stop: recommendationReason(record, score) }));

  const topRouteLimit = Number(config.rep?.top_route_limit || 10);
  const backupRouteLimit = Number(config.rep?.backup_route_limit || 25);
  const topRoute = diverseRoute(ranked, topRouteLimit);
  const topKeys = new Set(topRoute.map(record => `${record.google_place_id || record.business_name}|${record.full_address}`));
  const remaining = ranked.filter(record => !topKeys.has(`${record.google_place_id || record.business_name}|${record.full_address}`));
  const backupRoute = diverseRoute(remaining, backupRouteLimit);
  const backupKeys = new Set(backupRoute.map(record => `${record.google_place_id || record.business_name}|${record.full_address}`));
  const discoveryQueue = remaining.filter(record => !backupKeys.has(`${record.google_place_id || record.business_name}|${record.full_address}`));

  return {
    qualified_count: qualified.length,
    route_pool_count: pool.length,
    route_pool_radius_miles: insidePreferred.length >= 25 ? preferredRadius : insideExpanded.length >= 25 ? expandedRadius : maxRadius,
    top_10_route: topRoute,
    backup_25_route: backupRoute,
    discovery_queue: discoveryQueue
  };
}
