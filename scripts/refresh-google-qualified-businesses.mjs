import fs from "node:fs";
import path from "node:path";
import {
  QUALIFIED_HEADERS,
  distanceMiles,
  isGenericOrRestricted,
  normalizeText,
  toCsv
} from "./lib/qualified-prospect-routing.mjs";

const DEFAULT_CONFIG = "data/qualified-prospects/google-discovery-config.json";
const DEFAULT_EXISTING = "data/qualified-prospects/google-discovered-prospects.csv";
const DEFAULT_VERSION = "google-qualified-businesses-v2";
const GEOCODING_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PLACES_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
  "places.googleMapsUri",
  "nextPageToken"
].join(",");
const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "types",
  "businessStatus",
  "googleMapsUri"
].join(",");

const RUNTIME_HEADERS = [
  "id",
  "repProfileId",
  "seedRouteOrder",
  "name",
  "category",
  "window",
  "distance",
  "priority",
  "address",
  "latitude",
  "longitude",
  "permission",
  "accessType",
  "askFor",
  "googlePlaceId",
  "googleMapsUrl",
  "sourceType",
  "qualityClass",
  "qualityScore",
  "confidence",
  "expectedVisitDuration",
  "expectedRoi",
  "decisionMakerAvailability",
  "expectedConversationOpportunity",
  "qualityReason",
  "truthBasis",
  "notes"
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const configPath = readArg("--config") || DEFAULT_CONFIG;
const existingPath = readArg("--existing") || DEFAULT_EXISTING;
const version = readArg("--version") || DEFAULT_VERSION;
const outputRoot = readArg("--output-dir") || `data/qualified-prospects/${version}`;

function readArg(prefix) {
  const match = process.argv.slice(2).find(arg => arg.startsWith(`${prefix}=`));
  return match ? match.slice(prefix.length + 1) : "";
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
  }
  return rows;
}

