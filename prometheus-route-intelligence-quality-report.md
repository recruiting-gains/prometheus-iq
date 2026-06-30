# Prometheus Route Intelligence Quality Report

Date: 2026-06-29

## Executive Summary

Google Places discovery is complete, but Google only provides raw location candidates. Route Intelligence Quality Engine v1 adds the judgment layer Prometheus needs before Anthony sees a route.

This pass reviewed 199 Anthony-ready Google results and deduped them into 199 usable candidates. The strict production route gate produced 188 Google-qualified runtime candidates, including 150 Founder candidates inside 15 miles and 188 Anthony candidates inside the available offline route radius. The engine prioritizes places a field rep can realistically walk into, find a manager or shift lead, start a short conversation, and move on quickly.

## Candidate Funnel

- Source rows: 245
- Verified Google rows: 245
- Anthony-recommended rows before quality scoring: 199
- Deduped quality candidates: 199
- Strict Google-qualified route candidates: 188
- Founder 15-mile eligible candidates: 188
- Anthony 25-mile eligible candidates from the current offline dataset: 188
- Embedded Founder pool: 150
- Embedded Anthony pool: 188
- Founder/Anthony overlap after avoidance pass: 150
- Rejected by strict runtime gate: 11

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

| # | Business | Category | Distance | Quality | Confidence | Visit | Reason |
|---:|---|---|---:|---|---|---|---|
| 1 | Adolfo's Barber Shop | Barber | 0.1 mi | Excellent | High | 6-9 min | Adolfo's Barber Shop ranked Excellent with High confidence because it is a barber prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |
| 2 | Universal Barbering Of Houston | Barber | 0.1 mi | Excellent | High | 6-9 min | Universal Barbering Of Houston ranked Excellent with High confidence because it is a barber prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |
| 3 | Estetica Unisex Zaleta | Salon | 0 mi | Excellent | High | 6-9 min | Estetica Unisex Zaleta ranked Excellent with High confidence because it is a salon prospect 0 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9. |
| 4 | Glam Beauty Studio | Salon | 0.1 mi | Excellent | High | 6-9 min | Glam Beauty Studio ranked Excellent with High confidence because it is a salon prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9. |
| 5 | ClearWater Express Wash | Car Wash | 0.4 mi | Excellent | High | 6-9 min | ClearWater Express Wash ranked Excellent with High confidence because it is a car wash prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 88.3. |
| 6 | Kruzzers Auto Care LLC | Car Wash | 0.4 mi | Excellent | High | 6-9 min | Kruzzers Auto Care LLC ranked Excellent with High confidence because it is a car wash prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 88.3. |
| 7 | Level Up tires & Wheels | Auto | 0.1 mi | Excellent | High | 6-9 min | Level Up tires & Wheels ranked Excellent with High confidence because it is a auto prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7. |
| 8 | Nexaventix AutoGlass Tesla Windshield Repairs | Auto | 0.1 mi | Excellent | High | 6-9 min | Nexaventix AutoGlass Tesla Windshield Repairs ranked Excellent with High confidence because it is a auto prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7. |
| 9 | 888 Chinese Restaurant | Restaurant | 0.1 mi | Good | Medium-High | 8-10 min | 888 Chinese Restaurant ranked Good with Medium-High confidence because it is a restaurant prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3. |
| 10 | Brown Sugar's Bar B Que - The Original | Restaurant | 0.1 mi | Good | Medium-High | 8-10 min | Brown Sugar's Bar B Que - The Original ranked Good with Medium-High confidence because it is a restaurant prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3. |

## Top 10 Recommendation Detail

### 1. Adolfo's Barber Shop

- Category: Barber
- Distance: 0.1 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: manager
- Why it ranked high: Adolfo's Barber Shop ranked Excellent with High confidence because it is a barber prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 2. Universal Barbering Of Houston

- Category: Barber
- Distance: 0.1 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: manager
- Why it ranked high: Universal Barbering Of Houston ranked Excellent with High confidence because it is a barber prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 3. Estetica Unisex Zaleta

- Category: Salon
- Distance: 0 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: manager
- Why it ranked high: Estetica Unisex Zaleta ranked Excellent with High confidence because it is a salon prospect 0 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 4. Glam Beauty Studio

- Category: Salon
- Distance: 0.1 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: manager
- Why it ranked high: Glam Beauty Studio ranked Excellent with High confidence because it is a salon prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 5. ClearWater Express Wash

