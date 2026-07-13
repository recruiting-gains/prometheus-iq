# Dashboard Decision Context Producer Validation v1

Batch: BATCH-20260713-002

Owner: Prometheus Dashboard

Reviewed commit: `2774d91456e4b1734eb1caa13deaa84de2248f8f`

Status: FOUNDER_BEHAVIOR_APPROVAL_REQUIRED

## Representative-visible behavior

Decision Source appears in three Fitness Connection visit workflows:

1. Quick Result, after an outcome button is selected.
2. Add Visit, as part of the visit form.
3. Add Place, only when Record initial visit outcome is enabled.

The representative sees seven choices: Route IQ Recommendation, Nearby Context, Saved Place, Discovery, Existing Relationship, Follow-up, and Manual. The field is optional. No selection and the Skip control both produce Unknown.

Quick Result changed in one operationally visible way. No Contact no longer saves on the first outcome tap. The representative selects No Contact, may choose or skip Decision Source, and then selects Save Result. Other Quick Result outcomes already required Save Result after their detail panel opened.

This representative-facing workflow requires separate Founder behavior approval. This validation does not approve it.

## Evidence timing and scope

Decision Source is created when the representative submits the completed visit. Its `capturedAt` is the same instant as the visit `createdAt`. It is post-action evidence about the representative's stated source and must not be described as a timestamp-frozen pre-action prediction.

When a visit form opens, Dashboard copies only the current recommendation place ID and canonical recommendation ID into hidden form fields. It does not freeze or preserve:

- the ranked candidate set;
- candidate probabilities or confidence;
- the evidence cutoff timestamp;
- evidence or schema versions;
- the model or rule version;
- candidate eligibility or exclusion reasons.

Therefore, Dashboard Decision Source does not provide the full candidate context required by the shadow-decision contract. It can later link an actual action to an independently frozen shadow decision, but it cannot substitute for that prediction record.

## Influence boundary

Choosing, skipping, or generating Decision Source evidence does not alter route order, scoring, Discovery Mode, Nearby Context, Saved Places, notifications, or automatic actions. The existing completed-visit workflow may remove the completed stop and request the already-approved adaptive replenishment after Save Result; that behavior is driven by the visit outcome, not by Decision Source.

Dashboard imports no shadow-readiness engine, ledger, report, or shadow output. No shadow state or Founder readiness result is rendered to representatives. Recommendation influence remains off.

## Privacy and isolation

Decision Source adds an enum selection, visit/place identifiers, a recommendation identifier when one is available, and a capture timestamp. It adds no name, email, phone, manager, GPS, note, or other personally identifiable field. Existing optional visit contact, note, and location fields are outside this feature.

The producer is limited to Fitness Connection and fails closed for other workspaces.

## Desktop, mobile, and PWA

The source and deploy Dashboard documents remain byte-identical. The service-worker cache marker was advanced so the PWA receives the new document. Desktop and 390 by 844 standalone mobile verification cover control reachability, scrolling, source selection, skip/default behavior, persistence, report production, and Data acknowledgment.

## Backward compatibility

Visits created by the current Dashboard always contain explicit Decision Source and recommendation context, including explicit Unknown when the optional field is skipped. Older local visits without these fields still load and remain visible with both values unavailable.

At End Route or End Day report construction, a legacy visit with either missing canonical field receives the narrow prospective transport fallback required by the Data contract: explicit Unknown source, zero confidence, no evidence, null recommendation availability/identity/decision, and a `capturedAt` equal to the report generation time. The original local visit remains unchanged. This timestamp is after the original action and outcome, so the fallback is unavailable post-action context and cannot be treated as a pre-action observation, candidate snapshot, or shadow prediction.

The raw Dashboard report does not assign a temporal classification and contains no candidate snapshot, ranking, probability, evidence-cutoff, model-version, rule-version, eligibility, exclusion, or shadow-decision field. After durable acknowledgment, Data classifies the normalized fallback as `late_report_finalization_unknown`. Chronological projection excludes it at the visit timestamp and at its capture timestamp; it becomes available only to a strictly later cutoff.

## Permanent regression guards

Dashboard verification now proves:

- all three entry points expose the same seven optional choices;
- No Contact requires explicit Save Result and does not silently submit;
- choice and skip interactions do not mutate route or visit state before submission;
- the capture timestamp equals visit creation time;
- only source and recommendation linkage fields are emitted;
- legacy missing fields remain unavailable;
- durable Data acknowledgment classifies the normalized fallback as `late_report_finalization_unknown`;
- raw fallback evidence contains no pre-action candidate-context claim;
- no shadow output is visible or imported;
- no new PII field is introduced;
- source and deploy artifacts remain identical.