function toRecords(csvText) {
  const [headers, ...rows] = parseCsv(csvText);
  if (!headers?.length) return [];
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

async function googleFetch(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${body.error?.message || body.status || "unknown error"}`);
  }
  return body;
}

async function geocodeAddress(apiKey, address) {
  const url = new URL(GEOCODING_ENDPOINT);
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  const body = await googleFetch(url, { method: "GET" }, "Geocoding API");
  if (body.status !== "OK" || !body.results?.[0]?.geometry?.location) {
    throw new Error(`Geocoding API returned ${body.status || "no status"} for base address.`);
  }
  const location = body.results[0].geometry.location;
  return {
    latitude: location.lat,
    longitude: location.lng,
    formatted_address: body.results[0].formatted_address
  };
}

async function placeDetails(apiKey, placeId) {
  const url = `${PLACES_DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`;
  return googleFetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAIL_FIELD_MASK
    }
  }, `Places Details (${placeId})`);
}

async function searchPlaces(apiKey, query, baseLocation, pageToken = "") {
  const body = {
    textQuery: query.text,
    pageSize: 20,
    locationBias: {
      circle: {
        center: {
          latitude: baseLocation.latitude,
          longitude: baseLocation.longitude
        },
        radius: Number(baseLocation.max_radius_miles || 25) * 1609.344
      }
    }
  };
  if (pageToken) body.pageToken = pageToken;

  return googleFetch(PLACES_TEXT_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify(body)
  }, `Places Text Search (${query.category})`);
}

async function searchAllPages(apiKey, query, baseLocation) {
  const collected = [];
  let pageToken = "";
  for (let page = 0; page < 3; page += 1) {
    if (pageToken) await new Promise(resolve => setTimeout(resolve, 2100));
    const result = await searchPlaces(apiKey, query, baseLocation, pageToken);
    collected.push(...(result.places || []));
    pageToken = result.nextPageToken || "";
    if (!pageToken) break;
  }
  return collected;
}

function categoryFromPlace(place, fallbackCategory) {
  const types = new Set(place.types || []);
  const primary = place.primaryType || "";
  if (types.has("car_repair") || primary === "car_repair") return "Auto";
  if (types.has("car_wash") || primary === "car_wash") return "Car Wash";
  if (types.has("restaurant") || types.has("meal_takeaway") || types.has("cafe") || primary === "restaurant") return "Restaurant";
  if (types.has("dentist") || primary === "dentist") return "Dental Office";
  if (types.has("doctor") || types.has("medical_lab") || types.has("physiotherapist") || primary === "doctor") return "Medical Office";
  if (types.has("beauty_salon") || primary === "beauty_salon") return "Salon";
  if (types.has("hair_care") || primary === "hair_care") return "Barber";
  return fallbackCategory || "Other Storefront";
}

function isGenericPlace(place) {
  const types = new Set(place.types || []);
  return [
    "shopping_mall",
    "airport",
    "university",
    "school",
    "hospital",
    "local_government_office"
  ].some(type => types.has(type));
}

function recordFromPlace(place, query, config, baseLocation, existing = null) {
  const name = place.displayName?.text || existing?.business_name || "";
  const address = place.formattedAddress || existing?.full_address || "";
  const latitude = place.location?.latitude ?? existing?.latitude ?? "";
  const longitude = place.location?.longitude ?? existing?.longitude ?? "";
  const category = categoryFromPlace(place, existing?.category || query?.category);
  const hasCoords = latitude !== "" && longitude !== "";
  const miles = hasCoords ? distanceMiles(baseLocation, { latitude: Number(latitude), longitude: Number(longitude) }) : 999;
  const googlePlaceId = place.id || existing?.google_place_id || "";
  const record = {
    prospect_id: existing?.prospect_id || (googlePlaceId ? `GOOGLE-${googlePlaceId}` : `GOOGLE-${name}-${address}`),
    business_name: name,
    full_address: address,
    category,
    estimated_distance_miles: Number(miles.toFixed(1)),
    access_type: existing?.access_type === "Do not recommend" ? "Walk-in ready" : existing?.access_type || "Walk-in ready",
    ask_for: existing?.ask_for || query?.ask_for || "manager",
    notes: "Google Places verified storefront candidate. Verify hours and site rules before outreach.",
    sources: "Google Places API Refresh Engine",
    source_type: "Google Places API",
    google_place_id: googlePlaceId,
    google_maps_url: place.googleMapsUri || existing?.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`,
    latitude,
    longitude,
    rep_status: existing?.rep_status || config.rep?.status || "Anthony unvisited",
    shared_approval: existing?.shared_approval || "pending",
    recommendation_for_anthony: existing?.recommendation_for_anthony || "yes",
    max_radius_miles: config.base_location?.max_radius_miles || 25,
    is_generic_place: isGenericPlace(place) ? "yes" : existing?.is_generic_place || "no",
    quality_status: name && address && hasCoords && googlePlaceId && place.businessStatus !== "CLOSED_PERMANENTLY" ? "verified" : "needs review",
    business_status: place.businessStatus || existing?.business_status || "OPERATIONAL"
  };

  const restricted = isGenericOrRestricted(record, config) || record.is_generic_place === "yes";
  if (restricted) {
    record.access_type = "Do not recommend";
    record.recommendation_for_anthony = "no";
    record.notes = "Excluded by solicitation suitability or generic-location filter.";
  }
  if (miles > Number(config.base_location?.max_radius_miles || 25)) {
    record.access_type = "Do not recommend";
    record.recommendation_for_anthony = "no";
    record.notes = "Outside maximum refresh radius.";
  }
  return record;
}

function hasNumberedStreetAddress(record) {
  return /(?:^|,\s*)\d+[a-z]?\s+[a-z0-9]/i.test(String(record.full_address || ""));
}

function isGoogleMapsSafe(record) {
  return /^https:\/\/((www\.)?google\.[^/]+\/maps\/|maps\.google\.[^/]+\/|maps\.app\.goo\.gl\/)/i.test(String(record.google_maps_url || ""));
}

function gateFailures(record, config) {
  const failures = [];
  if (!record.google_place_id) failures.push("missing_place_id");
  if (!hasNumberedStreetAddress(record)) failures.push("missing_numbered_address");
  if (!record.business_name || /^\d+[a-z]?\s+/i.test(record.business_name)) failures.push("invalid_business_name");
  if (!isGoogleMapsSafe(record)) failures.push("unsafe_maps_url");
  if (record.source_type !== "Google Places API") failures.push("not_google_places_source");
  if (record.quality_status !== "verified") failures.push("not_verified");
  if (record.access_type === "Do not recommend") failures.push("do_not_recommend");
  if (record.is_generic_place === "yes" || isGenericOrRestricted(record, config)) failures.push("generic_or_restricted");
  if (record.business_status === "CLOSED_PERMANENTLY") failures.push("closed_permanently");
  return failures;
}

function qualityScore(record) {
  const categoryScores = {
    Barber: 96,
    Salon: 92,
    Auto: 90,
    "Car Wash": 90,
    "Small Retail": 84,
    Restaurant: 80,
    "Other Storefront": 76,
    "Business Services": 64,
    Apartment: 58,
    "Medical Office": 42,
    "Dental Office": 40
  };
  const base = categoryScores[record.category] || 70;
  const distancePenalty = Math.min(22, Number(record.estimated_distance_miles || 0) * 1.2);
  return Number(Math.max(1, base - distancePenalty).toFixed(1));
}

function qualityClass(score) {
  if (score >= 84) return "Excellent";
  if (score >= 74) return "Good";
  if (score >= 60) return "Average";
  if (score >= 45) return "Poor";
  return "Never Visit";
}

function toRuntimePlace(record, index, profileId) {
  const score = qualityScore(record);
  const classification = qualityClass(score);
  const distance = Number(record.estimated_distance_miles || 0);
  const confidence = classification === "Excellent" ? "High" : classification === "Good" ? "Medium-High" : classification === "Average" ? "Medium" : "Low";
  const reason = `${record.business_name} is a ${record.category.toLowerCase()} candidate ${distance.toFixed(1)} miles from base with verified Google Place ID, numbered address, and safe Maps directions. Quality score: ${score}.`;
  return {
    id: `${profileId}-google-${index + 1}-${normalizeText(record.google_place_id).slice(0, 32)}`,
    repProfileId: profileId,
    seedRouteOrder: index + 1,
    name: record.business_name,
    category: record.category === "Other Storefront" ? "Retail" : record.category,
    window: "Midday",
    distance: `${distance.toFixed(1)} mi`,
    priority: Math.max(1, Math.min(100, Math.round(score))),
    address: record.full_address,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    permission: "Unknown",
    accessType: record.access_type,
    askFor: record.ask_for || "manager",
    googlePlaceId: record.google_place_id,
    googleMapsUrl: record.google_maps_url,
    sourceType: "Google Places API",
    qualityClass: classification,
    qualityScore: score,
    confidence,
    expectedVisitDuration: classification === "Excellent" ? "6-9" : classification === "Good" ? "8-10" : "10-14",
    expectedRoi: ["Excellent", "Good"].includes(classification) ? "Field-validation candidate." : "Backup only.",
    decisionMakerAvailability: ["Excellent", "Good"].includes(classification) ? "Likely enough for first-route outreach." : "Requires field validation.",
    expectedConversationOpportunity: ["Barber", "Salon", "Auto", "Car Wash", "Restaurant", "Small Retail"].includes(record.category)
      ? "Strong chance for a short face-to-face manager or shift-lead conversation."
      : "Possible conversation; validate in field before increasing rank.",
    qualityReason: reason,
    truthBasis: "Verified by Google for name, address, location, and Place ID. Conversation quality and ROI are inferred and require field validation.",
    notes: `${reason} Verified offline by Prometheus Data refresh engine.`
  };
}

function dedupeRecords(records) {
  const seen = new Set();
  const duplicates = [];
  const output = [];
  for (const record of records) {
    const key = record.google_place_id || normalizeText(`${record.business_name} ${record.full_address}`);
    if (seen.has(key)) {
      duplicates.push(record);
      continue;
    }
    seen.add(key);
    output.push(record);
  }
  return { output, duplicates };
}

function selectPool(records, radiusMiles, profileId) {
  const order = profileId === "cruz"
    ? ["Auto", "Car Wash", "Restaurant", "Small Retail", "Barber", "Salon", "Other Storefront", "Business Services", "Apartment"]
    : ["Barber", "Salon", "Restaurant", "Small Retail", "Car Wash", "Auto", "Other Storefront", "Business Services", "Apartment"];
  const eligible = records
    .filter(record => Number(record.estimated_distance_miles) <= radiusMiles)
    .sort((a, b) => qualityScore(b) - qualityScore(a) || Number(a.estimated_distance_miles) - Number(b.estimated_distance_miles));
  const selected = [];
  const selectedIds = new Set();
  for (let round = 0; selected.length < eligible.length && round < 100; round += 1) {
    let added = false;
    for (const category of order) {
      const record = eligible.find(item => item.category === category && !selectedIds.has(item.google_place_id));
      if (!record) continue;
      selected.push(record);
      selectedIds.add(record.google_place_id);
      added = true;
    }
    if (!added) break;
  }
  for (const record of eligible) {
    if (selectedIds.has(record.google_place_id)) continue;
    selected.push(record);
    selectedIds.add(record.google_place_id);
  }
  return selected;
}

function countBy(records, field) {
  return records.reduce((acc, record) => {
    const key = record[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildMarkdownReport(report, files) {
  return `# Google Places Refresh Engine v1 Audit

Generated: ${report.generated_at}
Dataset: ${report.dataset_version}

## Audit Summary

- Existing records loaded: ${report.audit.existing_records_loaded}
- Existing records refreshed by Place ID: ${report.audit.existing_records_refreshed}
- New discovered records added: ${report.audit.new_businesses_added}
- Addresses updated: ${report.audit.addresses_updated}
- Place IDs updated or recovered: ${report.audit.place_ids_updated}
- Permanently closed businesses removed: ${report.quality.closed_businesses_removed}
- Duplicate records removed: ${report.quality.duplicates_removed}

## Quality Report

- Total discovered: ${report.quality.total_discovered}
- Verified: ${report.quality.verified}
- Rejected: ${report.quality.rejected}
- Missing addresses: ${report.quality.missing_addresses}
- Missing Place IDs: ${report.quality.missing_place_ids}
- Closed businesses removed: ${report.quality.closed_businesses_removed}
- Final production candidate count: ${report.quality.final_production_candidate_count}
- Founder 15-mile production pool: ${report.production_pools.founder_15_miles}
- Anthony 25-mile production pool: ${report.production_pools.anthony_25_miles}

## Quality Gates

${Object.entries(report.quality.gate_failures).map(([gate, count]) => `- ${gate}: ${count}`).join("\n")}

## Files

${files.map(file => `- ${file}`).join("\n")}

## Runtime Google API Verification

Run:

\`\`\`bash
npm run verify:zero-google-api
\`\`\`
`;
}

async function main() {
  loadEnvFile(path.resolve(".env"));
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.base_location.max_radius_miles = Math.max(Number(config.base_location.max_radius_miles || 0), 25);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY is missing from local .env.");
  }

  if (fs.existsSync(outputRoot) && !force) {
    throw new Error(`${outputRoot} already exists. Pass --force to regenerate this version or choose --version=google-qualified-businesses-vN.`);
  }
  if (dryRun) {
    console.log(JSON.stringify({
      status: "ready",
      mode: "dry-run",
      api_key_present: true,
      outputRoot,
      note: "Dry run did not call Google APIs."
    }, null, 2));
    return;
  }

  const existing = fs.existsSync(existingPath) ? toRecords(fs.readFileSync(existingPath, "utf8")) : [];
  const geocoded = await geocodeAddress(apiKey, config.base_location.address);
  const baseLocation = {
    ...config.base_location,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude
  };

  const refreshed = [];
  const audit = {
    existing_records_loaded: existing.length,
    existing_records_refreshed: 0,
    new_businesses_added: 0,
    addresses_updated: 0,
    place_ids_updated: 0,
    existing_place_detail_failures: 0,
    preserved_existing_business_ids: 0
  };

  for (const record of existing) {
    if (!record.google_place_id) continue;
    try {
      const place = await placeDetails(apiKey, record.google_place_id);
      const refreshedRecord = recordFromPlace(place, null, config, baseLocation, record);
      if (record.prospect_id && refreshedRecord.prospect_id === record.prospect_id) audit.preserved_existing_business_ids += 1;
      if (record.full_address && refreshedRecord.full_address && record.full_address !== refreshedRecord.full_address) audit.addresses_updated += 1;
      if (record.google_place_id && refreshedRecord.google_place_id && record.google_place_id !== refreshedRecord.google_place_id) audit.place_ids_updated += 1;
      audit.existing_records_refreshed += 1;
      refreshed.push(refreshedRecord);
    } catch {
      audit.existing_place_detail_failures += 1;
      refreshed.push({ ...record, business_status: "DETAIL_REFRESH_FAILED" });
    }
  }

  const discovered = [];
  const queryReports = [];
  for (const query of config.queries) {
    const places = await searchAllPages(apiKey, query, baseLocation);
    queryReports.push({ category: query.category, text: query.text, returned: places.length });
    for (const place of places) {
      discovered.push(recordFromPlace(place, query, config, baseLocation));
    }
  }

  const existingPlaceIds = new Set(refreshed.map(record => record.google_place_id).filter(Boolean));
  for (const record of discovered) {
    if (!existingPlaceIds.has(record.google_place_id)) audit.new_businesses_added += 1;
  }

  const allCandidates = refreshed.concat(discovered);
  const { output: deduped, duplicates } = dedupeRecords(allCandidates);
  const closed = deduped.filter(record => record.business_status === "CLOSED_PERMANENTLY");
  const openOrUnknown = deduped.filter(record => record.business_status !== "CLOSED_PERMANENTLY");
  const gateFailureCounts = {};
  const rejected = [];
  const production = [];

  for (const record of openOrUnknown) {
    const failures = gateFailures(record, config);
    if (failures.length) {
      rejected.push({ ...record, rejection_reasons: failures });
      failures.forEach(failure => {
        gateFailureCounts[failure] = (gateFailureCounts[failure] || 0) + 1;
      });
    } else {
      production.push(record);
    }
  }

  const founderPool = selectPool(production, 15, "cruz");
  const anthonyPool = selectPool(production, 25, "anthony");
  const runtimeFounder = founderPool.map((record, index) => toRuntimePlace(record, index, "cruz"));
  const runtimeAnthony = anthonyPool.map((record, index) => toRuntimePlace(record, index, "anthony"));
  const outputFiles = {
    production_csv: path.join(outputRoot, `${version}.csv`),
    production_json: path.join(outputRoot, `${version}.json`),
    founder_pool_json: path.join(outputRoot, "founder-15-mile-pool.json"),
    anthony_pool_json: path.join(outputRoot, "anthony-25-mile-pool.json"),
    runtime_pools_json: path.join(outputRoot, "runtime-pools.json"),
    rejected_json: path.join(outputRoot, "rejected-records.json"),
    quality_report_json: path.join(outputRoot, "quality-report.json"),
    audit_summary_md: path.join(outputRoot, "audit-summary.md")
  };

  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(outputFiles.production_csv, toCsv(production, QUALIFIED_HEADERS));
  writeJson(outputFiles.production_json, {
    generated_at: new Date().toISOString(),
    dataset_version: version,
    base_location: baseLocation,
    production_candidates: production
  });
  writeJson(outputFiles.founder_pool_json, {
    generated_at: new Date().toISOString(),
    dataset_version: version,
    profile: "Founder",
    radius_miles: 15,
    count: founderPool.length,
    candidates: founderPool
  });
  writeJson(outputFiles.anthony_pool_json, {
    generated_at: new Date().toISOString(),
    dataset_version: version,
    profile: "Anthony",
    radius_miles: 25,
    count: anthonyPool.length,
    candidates: anthonyPool
  });
  writeJson(outputFiles.runtime_pools_json, {
    generated_at: new Date().toISOString(),
    dataset_version: version,
    headers: RUNTIME_HEADERS,
    cruz: runtimeFounder,
    anthony: runtimeAnthony
  });
  writeJson(outputFiles.rejected_json, {
    generated_at: new Date().toISOString(),
    dataset_version: version,
    count: rejected.length,
    rejected,
    closed_removed: closed
  });

  const report = {
    generated_at: new Date().toISOString(),
    dataset_version: version,
    mode: "offline-batch-google-api",
    config_file: configPath,
    existing_file: existingPath,
    output_dir: outputRoot,
    geocoded_address: geocoded.formatted_address,
    uses_backend_only_key: true,
    app_runtime_modified: false,
    audit,
    quality: {
      total_discovered: discovered.length,
      verified: production.length,
      rejected: rejected.length,
      duplicates_removed: duplicates.length,
      missing_addresses: openOrUnknown.filter(record => !hasNumberedStreetAddress(record)).length,
      missing_place_ids: openOrUnknown.filter(record => !record.google_place_id).length,
      closed_businesses_removed: closed.length,
      final_production_candidate_count: production.length,
      gate_failures: gateFailureCounts,
      category_counts: countBy(production, "category")
    },
    production_pools: {
      founder_15_miles: founderPool.length,
      anthony_25_miles: anthonyPool.length
    },
    query_reports: queryReports
  };
  writeJson(outputFiles.quality_report_json, report);
  fs.writeFileSync(outputFiles.audit_summary_md, buildMarkdownReport(report, Object.values(outputFiles)) + "\n");

  console.log(JSON.stringify({
    status: "complete",
    dataset_version: version,
    total_discovered: report.quality.total_discovered,
    verified: report.quality.verified,
    rejected: report.quality.rejected,
    duplicates_removed: report.quality.duplicates_removed,
    closed_businesses_removed: report.quality.closed_businesses_removed,
    founder_15_miles: report.production_pools.founder_15_miles,
    anthony_25_miles: report.production_pools.anthony_25_miles,
    output_dir: outputRoot
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
