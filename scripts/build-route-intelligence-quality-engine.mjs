import fs from "node:fs";
import path from "node:path";

const INPUT = "data/qualified-prospects/google-discovered-prospects.csv";
const OUTPUT = "data/qualified-prospects/anthony-quality-route-preview.json";
const REPORT = "prometheus-route-intelligence-quality-report.md";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasPhrase(text, term) {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedTerm = normalize(term);
  return Boolean(normalizedTerm) && normalizedText.includes(` ${normalizedTerm} `);
}

function miles(record) {
  const value = Number(record.estimated_distance_miles);
  return Number.isFinite(value) ? value : 999;
}

function hasAny(text, terms) {
  return terms.some(term => hasPhrase(text, term));
}

const categoryBase = {
  Auto: { class: "Excellent", walkIn: 9, decision: 8, gymFit: 8, traffic: 7, ease: 8, size: 7, conversation: 8, category: 10 },
  "Car Wash": { class: "Excellent", walkIn: 9, decision: 7, gymFit: 8, traffic: 9, ease: 9, size: 7, conversation: 8, category: 10 },
  Barber: { class: "Excellent", walkIn: 10, decision: 9, gymFit: 9, traffic: 8, ease: 9, size: 8, conversation: 10, category: 10 },
  Salon: { class: "Excellent", walkIn: 10, decision: 8, gymFit: 8, traffic: 8, ease: 9, size: 7, conversation: 9, category: 9 },
  Restaurant: { class: "Good", walkIn: 8, decision: 6, gymFit: 7, traffic: 9, ease: 8, size: 8, conversation: 7, category: 8 },
  "Other Storefront": { class: "Good", walkIn: 8, decision: 7, gymFit: 7, traffic: 7, ease: 8, size: 7, conversation: 7, category: 7 },
  "Small Retail": { class: "Good", walkIn: 9, decision: 8, gymFit: 8, traffic: 8, ease: 8, size: 7, conversation: 8, category: 9 },
  Apartment: { class: "Average", walkIn: 6, decision: 5, gymFit: 7, traffic: 5, ease: 5, size: 8, conversation: 5, category: 5 },
  "Business Services": { class: "Average", walkIn: 6, decision: 5, gymFit: 5, traffic: 4, ease: 6, size: 5, conversation: 5, category: 4 },
  "Dental Office": { class: "Poor", walkIn: 5, decision: 4, gymFit: 4, traffic: 4, ease: 5, size: 5, conversation: 4, category: 3 },
  "Medical Office": { class: "Poor", walkIn: 4, decision: 4, gymFit: 4, traffic: 5, ease: 4, size: 6, conversation: 4, category: 3 }
};

const excellentNameSignals = [
  "barber", "fade", "chop", "salon", "hair", "beauty", "nails", "tire", "tires", "wheels",
  "auto", "lube", "car wash", "wash", "detail", "smoke", "vape", "wireless", "phone",
  "cell", "restaurant", "kitchen", "grill", "pizza", "bbq", "cajun", "tax", "notary"
];
const downRankSignals = [
  "medical revenue", "billing", "revenue", "property tax", "business park", "professional",
  "suite", "office", "clinic", "doctor", "dds", "dental", "family practice", "healthcare",
  "apt ", "apartment ", "apartments", "village", "real estate", "insurance"
];
const neverVisitSignals = [
  "fitness connection", "walmart", "target", "costco", "sam s club", "airport", "school",
  "government", "hospital", "mall", "plaza", "park and ride", "business park", "campus"
];

function scoreDistance(distance) {
  if (distance <= 0.75) return 10;
  if (distance <= 1.5) return 9;
  if (distance <= 3) return 8;
  if (distance <= 5) return 6;
  if (distance <= 10) return 4;
  return 2;
}

