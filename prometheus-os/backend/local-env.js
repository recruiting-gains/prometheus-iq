import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = normalize(join(backendDir, "../.."));

const envFileCandidates = [
  process.env.PROMETHEUS_OS_ENV_FILE,
  join(process.cwd(), ".env"),
  join(process.cwd(), "prometheus-os/backend/.env"),
  join(backendDir, ".env"),
  join(projectRoot, ".env")
].filter(Boolean);

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (!/^[A-Z0-9_]+$/.test(key)) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadLocalEnv() {
  for (const filePath of envFileCandidates) {
    if (!existsSync(filePath)) continue;

    const contents = readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;

      if (!process.env[parsed.key]) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}
