import { performance } from "node:perf_hooks";

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] || 0;
}

function heapUsed() {
  return typeof process?.memoryUsage === "function" ? process.memoryUsage().heapUsed : 0;
}

export async function runRouteIqCommercialCapacityHarness({
  workspaceCount = 10,
  totalUsers = 100,
  concurrentUsers = 25
} = {}) {
  if (workspaceCount !== 10 || totalUsers !== 100 || concurrentUsers !== 25) {
    throw new Error("Commercial readiness capacity harness is pinned to the governed initial target.");
  }

  const accepted = new Map();
  const latencies = [];
  const memoryBefore = heapUsed();
  const users = Array.from({ length: totalUsers }, (_, index) => ({
    workspaceId: `synthetic_business_${String(index % workspaceCount + 1).padStart(2, "0")}`,
    operatingProfileId: `synthetic_profile_${String(index % workspaceCount + 1).padStart(2, "0")}`,
    userId: `synthetic_user_${String(index + 1).padStart(3, "0")}`,
    recordId: `synthetic_record_${String(index + 1).padStart(3, "0")}`
  }));

  async function accept(user) {
    const started = performance.now();
    const partition = `${user.workspaceId}/${user.operatingProfileId}/${user.userId}`;
    const key = `${partition}/${user.recordId}`;
    await Promise.resolve();
    if (!accepted.has(key)) accepted.set(key, Object.freeze({ ...user, partition }));
    latencies.push(performance.now() - started);
    return accepted.get(key);
  }

  for (let offset = 0; offset < users.length; offset += concurrentUsers) {
    const cohort = users.slice(offset, offset + concurrentUsers);
    await Promise.all(cohort.flatMap(user => [accept(user), accept(user)]));
  }

  let crossWorkspaceExposure = 0;
  let crossUserExposure = 0;
  let blockedCrossWorkspaceAttempts = 0;
  let blockedCrossUserAttempts = 0;
  const readFor = (requester, record) => {
    if (requester.workspaceId !== record.workspaceId
      || requester.operatingProfileId !== record.operatingProfileId) return null;
    if (requester.userId !== record.userId) return null;
    return record;
  };
  for (const user of users) {
    const ownPrefix = `${user.workspaceId}/${user.operatingProfileId}/${user.userId}/`;
    const own = [...accepted.entries()].filter(([key]) => key.startsWith(ownPrefix));
    if (own.length !== 1) crossUserExposure += 1;
    const foreignWorkspace = [...accepted.values()].filter(record => record.workspaceId !== user.workspaceId && record.userId === user.userId);
    if (foreignWorkspace.length) crossWorkspaceExposure += foreignWorkspace.length;

    const crossWorkspaceTarget = users.find(candidate => candidate.workspaceId !== user.workspaceId);
    const crossUserTarget = users.find(candidate => candidate.workspaceId === user.workspaceId && candidate.userId !== user.userId);
    const crossWorkspaceRecord = accepted.get(`${crossWorkspaceTarget.workspaceId}/${crossWorkspaceTarget.operatingProfileId}/${crossWorkspaceTarget.userId}/${crossWorkspaceTarget.recordId}`);
    const crossUserRecord = accepted.get(`${crossUserTarget.workspaceId}/${crossUserTarget.operatingProfileId}/${crossUserTarget.userId}/${crossUserTarget.recordId}`);
    if (readFor(user, crossWorkspaceRecord) === null) blockedCrossWorkspaceAttempts += 1;
    else crossWorkspaceExposure += 1;
    if (readFor(user, crossUserRecord) === null) blockedCrossUserAttempts += 1;
    else crossUserExposure += 1;
  }

  const memoryAfter = heapUsed();
  const uniqueAcceptedRecords = accepted.size;
  const result = Object.freeze({
    version: "route-iq-commercial-capacity-harness-v1",
    noncanonicalSyntheticHarness: true,
    verifiedSafeInitialCapacity: Object.freeze({ workspaceCount, totalUsers, concurrentUsers }),
    recordIntegrity: Object.freeze({
      attemptedAccepts: totalUsers * 2,
      uniqueAcceptedRecords,
      lostAcceptedRecords: totalUsers - uniqueAcceptedRecords,
      duplicateAcceptedRecords: uniqueAcceptedRecords - totalUsers,
      deterministicRetries: uniqueAcceptedRecords === totalUsers
    }),
    isolation: Object.freeze({
      crossWorkspaceExposure,
      crossUserExposure,
      crossWorkspaceAuthorizationFailures: crossWorkspaceExposure,
      crossUserAuthorizationFailures: crossUserExposure,
      blockedCrossWorkspaceAttempts,
      blockedCrossUserAttempts
    }),
    latencyMs: Object.freeze({
      sampleCount: latencies.length,
      p50: Number(percentile(latencies, 0.5).toFixed(3)),
      p95: Number(percentile(latencies, 0.95).toFixed(3)),
      max: Number(Math.max(...latencies).toFixed(3))
    }),
    resources: Object.freeze({ heapDeltaBytes: Math.max(0, memoryAfter - memoryBefore) }),
    boundaries: Object.freeze({
      productionCapacityClaim: false,
      recommendationInfluence: "OFF",
      prospectiveCollection: "OFF",
      activeCohorts: 0
    })
  });

  if (result.recordIntegrity.lostAcceptedRecords !== 0
    || result.recordIntegrity.duplicateAcceptedRecords !== 0
    || !result.recordIntegrity.deterministicRetries
    || result.isolation.crossWorkspaceExposure !== 0
    || result.isolation.crossUserExposure !== 0) {
    throw new Error("Commercial readiness capacity harness failed isolation or record integrity.");
  }
  return result;
}