function classify(score, categoryClass, text) {
  if (hasAny(text, neverVisitSignals)) return "Never Visit";
  if (score >= 84 && categoryClass === "Excellent") return "Excellent";
  if (score >= 74) return "Good";
  if (score >= 60) return "Average";
  if (score >= 45) return "Poor";
  return "Never Visit";
}

function confidenceFor(record, score, classification, text) {
  const strongCategory = ["Auto", "Car Wash", "Barber", "Salon", "Restaurant", "Small Retail"].includes(record.category);
  const strongName = hasAny(text, excellentNameSignals);
  const close = miles(record) <= 2;
  if (classification === "Excellent" && strongCategory && strongName && close) return "High";
  if (["Excellent", "Good"].includes(classification) && close) return "Medium-High";
  if (classification === "Average") return "Medium";
  if (classification === "Poor") return "Low";
  return "Do not use";
}

function scoreRecord(record) {
  const base = categoryBase[record.category] || categoryBase["Other Storefront"];
  const qualityText = `${record.business_name} ${record.full_address} ${record.category}`;
  const riskText = `${record.business_name} ${record.full_address}`;
  const distance = miles(record);
  const subscores = {
    walk_in_accessibility: base.walkIn,
    decision_maker_availability: base.decision,
    likelihood_of_gym_interest: base.gymFit,
    foot_traffic: base.traffic,
    ease_of_entry: base.ease,
    business_size_fit: base.size,
    conversation_likelihood: base.conversation,
    time_efficiency: scoreDistance(distance),
    distance,
    category_quality: base.category
  };

  if (hasAny(qualityText, excellentNameSignals)) {
    subscores.decision_maker_availability = Math.min(10, subscores.decision_maker_availability + 1);
    subscores.conversation_likelihood = Math.min(10, subscores.conversation_likelihood + 1);
  }
  if (hasAny(qualityText, downRankSignals)) {
    subscores.walk_in_accessibility = Math.max(0, subscores.walk_in_accessibility - 2);
    subscores.decision_maker_availability = Math.max(0, subscores.decision_maker_availability - 2);
    subscores.conversation_likelihood = Math.max(0, subscores.conversation_likelihood - 2);
    subscores.category_quality = Math.max(0, subscores.category_quality - 2);
  }
  if (hasAny(riskText, neverVisitSignals)) {
    subscores.walk_in_accessibility = 0;
    subscores.decision_maker_availability = 0;
    subscores.conversation_likelihood = 0;
    subscores.category_quality = 0;
  }

  const weighted =
    subscores.walk_in_accessibility * 1.2 +
    subscores.decision_maker_availability * 1.25 +
    subscores.likelihood_of_gym_interest * 1.1 +
    subscores.foot_traffic * 0.9 +
    subscores.ease_of_entry * 0.9 +
    subscores.business_size_fit * 0.7 +
    subscores.conversation_likelihood * 1.3 +
    subscores.time_efficiency * 0.85 +
    subscores.category_quality * 1.25;
  const score = Number((weighted / 9.45 * 10).toFixed(1));
  const classification = classify(score, base.class, riskText);
  const confidence = confidenceFor(record, score, classification, qualityText);
  return {
    ...record,
    quality_score: score,
    quality_class: classification,
    confidence,
    estimated_visit_duration_minutes: classification === "Excellent" ? "6-9" : classification === "Good" ? "8-10" : classification === "Average" ? "10-14" : classification === "Poor" ? "Only if approved" : "Do not visit",
    expected_conversation_opportunity: conversationOpportunity(record, classification),
    expected_decision_maker_availability: decisionMakerAvailability(record, confidence),
    expected_roi: expectedRoi(record, classification, confidence),
    quality_reason: qualityReason(record, score, classification, confidence),
    truth_basis: "Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation."
  };
}

const invalidRouteTargetSignals = [
  "urban bird",
  "texas made income tax",
  "southbelt dental office",
  "t mobile blackhawk",
  "pro desk",
  "employer outreach",
  "employee outreach",
  "discovery placeholder",
  "placeholder",
  "route intelligence",
  "business corridor",
  "corridor",
  "sweep"
];

