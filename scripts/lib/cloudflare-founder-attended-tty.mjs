import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  writeSync
} from "node:fs";

const MAX_CONFIRMATION_BYTES = 192;
const CONTROLLING_TTY_PATH = "/dev/tty";
const CONTROLLING_TTY_ERROR = "controlling_tty_required";
const REAL_TTY_OPERATIONS = Object.freeze({
  closeSync,
  fstatSync,
  openSync,
  readSync,
  writeSync
});

function controllingTtyError() {
  return new Error(CONTROLLING_TTY_ERROR);
}

function validDeviceId(value) {
  return (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    || (typeof value === "bigint" && value >= 0n);
}

function createConfirmation({ input, output, ttyPath, operations }) {
  return Object.freeze({
    confirm(action, expectedPhrase) {
      if (input?.isTTY !== true
        || output?.isTTY !== true
        || !Number.isInteger(input.fd)
        || !Number.isInteger(output.fd)
        || typeof action !== "string"
        || action.length === 0
        || typeof expectedPhrase !== "string"
        || Buffer.byteLength(expectedPhrase, "utf8") === 0
        || Buffer.byteLength(expectedPhrase, "utf8") > MAX_CONFIRMATION_BYTES) {
        throw controllingTtyError();
      }

      const noFollow = constants.O_NOFOLLOW || 0;
      const noControllingTty = constants.O_NOCTTY || 0;
      let fd;
      try {
        const inputInfo = operations.fstatSync(input.fd);
        const outputInfo = operations.fstatSync(output.fd);
        if (!inputInfo.isCharacterDevice()
          || !outputInfo.isCharacterDevice()
          || !validDeviceId(inputInfo.rdev)
          || inputInfo.rdev !== outputInfo.rdev) {
          throw controllingTtyError();
        }

        fd = operations.openSync(
          ttyPath,
          constants.O_RDWR | noFollow | noControllingTty
        );
        const ttyInfo = operations.fstatSync(fd);
        if (!ttyInfo.isCharacterDevice()) throw controllingTtyError();

        const prompt = Buffer.from([
          `Founder-attended action: ${action}`,
          "Type this exact confirmation phrase:",
          expectedPhrase,
          "> "
        ].join("\n"), "utf8");
        try {
          let offset = 0;
          while (offset < prompt.length) {
            const count = operations.writeSync(fd, prompt, offset, prompt.length - offset, null);
            if (!Number.isInteger(count) || count < 1) throw controllingTtyError();
            offset += count;
          }
        } finally {
          prompt.fill(0);
        }

        const bytes = [];
        const byte = Buffer.alloc(1);
        try {
          while (bytes.length <= MAX_CONFIRMATION_BYTES) {
            const count = operations.readSync(fd, byte, 0, 1, null);
            if (count !== 1) throw controllingTtyError();
            if (byte[0] === 0x0a) break;
            if (byte[0] !== 0x0d) bytes.push(byte[0]);
          }
          if (bytes.length > MAX_CONFIRMATION_BYTES) return false;
          const response = Buffer.from(bytes);
          try {
            return response.toString("utf8") === expectedPhrase;
          } finally {
            response.fill(0);
          }
        } finally {
          byte.fill(0);
          bytes.fill(0);
        }
      } catch {
        throw controllingTtyError();
      } finally {
        if (fd !== undefined) {
          try {
            operations.closeSync(fd);
          } catch {
            throw controllingTtyError();
          }
        }
      }
    }
  });
}

export function createControllingTtyConfirmation() {
  return createConfirmation({
    input: process.stdin,
    output: process.stdout,
    ttyPath: CONTROLLING_TTY_PATH,
    operations: REAL_TTY_OPERATIONS
  });
}

export function createControllingTtyConfirmationTestOnly(options) {
  const operationNames = ["closeSync", "fstatSync", "openSync", "readSync", "writeSync"];
  if (!options
    || typeof options !== "object"
    || !options.input
    || !options.output
    || typeof options.ttyPath !== "string"
    || options.ttyPath.length === 0
    || !options.operations
    || !operationNames.every(name => typeof options.operations[name] === "function")) {
    throw new Error("controlling_tty_test_composition_invalid");
  }
  return createConfirmation(options);
}
