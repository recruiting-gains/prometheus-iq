# Prometheus

## Source

Recovered from pinned Codex thread:

- Thread: `Build subscription content platform`
- Thread id: `019ecede-85d0-7ff0-a713-420bd66ce614`
- Original workspace: `/Users/cruzgarza/Documents/Codex/2026-06-16/im-not-interested-in-selling-indivual`
- Original app output: `/Users/cruzgarza/Documents/Codex/2026-06-16/im-not-interested-in-selling-indivual/outputs/field-production-tracker/index.html`
- Current Prometheus app file: `/Users/cruzgarza/Documents/Prometheus/index.html`
- Attached source note: `/Users/cruzgarza/.codex/attachments/5002ac27-7a92-42f7-b516-49faad8dbeeb/pasted-text.txt`

## Founder Reference Files

- Product vision: `/Users/cruzgarza/Documents/Prometheus/PRODUCT_VISION.md`
- Beta sharing plan: `/Users/cruzgarza/Documents/Prometheus/docs/beta-sharing-plan.md`
- Fitness Connection pitch plan: `/Users/cruzgarza/Documents/Prometheus/docs/fitness-connection-pitch-plan.md`
- Investor readiness plan: `/Users/cruzgarza/Documents/Prometheus/docs/investor-readiness-plan.md`
- Competitor research: `/Users/cruzgarza/Documents/Prometheus/docs/competitor-research.md`
- Competitor pricing/revenue: `/Users/cruzgarza/Documents/Prometheus/docs/competitor-pricing-revenue.md`
- Founder master notes: `/Users/cruzgarza/Documents/Prometheus/docs/founder-master-notes.md`
- Today to October 1 roadmap: `/Users/cruzgarza/Documents/Prometheus/docs/today-roadmap-october-1.md`

## Legal Drafts

- Legal document index: `/Users/cruzgarza/Documents/Prometheus/legal/README.md`
- Business pilot agreement: `/Users/cruzgarza/Documents/Prometheus/legal/Prometheus_IQ_Pilot_Confidentiality_Agreement_DRAFT.docx`
- Individual tester NDA for Anthony or another representative: `/Users/cruzgarza/Documents/Prometheus/legal/Prometheus_IQ_Authorized_User_NDA_DRAFT.docx`

Use the business agreement only with an authorized business decision-maker. Use the individual tester agreement for Anthony unless Fitness Connection formally authorizes a company pilot. Both drafts require review by a licensed Texas technology attorney before signature.

## Product Idea

Prometheus is a command center for a Fitness Connection sales manager whose daily target is 10 units. HubSpot cannot be connected, so Prometheus acts as a fast personal system for outside sales activity, route decisions, location performance, visit counts, lead counts, and unit production.

Prometheus is not a pitch coach and not a follow-up CRM. The user explicitly removed pitch scripts and follow-up lists from the desired product direction. The app should answer:

> Where do I go, when do I go, what has worked, and how many units did it produce?

The app is designed for phone use while working in the field near Fitness Connection at:

`12338 Gulf Freeway Frontage Rd, Houston, Texas 77034`

## Core Goal

Help hit 10 units per day by making daily outside outreach more organized, measurable, and repeatable.

Core daily targets:

- 10 joins/units
- 50+ new conversations
- 2+ outside stops

## Current App Features

- Daily scoreboard showing units today, units needed, visits today, conversations, and leads.
- Progress bar toward the 10-unit goal.
- Fastest Path To 10 calculation based on logged results.
- Add Visit flow with place, talks, leads, same-day units, later units, visit quality, date, time window, and notes.
- Add Place flow with name, address/search, category, best window, permission, can-revisit status, and notes.
- Today's Route that updates as results are logged.
- Route Builder that ranks saved places by expected production.
- Production Map that filters places by outcome:
  - Units
  - Leads
  - New
  - No production
- Stats screen with total units, units per visit, best category, best places, and best time windows.
- Find screen with 10 rotating daily Google Maps searches for new locations.
- Local browser storage under `prometheus-v1`.
- One-file standalone web app: no backend required yet.

## Jarvis Direction

The "Jarvis" idea should stay practical: not Iron Man holograms, but a field production system that helps the user decide where to go and measure what produces units.

Prometheus should focus on:

- Daily outside route builder.
- Location performance tracker.
- Unit heat map.
- Outside activity scoreboard.
- Opportunity finder for new places near the gym.
- Event radar for places where people are already gathered.
- Permission tracker.
- Daily Need 10 Units calculator.

Prometheus should avoid:

