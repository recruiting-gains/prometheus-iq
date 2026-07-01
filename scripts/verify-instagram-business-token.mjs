const DEFAULT_GRAPH_VERSION = "v21.0";
const DEFAULT_ACCOUNT_FIELDS = "user_id,username,account_type";
const DEFAULT_INSIGHT_METRICS = "reach,profile_views,website_clicks";

function envValue(name, fallback = "") {
  return typeof process.env[name] === "string" && process.env[name].trim()
    ? process.env[name].trim()
    : fallback;
}

function safeProviderError(status, body = {}) {
  return {
    status,
    code: body?.error?.code || body?.error?.type || "provider_error",
    message: body?.error?.message || "Meta Instagram API request failed."
  };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function graphGet({ graphVersion, path, params = {}, accessToken }) {
  const url = new URL(`https://graph.instagram.com/${graphVersion}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  const body = await readJson(response);

  if (!response.ok) {
    return {
      ok: false,
      error: safeProviderError(response.status, body)
    };
  }

  return {
    ok: true,
    data: body,
    status: response.status
  };
}

async function main() {
  const accessToken = envValue("INSTAGRAM_ACCESS_TOKEN") || envValue("META_INSTAGRAM_ACCESS_TOKEN");
  if (!accessToken) {
    console.error(JSON.stringify({
      ok: false,
      message: "INSTAGRAM_ACCESS_TOKEN is required in the process environment. Do not pass it on the command line."
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const graphVersion = envValue("META_GRAPH_API_VERSION", DEFAULT_GRAPH_VERSION);
  const requestedAccount = envValue("INSTAGRAM_BUSINESS_ACCOUNT_ID") || envValue("INSTAGRAM_USER_ID") || "me";
  const generatedAt = new Date().toISOString();

  const account = await graphGet({
    graphVersion,
    path: requestedAccount,
    params: {
      fields: DEFAULT_ACCOUNT_FIELDS
    },
    accessToken
  });

  if (!account.ok) {
    console.error(JSON.stringify({
      ok: false,
      checkedAt: generatedAt,
      graphVersion,
      accountPath: requestedAccount,
      error: account.error
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const accountId = account.data.user_id || account.data.id || requestedAccount;
  const insights = await graphGet({
    graphVersion,
    path: `${accountId}/insights`,
    params: {
      metric: DEFAULT_INSIGHT_METRICS,
      period: "day"
    },
    accessToken
  });

  console.log(JSON.stringify({
    ok: true,
    checkedAt: generatedAt,
    graphVersion,
    apiMode: "instagram_login",
    account: {
      id: accountId,
      username: account.data.username || null,
      accountType: account.data.account_type || null
    },
    insights: insights.ok
      ? {
          ok: true,
          status: insights.status,
          metrics: Array.isArray(insights.data?.data)
            ? insights.data.data.map(metric => metric.name).filter(Boolean)
            : []
        }
      : {
          ok: false,
          error: insights.error
        },
    recommendedRuntimePatch: {
      INSTAGRAM_API_MODE: "instagram_login",
      INSTAGRAM_USER_ID: accountId,
      INSTAGRAM_ACCOUNT_HANDLE: account.data.username ? `@${account.data.username}` : "@prometheus.iq",
      INSTAGRAM_GRANTED_SCOPES: "instagram_business_basic,instagram_business_manage_insights",
      INSTAGRAM_CONNECTION_VERIFIED_AT: generatedAt
    }
  }, null, 2));
}

await main();
