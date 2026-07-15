import {
  closeSync,
  constants,
  fstatSync,
  openSync
} from "node:fs";

import {
  createControllingTtyConfirmation
} from "../../scripts/lib/cloudflare-founder-attended-tty.mjs";

const expectedPhrase = "CONFIRM SYNTHETIC PROMETHEUS MACOS PTY TEST";
const marker = "PROMETHEUS_MACOS_TTY_RESULT=";

try {
  const confirmed = createControllingTtyConfirmation().confirm(
    "macos-pty-integration",
    expectedPhrase
  );
  const ttyFd = openSync(
    "/dev/tty",
    constants.O_RDWR | (constants.O_NOFOLLOW || 0) | (constants.O_NOCTTY || 0)
  );
  let inputInfo;
  let outputInfo;
  let ttyInfo;
  try {
    inputInfo = fstatSync(process.stdin.fd);
    outputInfo = fstatSync(process.stdout.fd);
    ttyInfo = fstatSync(ttyFd);
  } finally {
    closeSync(ttyFd);
  }
  const result = Object.freeze({
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
    stdinCharacterDevice: inputInfo.isCharacterDevice(),
    stdoutCharacterDevice: outputInfo.isCharacterDevice(),
    controllingTtyCharacterDevice: ttyInfo.isCharacterDevice(),
    streamRdevsEqual: inputInfo.rdev === outputInfo.rdev,
    controllingTtyAliasRdevDiffers: ttyInfo.rdev !== inputInfo.rdev,
    confirmed
  });
  process.stdout.write(`\n${marker}${JSON.stringify(result)}\n`);
  if (Object.values(result).some(value => value !== true)) process.exitCode = 1;
} catch {
  process.stdout.write(`\n${marker}${JSON.stringify({ failedClosed: true })}\n`);
  process.exitCode = 1;
}
