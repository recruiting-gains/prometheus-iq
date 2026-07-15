import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  writeSync
} from "node:fs";

const MAX_CONFIRMATION_BYTES = 192;

export function createControllingTtyConfirmation({
  input = process.stdin,
  output = process.stdout,
  ttyPath = "/dev/tty"
} = {}) {
  return Object.freeze({
    confirm(action, expectedPhrase) {
      if (!input?.isTTY || !output?.isTTY || typeof expectedPhrase !== "string") {
        throw new Error("controlling_tty_required");
      }
      const noFollow = constants.O_NOFOLLOW || 0;
      const noControllingTty = constants.O_NOCTTY || 0;
      let fd;
      try {
        fd = openSync(ttyPath, constants.O_RDWR | noFollow | noControllingTty);
        const ttyInfo = fstatSync(fd);
        const inputInfo = fstatSync(input.fd);
        const outputInfo = fstatSync(output.fd);
        if (!ttyInfo.isCharacterDevice()
          || !inputInfo.isCharacterDevice()
          || !outputInfo.isCharacterDevice()
          || ttyInfo.rdev !== inputInfo.rdev
          || ttyInfo.rdev !== outputInfo.rdev) {
          throw new Error("controlling_tty_required");
        }

        const prompt = [
          `Founder-attended action: ${action}`,
          "Type this exact confirmation phrase:",
          expectedPhrase,
          "> "
        ].join("\n");
        writeSync(fd, prompt, null, "utf8");

        const bytes = [];
        const byte = Buffer.alloc(1);
        while (bytes.length <= MAX_CONFIRMATION_BYTES) {
          const count = readSync(fd, byte, 0, 1, null);
          if (count !== 1) throw new Error("controlling_tty_required");
          if (byte[0] === 0x0a) break;
          if (byte[0] !== 0x0d) bytes.push(byte[0]);
        }
        byte.fill(0);
        if (bytes.length > MAX_CONFIRMATION_BYTES) return false;
        return Buffer.from(bytes).toString("utf8") === expectedPhrase;
      } finally {
        if (fd !== undefined) closeSync(fd);
      }
    }
  });
}
