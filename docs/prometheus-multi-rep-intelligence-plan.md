# Prometheus Multi-Rep Intelligence Plan

Date: June 22, 2026  
Purpose: Preserve founder intelligence while enabling Anthony and future reps to build independent learning profiles.

## 1. Founder Data Preservation Plan

Prometheus now treats Cruz's existing data as the Founder Profile and baseline intelligence dataset.

Preserved founder data includes:

- Visits.
- Conversations.
- Leads.
- Sales.
- GPS verified visits.
- Route recommendation history.
- Place performance.
- Category performance.
- Time-window performance.
- Route Intelligence learning history.

The app creates a `founderHistoricalSnapshot` during migration. This snapshot is preserved separately from beta tester profiles and is marked as founder baseline data.

Rule:

Founder historical learning must not be deleted, merged into Anthony, or reset by switching profiles.

## 2. Multi-Rep Intelligence Architecture

Prometheus now supports separate rep intelligence profiles:

- Founder Profile: Cruz.
- Anthony Profile: beta tester / new rep.
- Future Rep Profiles: supported by the profile data model.

Each profile maintains independent:

- Visit history.
- Route history.
- Recommendation history.
- Place performance.
- Conversation metrics.
- Lead metrics.
- Sales metrics.
- GPS verified visit history.
- Time-window performance.

Shared data:

- Saved places.
- Business addresses.
- Event opportunities.
- App configuration.

Separated data:

- Visits.
- Outcomes.
- GPS attached visits.
- Route recommendations.
- Performance metrics.
- Learning history.

## 3. Anthony New Rep Profile Setup

Anthony starts in New Rep Mode.

Anthony's profile begins with:

- Zero personal visits.
- Zero personal route history.
- Zero personal recommendation history.
- Zero personal place performance.
- Zero personal category performance.
- Zero personal time-window performance.

Anthony routing behavior:

- 80% discovery.
- 20% proven opportunities.
- Uses founder baseline only as a separate signal.
- Does not inherit founder visits as Anthony's own history.
- Builds Anthony-specific recommendations over time as he logs visits.

Important distinction:

Founder baseline can help identify proven opportunities, but Anthony's personal intelligence only grows from Anthony's own activity.

## 4. Migration Plan

Migration behavior:

1. If the app finds old single-rep data, it converts that data into Cruz's Founder Profile.
2. It creates a founder historical snapshot.
3. It creates Anthony's profile with empty visits and route history.
4. It sets the active profile to Cruz by default unless a saved profile is already selected.
5. It keeps saved places shared so both reps can use the same territory map.
6. It keeps Route Intelligence v3 logic active for every profile.

Backup behavior:

- Export backup now includes multi-rep profile data.
- Export backup includes founder historical snapshot.
- Import backup restores active profile and profile separation.

## 5. Risk Analysis

Main risks:

- User switches profiles and forgets whose data is being viewed.
- Shared places may make Anthony's app look familiar even though his personal history is empty.
- Founder baseline may influence Anthony's recommendations, but it is intentionally not copied into Anthony's history.
- Local browser storage is still device-based until secure cloud accounts exist.
- True manager/user permissions still require cloud authentication.

Controls added:

- Profile switch for Cruz / Anthony.
- Header shows active intelligence profile.
- Owner stats status identifies the profile being viewed.
- Anthony profile uses New Rep Discovery routing.
- Founder snapshot is preserved separately.
- Route history is profile-specific.

## 6. Verification Checklist

Before beta use, confirm:

- Cruz profile still shows founder visits and historical performance.
- Anthony profile starts with zero visits.
- Switching to Anthony does not erase Cruz data.
- Switching back to Cruz restores founder route history and stats.
- Anthony route recommendations show New Rep Discovery behavior.
- Anthony route history grows only when Anthony is active.
- Export backup contains `repProfiles`.
- Export backup contains `founderHistoricalSnapshot`.
- Import backup restores both profiles.
- Route Intelligence v3 still shows:
  - specific business priority
  - walk-first target
  - decision-maker hint
  - freshness
  - discovery / proven logic
  - radius expansion
  - why-this-stop explanations

## 7. Go / No-Go Recommendation

Recommendation: Go for controlled local testing.

Do not deploy to a wider beta until:

- Cruz profile is manually checked.
- Anthony profile is manually checked.
- One export backup is created and inspected.
- One switch between Cruz and Anthony is tested.
- One Anthony test visit is logged and confirmed not to affect Cruz stats.

This implementation protects the founder baseline while allowing Anthony to develop a separate learning profile.

