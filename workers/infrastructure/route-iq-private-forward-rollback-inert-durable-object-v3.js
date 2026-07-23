const DurableObjectBase = globalThis.DurableObject || class {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
};

export const ROUTE_IQ_PRIVATE_FORWARD_ROLLBACK_INERT_RECEIPT = Object.freeze({
  ok: false,
  code: "route_iq_private_forward_rollback_inert",
  state: "INERT_FORWARD_COMPATIBILITY",
  customerPwaLaunch: "OFF",
  prospectiveCollection: "OFF",
  businessAvailabilityMode: "OFF",
  activeCohortCount: 0,
  recommendationInfluence: "OFF",
  storageTouched: false
});

function inertReceipt() {
  return ROUTE_IQ_PRIVATE_FORWARD_ROLLBACK_INERT_RECEIPT;
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

export class RouteIqBusinessAvailabilityCoordinator extends DurableObjectBase {
  async acceptNormalizedSnapshot() {
    return inertReceipt();
  }

  async recordRefreshFailure() {
    return inertReceipt();
  }

  async readLatestSnapshot() {
    return inertReceipt();
  }

  async readMonitoringSummary() {
    return inertReceipt();
  }
}
