const DurableObjectBase = globalThis.navigator?.userAgent === "Cloudflare-Workers"
  ? (await import("cloudflare:workers")).DurableObject
  : class NoncanonicalNodeDurableObjectShim {
    constructor(ctx, env) {
      this.ctx = ctx;
      this.env = env;
    }
  };

export const ROUTE_IQ_FORWARD_ROLLBACK_INERT_RECEIPT = Object.freeze({
  status: "disabled",
  code: "route_iq_prospective_forward_rollback_inert",
  collection: "OFF",
  recommendationInfluence: "OFF",
  canonicalRecordCreated: false,
  retryable: false
});

function inertReceipt() {
  return { ...ROUTE_IQ_FORWARD_ROLLBACK_INERT_RECEIPT };
}

export class RouteIqProspectiveShadowCoordinator extends DurableObjectBase {
  async allocateNextStopOpportunity() {
    return inertReceipt();
  }

  async noteGovernedRepresentativeSignal() {
    return inertReceipt();
  }

  async closeCanonicalSession() {
    return inertReceipt();
  }

  async readCanonicalRuntimeContext() {
    return inertReceipt();
  }

  async recordRuntimeStageExclusion() {
    return inertReceipt();
  }

  async linkServerDerivedNextStopAction() {
    return inertReceipt();
  }

  async reconcileCommittedFieldSessionOutcomes() {
    return inertReceipt();
  }

  async admitIntelligenceScoreableOutcome() {
    return inertReceipt();
  }

  async admitIntelligenceEvaluation() {
    return inertReceipt();
  }

  async applyTrustedTrigger() {
    return inertReceipt();
  }

  async applyTrustedCandidateManifest() {
    return inertReceipt();
  }

  async applyTrustedSnapshotSeal() {
    return inertReceipt();
  }

  async applyTrustedShadowDecisionSeal() {
    return inertReceipt();
  }

  async applyTrustedAction() {
    return inertReceipt();
  }

  async applyTrustedOutcome() {
    return inertReceipt();
  }

  async applyTrustedEvaluation() {
    return inertReceipt();
  }

  async applyTrustedCorrection() {
    return inertReceipt();
  }

  async recoverNextProjection() {
    return inertReceipt();
  }

  async readCommittedProjectionAsOf() {
    return inertReceipt();
  }

  async readCommittedProjectionForOutcomeArtifact() {
    return inertReceipt();
  }
}