const genericBusinessSignals = [
  "mall",
  "plaza",
  "town center",
  "shopping center",
  "airport",
  "campus",
  "park and ride",
  "park ride",
  "government",
  "city hall",
  "courthouse",
  "police station",
  "fire station"
];

function hasNumberedStreetAddress(record) {
  return /(?:^|,\s*)\d+[a-z]?\s+[a-z0-9]/i.test(String(record.full_address || ""));
}

function isGoogleMapsSafe(record) {
  return /^https:\/\/((www\.)?google\.[^/]+\/maps\/|maps\.google\.[^/]+\/|maps\.app\.goo\.gl\/)/i.test(String(record.google_maps_url || ""));
}

function strictGoogleRouteGate(record) {
  if (record.quality_status !== "verified") return false;
  if (record.source_type !== "Google Places API") return false;
  if (!record.google_place_id) return false;
  if (!record.business_name || !record.full_address) return false;
  if (/^\d+[a-z]?\s+/i.test(record.business_name)) return false;
  if (!hasNumberedStreetAddress(record)) return false;
  if (!isGoogleMapsSafe(record)) return false;
  if (record.access_type === "Do not recommend") return false;
  if (record.is_generic_place === "yes") return false;
  const nameAndAddress = `${record.business_name} ${record.full_address}`;
  if (hasAny(nameAndAddress, invalidRouteTargetSignals)) return false;
  if (hasAny(record.business_name, genericBusinessSignals)) return false;
  return true;
}

