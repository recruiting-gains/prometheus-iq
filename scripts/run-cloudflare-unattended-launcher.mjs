import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES,
  runCloudflareUnattendedLauncher
} from "./lib/cloudflare-unattended-launcher.mjs";

function parseProfile(argv) {
  if (argv.length !== 1 || !argv[0].startsWith("--profile=")) {
    throw new Error(`Exactly one fixed profile is required: ${CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES.join(", ")}`);
  }
  const profile = argv[0].slice("--profile=".length);
  if (!CLOUDFLARE_UNATTENDED_LAUNCH_PROFILES.includes(profile)) throw new Error("launcher_profile_invalid");
  return profile;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = runCloudflareUnattendedLauncher({
      profile: parseProfile(process.argv.slice(2))
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Cloudflare unattended launcher blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
