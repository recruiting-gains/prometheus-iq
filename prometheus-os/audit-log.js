const STORAGE_KEY = "prometheus-os-audit-log";
let memoryLog = [];

function browserStorage() {
  if (
    typeof window !== "undefined" &&
    window.localStorage &&
    typeof window.localStorage.getItem === "function"
  ) {
    return window.localStorage;
  }
  return null;
}

export const PermissionLevel = Object.freeze({
  READ_ONLY: 0,
  SAFE_LOCAL_CHECK: 1,
  PREPARE_ACTION: 2,
  APPROVAL_REQUIRED: 3,
  BLOCKED: 4
});

export function permissionLabel(level) {
  return {
    [PermissionLevel.READ_ONLY]: "Level 0 - Read Only",
    [PermissionLevel.SAFE_LOCAL_CHECK]: "Level 1 - Safe Local Check",
    [PermissionLevel.PREPARE_ACTION]: "Level 2 - Prepare Action",
    [PermissionLevel.APPROVAL_REQUIRED]: "Level 3 - Approval Required",
    [PermissionLevel.BLOCKED]: "Level 4 - Blocked"
  }[level] || "Unknown";
}

function readLog() {
  try {
    const storage = browserStorage();
    if (!storage) return memoryLog;
    return JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLog(log) {
  const nextLog = log.slice(0, 200);
  const storage = browserStorage();
  if (!storage) {
    memoryLog = nextLog;
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(nextLog));
}

export function addAuditEntry({ action, tool, permissionLevel, approved = false, blocked = false, result }) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    tool,
    permissionLevel,
    permission: permissionLabel(permissionLevel),
    approved,
    blocked,
    result
  };
  const log = [entry, ...readLog()];
  writeLog(log);
  return entry;
}

export function getAuditLog() {
  return readLog();
}

export function clearAuditLog() {
  memoryLog = [];
  const storage = browserStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}