- Pitch scripts.
- Objection coaching.
- Follow-up CRM screens.
- Long lead-management workflows that duplicate HubSpot.

## Current Starter Territory

The saved route list is centered around the Fitness Connection Gulf Freeway club and emphasizes summer-friendly business targets instead of schools.

Starter places and sweeps include:

- Almeda Mall
- Auto parts sweep: AutoZone / O'Reilly / NAPA
- Quick oil sweep: Jiffy Lube / Take 5 / Valvoline
- Tire shop sweep: Discount Tire / local tire shops
- Car wash sweep around Gulf Freeway / Almeda Genoa
- Restaurant employee sweep around Almeda Mall / Gulf Freeway
- Barber and salon sweep around Almeda Genoa
- South Point Park & Ride area
- Walmart Supercenter on Rowlett Rd
- Fuqua Park & Ride area
- Memorial Hermann Southeast Hospital
- San Jacinto College South Campus
- Hotels near Hobby / Gulf Freeway
- Ellington Airport / Ellington Field area
- Almeda Genoa business corridor
- Fuqua / Sabo retail and service sweep
- Scarsdale Blvd apartment and retail corridor
- Blackhawk Blvd / Southbelt corridor

## Daily Discovery Searches

The app rotates 10 fresh map searches each day. The default no-data category is Auto until logged results prove another category performs better.

As you add daily suggestions into your territory, Prometheus tries to replace them with unused discovery ideas so the list keeps creating new places to try over time.

Search templates include:

- AutoZone near the gym
- O'Reilly Auto Parts near the gym
- NAPA / Advance Auto search
- Jiffy Lube near the gym
- Take 5 / Valvoline search
- Tire shops near Almeda Genoa
- Car washes near Gulf Freeway
- Mechanic shops near Fuqua
- Barbershops near Almeda Mall
- Hair salons near Almeda Genoa
- Nail salons near Southbelt
- Restaurants near Almeda Mall
- Fast food rows near Fuqua
- Hotels near Hobby Airport
- Phone stores near Gulf Freeway
- Pawn shops near Almeda Genoa
- Laundromats near Southbelt
- Smoke shops near Gulf Freeway
- Dollar stores near Scarsdale
- Apartment leasing offices near Scarsdale
- Apartment leasing offices near Beamer
- Medical clinics near Fuqua
- Dental offices near Southbelt
- Warehouses near Ellington
- Staff-heavy businesses near Almeda Genoa
- Retail strips near Rowlett
- Sports fields this weekend
- Community events nearby

## Route Scoring Logic

Places are scored from:

- Prior units
- Later units
- Prior leads
- Conversations
- Starter priority
- Best time window match
- Permission value
- Whether it has already been visited today
- Whether it can be revisited
- Production status:
  - Green: produced units
  - Yellow: produced leads
  - Blue: new
  - Red: visited with no production

Places visited today are pushed down so the daily route keeps moving.

## Production Strategy Context

The tracker came from a broader plan to make the Fitness Connection sales manager role easier without needing HubSpot integration.

Important operating ideas:

- Build a personal production board outside HubSpot.
- Use HubSpot as the company record, but use Prometheus as the field cockpit.
- Track only what helps decide where units are coming from.
- Every outside visit should improve future route decisions.
- Permission is territory value: places that allow setup, flyers/cards, staff access, resident emails, or return visits matter more than random one-off stops.
- The best outside channels are apartments, employee-heavy businesses, barbers/salons, and shift-change prospecting.

## Production Data To Track

Location visit fields:

- Location name
- Location type/category
- Day and time visited
- Time window
- People talked to
- Leads captured
- Same-day units
- Later units
- Permission granted
- Can revisit
- Best contact there
- Notes

Permission fields:

- Allows table setup
- Allows flyers/cards
- Allows shift-change outreach
- Allows staff conversation
- Allows resident email/newsletter
- Said no
- Said come back later

## First Five Screens

The intended first version should stay tight:

- Today: route, unit goal, and places to hit.
- Add Visit: location, time, category, conversations, leads, and units.
- Map/List: all outside places ranked by production.
- Stats: best places, best times, and units per visit.
- Find Places: saved list of new locations to try.

## Future Build Ideas

- Rename all storage and UI identity fully to Prometheus.
- Add event radar for local events within the gym territory.
- Add a daily activity scoreboard with places visited, conversations, leads, same-day units, units per location, and units per hour.
- Add weekly stats for best location, best category, best time window, total outside units, and route efficiency.
- Add export for manual HubSpot entry.
- Add offline install/PWA support for phone home screen use.
- Add simple backup/import so local storage does not become the only copy of results.
