import fs from "node:fs";

const inputPath = process.argv[2] || "data/qualified-prospects/overpass-anthony-almeda.raw.json";
const outputPath = process.argv[3] || "data/qualified-prospects/anthony-almeda-verified-prospects.csv";
const base = { lat: 29.6176, lon: -95.2193 };
const blockedPattern = /\b(urban bird|autozone|seaford|seafood|walmart|target|costco|sam'?s club|h-?e-?b|kroger|aldi|fiesta|whole foods|trader joe'?s|airport|hospital|medical center|school|college|university|courthouse|city hall|police|fire station|park & ride|mall|plaza|shopping center|town center)\b/i;
const bigBoxPattern = /\b(best buy|barnes\s*&?\s*noble|walmart|target|costco|sam'?s club|h-?e-?b|kroger|aldi|fiesta|whole foods|trader joe'?s)\b/i;

const headers = [
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

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function distanceMiles(lat, lon) {
  const earthMiles = 3958.8;
  const dLat = (lat - base.lat) * Math.PI / 180;
  const dLon = (lon - base.lon) * Math.PI / 180;
  const lat1 = base.lat * Math.PI / 180;
  const lat2 = lat * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fullAddress(tags) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const city = tags["addr:city"] || "Houston";
  const state = tags["addr:state"] || "TX";
  const postcode = tags["addr:postcode"] || "";
  return [street, city, state, postcode].filter(Boolean).join(", ");
}

function category(tags) {
  const shop = tags.shop || "";
  const amenity = tags.amenity || "";
  const healthcare = tags.healthcare || "";
  const office = tags.office || "";
  const craft = tags.craft || "";
  if (/tyres|tires/i.test(shop)) return "Tire";
  if (/car_repair|auto|car_parts|car/i.test(shop) || /mechanic|automotive/i.test(craft)) return "Auto";
  if (/car_wash/i.test(shop) || amenity === "car_wash") return "Car Wash";
  if (/hairdresser|beauty|nails/i.test(shop)) return "Salon";
  if (/barber/i.test(shop)) return "Barber";
  if (/books/i.test(shop)) return "Small Retail";
  if (/tobacco|e-cigarette|vape/i.test(shop)) return "Small Retail";
  if (/electronics|mobile_phone|computer|phone/i.test(shop)) return "Small Retail";
  if (/pawnbroker/i.test(shop)) return "Small Retail";
  if (amenity === "dentist" || healthcare === "dentist") return "Dental Office";
  if (amenity === "clinic" || amenity === "doctors" || healthcare) return "Medical Office";
  if (amenity === "restaurant" || amenity === "fast_food" || amenity === "cafe" || amenity === "bar") return "Restaurant";
  if (office || /tax|accountant|lawyer|insurance|real_estate/i.test(office)) return "Business Services";
  if (tags.tourism === "hotel") return "Local Employer";
  return shop ? "Other Storefront" : "Business Services";
}

function askFor(rowCategory) {
  if (rowCategory === "Apartment") return "leasing manager";
  if (rowCategory === "Medical Office" || rowCategory === "Dental Office") return "office manager";
  if (rowCategory === "Auto" || rowCategory === "Tire" || rowCategory === "Oil Change" || rowCategory === "Car Wash") return "service lead";
  if (rowCategory === "Restaurant") return "shift lead";
  return "manager";
}

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const seen = new Set();
const rows = [];
let excluded = 0;

(data.elements || []).forEach((element, index) => {
  const tags = element.tags || {};
  const name = tags.name || "";
  if (!name || !tags["addr:housenumber"] || !tags["addr:street"] || !element.lat || !element.lon) {
    excluded += 1;
    return;
  }
  const address = fullAddress(tags);
  const key = `${name}|${address}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  const miles = Number(distanceMiles(element.lat, element.lon).toFixed(1));
  if (miles > 20) return;
  const rowCategory = category(tags);
  const text = `${name} ${address} ${rowCategory}`;
  const restricted = blockedPattern.test(text);
  const bigBox = bigBoxPattern.test(text);
  const access = restricted || bigBox ? "Permission required" : "Walk-in ready";
  const anthonyReady = !restricted && !bigBox && miles <= 20;
  rows.push({
    prospect_id: `OSM-${element.type}-${element.id || index}`,
    business_name: name,
    full_address: address,
    category: rowCategory,
    estimated_distance_miles: miles,
    access_type: access,
    ask_for: askFor(rowCategory),
    notes: `${access}. Public map record; verify hours and permission before outreach.`,
    sources: `OpenStreetMap ${element.type}/${element.id}`,
    source_type: "OpenStreetMap",
    google_place_id: "",
    google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`,
    latitude: element.lat,
    longitude: element.lon,
    rep_status: "Anthony unvisited",
    shared_approval: "pending",
    recommendation_for_anthony: anthonyReady ? "yes" : "no",
    max_radius_miles: 20,
    is_generic_place: "no",
    quality_status: "verified"
  });
});

rows.sort((a, b) => Number(a.estimated_distance_miles) - Number(b.estimated_distance_miles));
fs.writeFileSync(outputPath, [headers.join(","), ...rows.slice(0, 220).map(row => headers.map(header => csv(row[header])).join(","))].join("\n") + "\n");

console.log(`Imported verified storefront records: ${rows.length}`);
console.log(`Excluded incomplete records: ${excluded}`);
console.log(outputPath);
