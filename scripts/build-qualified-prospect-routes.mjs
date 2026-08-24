import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] || "data/qualified-prospects/anthony-almeda-200-slot-import-template.csv";
const outputPath = process.argv[3] || "data/qualified-prospects/anthony-almeda-route-output.json";

const cruzBlockedPattern = /\b(urban bird|autozone|seaford|seafood)\b/i;
const restrictedPattern = /\b(walmart|target|costco|sam'?s club|airport|school|government|courthouse|city hall|park & ride|mall|plaza|shopping center|town center)\b/i;
const categoryOrder = ["Auto", "Tire", "Oil Change", "Car Wash", "Barber", "Salon", "Restaurant", "Apartment", "Medical Office", "Dental Office", "Business Services", "Small Retail", "Local Employer", "Other Storefront", "Event"];
const firstRouteLimit = 6;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
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
    rows.push(row);
  }
  return rows;
}

function toRecords(rows) {
  const [headers, ...body] = rows;
  return body.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function isQualified(record) {
  const text = `${record.business_name} ${record.full_address} ${record.notes}`;
  if (!record.business_name || !record.full_address) return false;
  if (record.source_type === "placeholder" || record.quality_status === "placeholder") return false;
  if (record.access_type === "Do not recommend") return false;
  if (record.recommendation_for_anthony !== "yes") return false;
  if (record.rep_status !== "Anthony unvisited") return false;
  if (cruzBlockedPattern.test(text)) return false;
  if (restrictedPattern.test(text) && record.access_type !== "Permission required" && record.access_type !== "Event-based") return false;
  return true;
}

function exclusionReason(record) {
  const text = `${record.business_name} ${record.full_address} ${record.notes}`;
  if (!record.business_name || !record.full_address) return "missing business name or address";
  if (record.source_type === "placeholder" || record.quality_status === "placeholder") return "placeholder";
  if (record.quality_status !== "verified") return "not verified";
  if (record.access_type === "Do not recommend") return "do not recommend";
  if (record.recommendation_for_anthony !== "yes") return "not recommended for Anthony";
  if (record.rep_status !== "Anthony unvisited") return "not Anthony unvisited";
  if (cruzBlockedPattern.test(text)) return "Cruz historical or blocked location";
  if (restrictedPattern.test(text) && record.access_type !== "Permission required" && record.access_type !== "Event-based") return "restricted/generic target";
  return "";
}

function miles(record) {
  const value = Number(record.estimated_distance_miles);
  return Number.isFinite(value) ? value : 999;
}

function rank(record) {
  let score = 0;
  if (record.access_type === "Walk-in ready") score += 50;
  if (record.access_type === "Event-based") score += 25;
  if (record.access_type === "Permission required") score += 10;
  if (["Auto", "Tire", "Oil Change", "Car Wash", "Barber", "Salon", "Restaurant", "Apartment", "Medical Office", "Dental Office", "Small Retail"].includes(record.category)) score += 15;
  if (["Business Services", "Local Employer", "Other Storefront"].includes(record.category)) score -= 8;
  score += Math.max(0, 20 - miles(record));
  score += Math.max(0, categoryOrder.length - categoryOrder.indexOf(record.category));
  return score;
}

function diversePick(records, limit) {
  const selected = [];
  const categoryCounts = new Map();

  function addWithLimit(record, maxPerCategory) {
    if (selected.length >= limit) return;
    if (selected.includes(record)) return;
    const count = categoryCounts.get(record.category) || 0;
    if (count >= maxPerCategory) return;
    selected.push(record);
    categoryCounts.set(record.category, count + 1);
  }

  records.forEach(record => addWithLimit(record, 1));
  records.forEach(record => addWithLimit(record, 2));
  records.forEach(record => {
    if (selected.length >= limit || selected.includes(record)) return;
    selected.push(record);
  });
  return selected;
}

const fullInputPath = path.resolve(inputPath);
const rows = parseCsv(fs.readFileSync(fullInputPath, "utf8"));
const records = toRecords(rows);
const qualified = records.filter(isQualified);
const excluded = records.filter(record => !isQualified(record));
const permissionRequired = records.filter(record => record.access_type === "Permission required" && record.quality_status === "verified");
const verified = records.filter(record => record.quality_status === "verified");
const anthonyReady = qualified.filter(record => record.rep_status === "Anthony unvisited" && record.recommendation_for_anthony === "yes");
const within10 = qualified.filter(record => miles(record) <= 10);
const within15 = qualified.filter(record => miles(record) <= 15);
const pool = within10.length >= 25 ? within10 : within15.length >= 25 ? within15 : qualified.filter(record => miles(record) <= 20);
const ranked = pool.sort((a, b) => rank(b) - rank(a));
const firstRoute = diversePick(ranked, firstRouteLimit);
const backupQueue = ranked.filter(record => !firstRoute.includes(record));

fs.writeFileSync(outputPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  source_file: inputPath,
  total_records: records.length,
  verified_records: verified.length,
  excluded_records: excluded.length,
  permission_required_records: permissionRequired.length,
  anthony_ready_records: anthonyReady.length,
  qualified_records: qualified.length,
  first_route_count: firstRoute.length,
  backup_queue_count: backupQueue.length,
  data_gaps: {
    needs_verified_records: verified.length === 0,
    needs_at_least_25_fresh_options_inside_10_miles: within10.length < 25,
    needs_6_first_route_stops: firstRoute.length < firstRouteLimit,
    needs_20_backup_queue_stops: backupQueue.length < 20
  },
  excluded_summary: Object.entries(excluded.reduce((acc, record) => {
    const reason = exclusionReason(record) || "unknown";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {})).map(([reason, count]) => ({ reason, count })),
  first_route: firstRoute,
  backup_discovery_queue: backupQueue
}, null, 2));

console.log(`Verified records: ${verified.length}`);
console.log(`Excluded records: ${excluded.length}`);
console.log(`Permission-required records: ${permissionRequired.length}`);
console.log(`Anthony-ready records: ${anthonyReady.length}`);
console.log(`Qualified records: ${qualified.length}`);
console.log(`Anthony first route: ${firstRoute.length}`);
console.log(`Anthony backup queue: ${backupQueue.length}`);
console.log(outputPath);