- Category: Car Wash
- Distance: 0.4 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: service lead
- Why it ranked high: ClearWater Express Wash ranked Excellent with High confidence because it is a car wash prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 88.3.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 6. Kruzzers Auto Care LLC

- Category: Car Wash
- Distance: 0.4 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: service lead
- Why it ranked high: Kruzzers Auto Care LLC ranked Excellent with High confidence because it is a car wash prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 88.3.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 7. Level Up tires & Wheels

- Category: Auto
- Distance: 0.1 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: service lead
- Why it ranked high: Level Up tires & Wheels ranked Excellent with High confidence because it is a auto prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 8. Nexaventix AutoGlass Tesla Windshield Repairs

- Category: Auto
- Distance: 0.1 miles
- Confidence: High
- Estimated visit duration: 6-9 minutes
- Ask for: service lead
- Why it ranked high: Nexaventix AutoGlass Tesla Windshield Repairs ranked Excellent with High confidence because it is a auto prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: High for first-route discovery.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 9. 888 Chinese Restaurant

- Category: Restaurant
- Distance: 0.1 miles
- Confidence: Medium-High
- Estimated visit duration: 8-10 minutes
- Ask for: shift lead
- Why it ranked high: 888 Chinese Restaurant ranked Good with Medium-High confidence because it is a restaurant prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: Medium-high if Anthony executes a concise manager ask.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

### 10. Brown Sugar's Bar B Que - The Original

- Category: Restaurant
- Distance: 0.1 miles
- Confidence: Medium-High
- Estimated visit duration: 8-10 minutes
- Ask for: shift lead
- Why it ranked high: Brown Sugar's Bar B Que - The Original ranked Good with Medium-High confidence because it is a restaurant prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3.
- Why Anthony should visit: This is a high-fit walk-in stop where Anthony can make a quick face-to-face outreach attempt without wasting route time.
- Expected conversation opportunity: Strong chance for a short face-to-face manager or shift-lead conversation.
- Expected decision-maker availability: Likely enough for first-route outreach.
- Expected ROI: Medium-high if Anthony executes a concise manager ask.
- Truth basis: Verified by Google for name/address/location/category. Foot traffic, decision-maker access, and ROI are inferred from category, business name, and distance; they require field validation.

## Backup 25