function dedupeByPlaceId(records) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = record.google_place_id || normalize(`${record.business_name} ${record.full_address}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

function chooseCandidatePool(records, limit, profileId) {
  const selected = [];
  const selectedIds = new Set();
  const buckets = new Map();
  records.forEach(record => {
    const bucket = buckets.get(record.category) || [];
    bucket.push(record);
    buckets.set(record.category, bucket);
  });

  const preferredOrder = profileId === "cruz"
    ? ["Auto", "Car Wash", "Restaurant", "Business Services", "Small Retail", "Barber", "Salon", "Other Storefront", "Apartment", "Medical Office", "Dental Office"]
    : ["Barber", "Salon", "Restaurant", "Small Retail", "Car Wash", "Auto", "Business Services", "Other Storefront", "Apartment", "Medical Office", "Dental Office"];
  const categories = [...preferredOrder, ...[...buckets.keys()].filter(category => !preferredOrder.includes(category))];

  let rounds = 0;
  while (selected.length < limit && rounds < 40) {
    let addedThisRound = false;
    for (const category of categories) {
      if (selected.length >= limit) break;
      const next = (buckets.get(category) || []).find(record => !selectedIds.has(record.google_place_id));
      if (!next) continue;
      selected.push(next);
      selectedIds.add(next.google_place_id);
      addedThisRound = true;
    }
    if (!addedThisRound) break;
    rounds += 1;
  }

  for (const record of records) {
    if (selected.length >= limit) break;
    if (selectedIds.has(record.google_place_id)) continue;
    selected.push(record);
    selectedIds.add(record.google_place_id);
  }

  return selected;
}

function chooseCandidatePoolAvoiding(records, limit, profileId, avoidPlaceIds = new Set()) {
  const preferred = records.filter(record => !avoidPlaceIds.has(record.google_place_id));
  const selected = chooseCandidatePool(preferred, limit, profileId);
  if (selected.length >= limit) return selected;
  const selectedIds = new Set(selected.map(record => record.google_place_id));
  const fill = chooseCandidatePool(records.filter(record => !selectedIds.has(record.google_place_id)), limit - selected.length, profileId);
  return selected.concat(fill);
}

function toRuntimePlace(record, index, profileId) {
  const profilePrefix = profileId === "cruz" ? "cruz-google" : "anthony-google";
  return {
    id: `${profilePrefix}-${index + 1}-${normalize(record.google_place_id).slice(0, 32)}`,
    repProfileId: profileId,
    seedRouteOrder: index + 1,
    name: record.business_name,
    category: normalizeRuntimeCategory(record.category),
    window: "Midday",
    distance: `${Number(miles(record).toFixed(1))} mi`,
    priority: Math.max(1, Math.min(100, Math.round(Number(record.quality_score || 0)))),
    address: record.full_address,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    permission: "Unknown",
    accessType: record.access_type || "Walk-in ready",
    askFor: record.ask_for || "manager",
    googlePlaceId: record.google_place_id,
    googleMapsUrl: record.google_maps_url,
    sourceType: "Google Places API",
    qualityClass: record.quality_class,
    qualityScore: Number(record.quality_score || 0),
    confidence: record.confidence,
    expectedVisitDuration: record.estimated_visit_duration_minutes,
    expectedRoi: record.expected_roi,
    decisionMakerAvailability: record.expected_decision_maker_availability,
    expectedConversationOpportunity: record.expected_conversation_opportunity,
    qualityReason: record.quality_reason,
    truthBasis: record.truth_basis,
    notes: `${record.quality_reason} ${record.expected_conversation_opportunity} ${record.truth_basis}`
  };
}

function normalizeRuntimeCategory(category) {
  if (category === "Other Storefront") return "Retail";
  if (category === "Apartment") return "Apartment";
  return category;
}

function conversationOpportunity(record, classification) {
  if (classification === "Never Visit") return "Do not approach in normal route generation.";
  if (["Barber", "Salon", "Auto", "Car Wash", "Restaurant", "Other Storefront", "Small Retail"].includes(record.category)) {
    return "Strong chance for a short face-to-face manager or shift-lead conversation.";
  }
  if (record.category === "Apartment") return "Possible leasing-office conversation, but timing and access may vary.";
  return "Possible office-manager conversation, but lower walk-in momentum than storefront categories.";
}

function decisionMakerAvailability(record, confidence) {
  if (["High", "Medium-High"].includes(confidence)) return "Likely enough for first-route outreach.";
  if (confidence === "Medium") return "Possible, but should be treated as backup discovery.";
  if (confidence === "Low") return "Uncertain; visit only if stronger targets are exhausted.";
  return "Not recommended.";
}

function expectedRoi(record, classification, confidence) {
  if (classification === "Excellent" && confidence === "High") return "High for first-route discovery.";
  if (["Excellent", "Good"].includes(classification)) return "Medium-high if Anthony executes a concise manager ask.";
  if (classification === "Average") return "Medium-low; useful mainly for coverage or category diversity.";
  if (classification === "Poor") return "Low for first route.";
  return "No route ROI expected.";
}

function qualityReason(record, score, classification, confidence) {
  const distance = Number(miles(record).toFixed(1));
  return `${record.business_name} ranked ${classification} with ${confidence} confidence because it is a ${record.category.toLowerCase()} prospect ${distance} miles from base, has ${record.access_type.toLowerCase()} access, and asks Anthony to approach the ${record.ask_for}. Quality score: ${score}.`;
}

function dedupe(records) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = normalize(`${record.business_name}|${record.full_address.replace(/apt\\s*\\d+/i, "").replace(/suite\\s*\\w+/i, "")}`);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

function chooseRoute(records, limit, options = {}) {
  const selected = [];
  const categoryCounts = new Map();
  const maxPerCategory = options.maxPerCategory || 2;
  const priorityClasses = options.priorityClasses || ["Excellent", "Good"];

  for (const record of records) {
    if (selected.length >= limit) break;
    if (!priorityClasses.includes(record.quality_class)) continue;
    const count = categoryCounts.get(record.category) || 0;
    if (count >= maxPerCategory) continue;
    selected.push(record);
    categoryCounts.set(record.category, count + 1);
  }
  for (const record of records) {
    if (selected.length >= limit) break;
    if (selected.includes(record) || record.quality_class === "Never Visit") continue;
    selected.push(record);
  }
  return selected;
}

function chooseBalancedRoute(records, limit, options = {}) {
  const selected = [];
  const selectedIds = new Set();
  const maxRounds = options.maxRounds || 6;
  const priorityClasses = options.priorityClasses || ["Excellent", "Good"];
  const categories = [...new Set(records
    .filter(record => priorityClasses.includes(record.quality_class))
    .map(record => record.category))];

  for (let round = 0; round < maxRounds && selected.length < limit; round += 1) {
    for (const category of categories) {
      if (selected.length >= limit) break;
      const next = records.find(record =>
        !selectedIds.has(record.prospect_id) &&
        priorityClasses.includes(record.quality_class) &&
        record.category === category
      );
      if (next) {
        selected.push(next);
        selectedIds.add(next.prospect_id);
      }
    }
  }

  for (const record of records) {
    if (selected.length >= limit) break;
    if (selectedIds.has(record.prospect_id) || record.quality_class === "Never Visit") continue;
    selected.push(record);
    selectedIds.add(record.prospect_id);
  }

  return selected;
}

function categoryCounts(records) {
  return records.reduce((acc, record) => {
    acc[record.category] = (acc[record.category] || 0) + 1;
    return acc;
  }, {});
}

function table(records) {
  return [
    "| # | Business | Category | Distance | Quality | Confidence | Visit | Reason |",
    "|---:|---|---|---:|---|---|---|---|",
    ...records.map((record, index) => `| ${index + 1} | ${record.business_name} | ${record.category} | ${record.estimated_distance_miles} mi | ${record.quality_class} | ${record.confidence} | ${record.estimated_visit_duration_minutes} min | ${record.quality_reason} |`)
  ].join("\n");
}

function topRecommendationBlocks(records) {
  return records.map((record, index) => `### ${index + 1}. ${record.business_name}

- Category: ${record.category}
- Distance: ${record.estimated_distance_miles} miles
- Confidence: ${record.confidence}
- Estimated visit duration: ${record.estimated_visit_duration_minutes} minutes
- Ask for: ${record.ask_for}
- Why it ranked high: ${record.quality_reason}
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: ${record.expected_conversation_opportunity}
- Expected decision-maker availability: ${record.expected_decision_maker_availability}
- Expected ROI: ${record.expected_roi}
- Truth basis: ${record.truth_basis}`).join("\n\n");
}

function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`Missing ${INPUT}. Run Google discovery first.`);
  const [headers, ...rows] = parseCsv(fs.readFileSync(INPUT, "utf8").trim());
  const allRecords = rows
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    .filter(record => record.quality_status === "verified");
  const blockedOrExcluded = allRecords
    .filter(record => record.recommendation_for_anthony !== "yes" || record.access_type === "Do not recommend")
    .slice(0, 40);
  const records = allRecords
    .filter(record => record.recommendation_for_anthony === "yes")
    .filter(record => record.access_type !== "Do not recommend")
    .map(scoreRecord);

  const ranked = dedupe(records)
    .sort((a, b) => b.quality_score - a.quality_score || miles(a) - miles(b));
  const strictQualified = dedupeByPlaceId(ranked)
    .filter(strictGoogleRouteGate);
  const cruzEligible = strictQualified
    .filter(record => miles(record) <= 15)
    .sort((a, b) => b.quality_score - a.quality_score || miles(a) - miles(b));
  const anthonyEligible = strictQualified
    .filter(record => miles(record) <= 25)
    .sort((a, b) => b.quality_score - a.quality_score || miles(a) - miles(b));
  const cruzPool = chooseCandidatePool(cruzEligible, Math.min(150, cruzEligible.length), "cruz");
  const cruzPlaceIds = new Set(cruzPool.map(record => record.google_place_id));
  const anthonyPool = chooseCandidatePoolAvoiding(anthonyEligible, Math.min(195, anthonyEligible.length), "anthony", cruzPlaceIds);
  const overlapCount = cruzPool.filter(record => anthonyPool.some(other => other.google_place_id === record.google_place_id)).length;
  const top10 = chooseRoute(ranked, 10, { maxPerCategory: 2 });
  const topKeys = new Set(top10.map(record => record.prospect_id));
  const backup25 = chooseBalancedRoute(ranked.filter(record => !topKeys.has(record.prospect_id)), 25, { maxRounds: 4 });
  const selectedKeys = new Set([...top10, ...backup25].map(record => record.prospect_id));
  const avoidList = ranked
    .filter(record => !selectedKeys.has(record.prospect_id))
    .filter(record => ["Poor", "Never Visit"].includes(record.quality_class) || record.quality_score < 58)
    .slice(0, 40);

  const payload = {
    generated_at: new Date().toISOString(),
    source_file: INPUT,
    funnel: {
      source_rows: allRecords.length,
      verified_google_rows: allRecords.filter(record => record.quality_status === "verified" && record.source_type === "Google Places API").length,
      anthony_recommended_rows: records.length,
      deduped_quality_candidates: ranked.length,
      strict_google_route_candidates: strictQualified.length,
      cruz_eligible_15_miles: cruzEligible.length,
      anthony_eligible_25_miles: anthonyEligible.length,
      cruz_embedded_pool: cruzPool.length,
      anthony_embedded_pool: anthonyPool.length,
      cruz_anthony_overlap_by_place_id: overlapCount,
      rejected_by_strict_gate: ranked.length - strictQualified.length
    },
    total_anthony_ready_reviewed: records.length,
    deduped_reviewed: ranked.length,
    category_counts: categoryCounts(records),
    strict_category_counts: categoryCounts(strictQualified),
    cruz_candidate_pool: cruzPool,
    anthony_candidate_pool: anthonyPool,
    runtime_pools: {
      cruz: cruzPool.map((record, index) => toRuntimePlace(record, index, "cruz")),
      anthony: anthonyPool.map((record, index) => toRuntimePlace(record, index, "anthony"))
    },
    top_10_route: top10,
    backup_25_route: backup25,
    avoid_list: avoidList,
    blocked_or_excluded_preview: blockedOrExcluded,
    truth_doctrine: "Scores are based only on available Google evidence plus explicit category/name/distance heuristics. Parking, owner presence, customer volume, and ROI are inferred and must be validated in field."
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + "\n");

  const report = `# Prometheus Route Intelligence Quality Report

Date: ${new Date().toISOString().slice(0, 10)}

## Executive Summary

Google Places discovery is complete, but Google only provides raw location candidates. Route Intelligence Quality Engine v1 adds the judgment layer Prometheus needs before Anthony sees a route.

This pass reviewed ${records.length} Anthony-ready Google results and deduped them into ${ranked.length} usable candidates. The strict production route gate produced ${strictQualified.length} Google-qualified runtime candidates, including ${cruzPool.length} Founder candidates inside 15 miles and ${anthonyPool.length} Anthony candidates inside the available offline route radius. The engine prioritizes places a field rep can realistically walk into, find a manager or shift lead, start a short conversation, and move on quickly.

## Candidate Funnel

- Source rows: ${allRecords.length}
- Verified Google rows: ${allRecords.filter(record => record.quality_status === "verified" && record.source_type === "Google Places API").length}
- Anthony-recommended rows before quality scoring: ${records.length}
- Deduped quality candidates: ${ranked.length}
- Strict Google-qualified route candidates: ${strictQualified.length}
- Founder 15-mile eligible candidates: ${cruzEligible.length}
- Anthony 25-mile eligible candidates from the current offline dataset: ${anthonyEligible.length}
- Embedded Founder pool: ${cruzPool.length}
- Embedded Anthony pool: ${anthonyPool.length}
- Founder/Anthony overlap after avoidance pass: ${overlapCount}
- Rejected by strict runtime gate: ${ranked.length - strictQualified.length}

## Scoring Model

Every location was scored across:

- Walk-in accessibility
- Decision-maker availability
- Likelihood of gym interest
- Foot traffic
- Ease of entry
- Business size fit
- Conversation likelihood
- Time efficiency
- Distance
- Category quality

Truth Doctrine: Google verifies the business name, address, category, and location. Prometheus infers conversation quality, decision-maker access, and ROI from category, business name, and distance. Those inferences must be validated by Anthony's field results.

## Category Strategy

Excellent categories: auto, car wash, barber, salon, and strong storefront/service businesses.

Good categories: restaurants, small retail, phone/wireless, smoke/vape, pawn/electronics, and practical local storefronts.

Shopping centers can create useful foot traffic, but Prometheus does not recommend generic shopping-center records as route stops. It recommends individual storefronts inside those centers when Google identifies them by name.

Average categories: apartments and business services when they are specific and manager-accessible.

Poor categories: medical offices, dental offices, back-office businesses, tax offices, corporate offices, generic office suites, and locations where walk-in conversation is less natural.

Never Visit: broad hospitals, schools, government buildings, generic plazas/malls, park-and-rides, big-box stores, base location, and generic non-actionable records.

## Anthony Top 10

${table(top10)}

## Top 10 Recommendation Detail

${topRecommendationBlocks(top10)}

## Backup 25

${table(backup25)}

## Avoid List

These are not necessarily bad businesses. They are low-fit for Anthony's first beta route based on available evidence.

${avoidList.length ? table(avoidList.slice(0, 25)) : "No poor or never-visit records remained after filtering."}

## Already Blocked Or Excluded

${blockedOrExcluded.length} verified Google records were excluded before quality ranking because they were blocked, generic, permission-restricted, the base location, or not recommended for Anthony's first route. These records remain out of normal route generation unless manually approved.

## Weaknesses

- Google data does not prove whether an owner, manager, or shift lead is physically present.
- Google data does not prove parking, foot traffic, solicitation rules, or best visit time.
- Some business names are ambiguous and require field validation.
- Medical, dental, tax, and office-service locations may still be useful later, but they are not ideal for Anthony's first trust-building route.
- Route quality will become materially better once Anthony logs conversations, leads, sales, objections, and best time windows.

## Future Learning Model

Do not implement this learning loop until Anthony starts testing.

Future loop:

Visit -> Conversation -> Lead -> Membership sold -> Follow-up -> Route score updated -> Future rankings improve.

Prometheus should eventually learn:

- Which categories Anthony converts best
- Which time windows produce conversations
- Which managers are receptive
- Which routes waste time
- Which business types produce memberships
- Which stops should be rotated, cooled down, or removed

## Friday Beta Suggestions

- Start Anthony with six to ten high-confidence walk-in stops.
- Ask Anthony to log whether he spoke with a manager, owner, shift lead, or leasing manager.
- Track actual visit duration, lead created, follow-up needed, and result.
- If Anthony questions a recommendation, capture why immediately.
- Do not over-optimize after one day. Use the first day to validate category quality and conversation access.

## Quality Engine Output

Structured output:

\`${OUTPUT}\`
`;
  fs.writeFileSync(REPORT, report);
  console.log(JSON.stringify({
    reviewed: records.length,
    deduped: ranked.length,
    strict_google_route_candidates: strictQualified.length,
    cruz_pool: cruzPool.length,
    anthony_pool: anthonyPool.length,
    overlap_by_place_id: overlapCount,
    top_10: top10.map(record => `${record.business_name} (${record.quality_class}, ${record.confidence}, ${record.quality_score})`),
    backup_25_count: backup25.length,
    avoid_count: avoidList.length,
    output: OUTPUT,
    report: REPORT
  }, null, 2));
}

main();
