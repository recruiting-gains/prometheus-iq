export const githubBackupChecklist = [
  "Check `git status --short`.",
  "Review every changed file before staging.",
  "Confirm no secrets, API keys, tokens, passwords, `.env`, private keys, screenshots with secrets, or credential files are staged.",
  "Confirm `.env` and `.env.*` remain ignored.",
  "Confirm protected product and production files are not modified unless that was the explicit task.",
  "Run focused checks, tests, or build commands when code changed.",
  "Draft a clear commit message.",
  "Ask Cruz before committing.",
  "Ask Cruz before pushing.",
  "After push, confirm the branch is clean."
];

export function createGithubBackupChecklist() {
  return {
    title: "GitHub Backup Checklist",
    body: githubBackupChecklist.map((item, index) => `${index + 1}. ${item}`).join(" ")
  };
}

export function draftChiefOfStaffCommitMessage() {
  return {
    title: "Draft commit message",
    body: "feat: add Prometheus Companion daily chief of staff"
  };
}