| # | Business | Category | Distance | Quality | Confidence | Visit | Reason |
|---:|---|---|---:|---|---|---|---|
| 1 | Dreya G Hair Studio | Barber | 0.1 mi | Excellent | High | 6-9 min | Dreya G Hair Studio ranked Excellent with High confidence because it is a barber prospect 0.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |
| 2 | Nancy's Hair & Nails | Salon | 0.4 mi | Excellent | High | 6-9 min | Nancy's Hair & Nails ranked Excellent with High confidence because it is a salon prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9. |
| 3 | Easy Wash | Car Wash | 0.6 mi | Excellent | High | 6-9 min | Easy Wash ranked Excellent with High confidence because it is a car wash prospect 0.6 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 88.3. |
| 4 | Quick Lane at Bayway Lincoln | Auto | 0.2 mi | Excellent | High | 6-9 min | Quick Lane at Bayway Lincoln ranked Excellent with High confidence because it is a auto prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7. |
| 5 | Gringo’s Mexican Kitchen {Fuqua} | Restaurant | 0.2 mi | Good | Medium-High | 8-10 min | Gringo’s Mexican Kitchen {Fuqua} ranked Good with Medium-High confidence because it is a restaurant prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3. |
| 6 | Gift Palace | Other Storefront | 0.5 mi | Good | Medium-High | 8-10 min | Gift Palace ranked Good with Medium-High confidence because it is a other storefront prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 74.9. |
| 7 | X Effects | Barber | 0.2 mi | Excellent | High | 6-9 min | X Effects ranked Excellent with High confidence because it is a barber prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |
| 8 | Up Close Beauty Max LLC | Salon | 0.5 mi | Excellent | High | 6-9 min | Up Close Beauty Max LLC ranked Excellent with High confidence because it is a salon prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9. |
| 9 | Superior Almeda Car Wash & Lube | Car Wash | 1 mi | Excellent | High | 6-9 min | Superior Almeda Car Wash & Lube ranked Excellent with High confidence because it is a car wash prospect 1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 87.4. |
| 10 | Purexentaris AutoGlass Windshield Repairs | Auto | 0.3 mi | Excellent | High | 6-9 min | Purexentaris AutoGlass Windshield Repairs ranked Excellent with High confidence because it is a auto prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7. |
| 11 | Sphinx Restaurant and grill | Restaurant | 0.3 mi | Good | Medium-High | 8-10 min | Sphinx Restaurant and grill ranked Good with Medium-High confidence because it is a restaurant prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3. |
| 12 | The Little Depot South Houston | Other Storefront | 0.6 mi | Good | Medium-High | 8-10 min | The Little Depot South Houston ranked Good with Medium-High confidence because it is a other storefront prospect 0.6 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 74.9. |
| 13 | Tha Chop Shop | Barber | 0.3 mi | Excellent | High | 6-9 min | Tha Chop Shop ranked Excellent with High confidence because it is a barber prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |
| 14 | Fox Hair & Nails | Salon | 0.5 mi | Excellent | High | 6-9 min | Fox Hair & Nails ranked Excellent with High confidence because it is a salon prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9. |
| 15 | Cano’s Car Wash | Car Wash | 1 mi | Excellent | High | 6-9 min | Cano’s Car Wash ranked Excellent with High confidence because it is a car wash prospect 1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 87.4. |
| 16 | Tire Discount | Auto | 0.3 mi | Excellent | High | 6-9 min | Tire Discount ranked Excellent with High confidence because it is a auto prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7. |
| 17 | Island Flavorz | Restaurant | 0.3 mi | Good | Medium-High | 8-10 min | Island Flavorz ranked Good with Medium-High confidence because it is a restaurant prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3. |
| 18 | The Lash Supply - Almeda Genoa TX | Other Storefront | 0.8 mi | Good | Medium-High | 8-10 min | The Lash Supply - Almeda Genoa TX ranked Good with Medium-High confidence because it is a other storefront prospect 0.8 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 74. |
| 19 | Faded Empire Barbershop | Barber | 0.3 mi | Excellent | High | 6-9 min | Faded Empire Barbershop ranked Excellent with High confidence because it is a barber prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |
| 20 | Utopia Beauty Bliss | Salon | 0.5 mi | Excellent | High | 6-9 min | Utopia Beauty Bliss ranked Excellent with High confidence because it is a salon prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 89.9. |
| 21 | Detail Center | Car Wash | 1 mi | Excellent | High | 6-9 min | Detail Center ranked Excellent with High confidence because it is a car wash prospect 1 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 87.4. |
| 22 | AutoNation Toyota Gulf Freeway Service Center | Auto | 0.3 mi | Excellent | High | 6-9 min | AutoNation Toyota Gulf Freeway Service Center ranked Excellent with High confidence because it is a auto prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the service lead. Quality score: 86.7. |
| 23 | Take the Wheel | Restaurant | 0.3 mi | Good | Medium-High | 8-10 min | Take the Wheel ranked Good with Medium-High confidence because it is a restaurant prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the shift lead. Quality score: 80.3. |
| 24 | Alameda genoa | Other Storefront | 0.9 mi | Good | Medium-High | 8-10 min | Alameda genoa ranked Good with Medium-High confidence because it is a other storefront prospect 0.9 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 74. |
| 25 | Blue Moon Beauty Bar | Barber | 0.3 mi | Excellent | High | 6-9 min | Blue Moon Beauty Bar ranked Excellent with High confidence because it is a barber prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 94.5. |

## Avoid List

These are not necessarily bad businesses. They are low-fit for Anthony's first beta route based on available evidence.

| # | Business | Category | Distance | Quality | Confidence | Visit | Reason |
|---:|---|---|---:|---|---|---|---|
| 1 | CL TAX SERVICES LLC | Business Services | 0.5 mi | Poor | Low | Only if approved min | CL TAX SERVICES LLC ranked Poor with Low confidence because it is a business services prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 57.1. |
| 2 | Colbert/Ball Tax Services | Business Services | 0.5 mi | Poor | Low | Only if approved min | Colbert/Ball Tax Services ranked Poor with Low confidence because it is a business services prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 57.1. |
| 3 | Mc Carley's Tax & Financial | Business Services | 0.7 mi | Poor | Low | Only if approved min | Mc Carley's Tax & Financial ranked Poor with Low confidence because it is a business services prospect 0.7 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 57.1. |
| 4 | Proficient Tax Group | Business Services | 0.7 mi | Poor | Low | Only if approved min | Proficient Tax Group ranked Poor with Low confidence because it is a business services prospect 0.7 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 57.1. |
| 5 | SRG Tax Services | Business Services | 0.7 mi | Poor | Low | Only if approved min | SRG Tax Services ranked Poor with Low confidence because it is a business services prospect 0.7 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 57.1. |
| 6 | MavCo Income Tax & Multi-Service | Business Services | 1.2 mi | Poor | Low | Only if approved min | MavCo Income Tax & Multi-Service ranked Poor with Low confidence because it is a business services prospect 1.2 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 56.2. |
| 7 | Jackson Hewitt Tax Service | Business Services | 1.2 mi | Poor | Low | Only if approved min | Jackson Hewitt Tax Service ranked Poor with Low confidence because it is a business services prospect 1.2 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 56.2. |
| 8 | Express Tax Services | Business Services | 1.8 mi | Poor | Low | Only if approved min | Express Tax Services ranked Poor with Low confidence because it is a business services prospect 1.8 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 55.3. |
| 9 | Fiesta Tax Services | Business Services | 2.3 mi | Poor | Low | Only if approved min | Fiesta Tax Services ranked Poor with Low confidence because it is a business services prospect 2.3 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 55.3. |
| 10 | Apoyo Multiservices | Business Services | 0.2 mi | Poor | Low | Only if approved min | Apoyo Multiservices ranked Poor with Low confidence because it is a business services prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 54.4. |
| 11 | H&R Block | Business Services | 1.7 mi | Poor | Low | Only if approved min | H&R Block ranked Poor with Low confidence because it is a business services prospect 1.7 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 52.6. |
| 12 | Neyra Multi Services | Business Services | 2.1 mi | Poor | Low | Only if approved min | Neyra Multi Services ranked Poor with Low confidence because it is a business services prospect 2.1 miles from base, has walk-in ready access, and asks Anthony to approach the manager. Quality score: 52.6. |
| 13 | Parc At South Green | Apartment | 0.2 mi | Poor | Low | Only if approved min | Parc At South Green ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 14 | Almeda Park Apartments | Apartment | 0.2 mi | Poor | Low | Only if approved min | Almeda Park Apartments ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 15 | 12303 Gulf Fwy Apt 2409 | Apartment | 0.2 mi | Poor | Low | Only if approved min | 12303 Gulf Fwy Apt 2409 ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 16 | Sabo Village | Apartment | 0.2 mi | Poor | Low | Only if approved min | Sabo Village ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 17 | 12303 Gulf Fwy Apt 2006 | Apartment | 0.2 mi | Poor | Low | Only if approved min | 12303 Gulf Fwy Apt 2006 ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 18 | 12510 S Green Dr Apt 927 | Apartment | 0.2 mi | Poor | Low | Only if approved min | 12510 S Green Dr Apt 927 ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 19 | 10950 Tanner Park Ct Apt 802 | Apartment | 0.2 mi | Poor | Low | Only if approved min | 10950 Tanner Park Ct Apt 802 ranked Poor with Low confidence because it is a apartment prospect 0.2 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 20 | Parc at South Green | Apartment | 0.3 mi | Poor | Low | Only if approved min | Parc at South Green ranked Poor with Low confidence because it is a apartment prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 21 | Green Arbor Apartments | Apartment | 0.3 mi | Poor | Low | Only if approved min | Green Arbor Apartments ranked Poor with Low confidence because it is a apartment prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 22 | 12510 S Green Dr Apt 428 | Apartment | 0.3 mi | Poor | Low | Only if approved min | 12510 S Green Dr Apt 428 ranked Poor with Low confidence because it is a apartment prospect 0.3 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 23 | Lenox Park Apartments | Apartment | 0.4 mi | Poor | Low | Only if approved min | Lenox Park Apartments ranked Poor with Low confidence because it is a apartment prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 24 | 12510 S Green Dr Apt 500 | Apartment | 0.4 mi | Poor | Low | Only if approved min | 12510 S Green Dr Apt 500 ranked Poor with Low confidence because it is a apartment prospect 0.4 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |
| 25 | 12601 S Green Dr Apt 1113 | Apartment | 0.5 mi | Poor | Low | Only if approved min | 12601 S Green Dr Apt 1113 ranked Poor with Low confidence because it is a apartment prospect 0.5 miles from base, has walk-in ready access, and asks Anthony to approach the leasing manager. Quality score: 49.7. |

## Already Blocked Or Excluded

40 verified Google records were excluded before quality ranking because they were blocked, generic, permission-restricted, the base location, or not recommended for Anthony's first route. These records remain out of normal route generation unless manually approved.

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

`data/qualified-prospects/anthony-quality-route-preview.json`
