// Defensive startup compat-check against GET /api/version. The backend may
// report non-semver values (dev builds: version="dev", untagged commits emit
// short SHAs from `git describe --tags --always --dirty`). `semver.gt(...)`
// throws on non-semver input, so the entire probe is wrapped and any non-
// semver branch downgrades to an advisory rather than blocking startup.

import semver from "semver";

export interface VersionInfo {
  version: string;
  commit: string;
  built_at: string;
}

export interface VersionCheckDeps {
  baseUrl: string;
  builtAgainst: string;
  fetchImpl?: typeof fetch;
  logger?: (msg: string) => void;
}

export async function runVersionCheck(deps: VersionCheckDeps): Promise<VersionInfo | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const log = deps.logger ?? ((m) => console.error(m));
  const url = deps.baseUrl.replace(/\/+$/, "") + "/api/version";
  let v: VersionInfo | null = null;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) {
      log(`[tela-mcp] version probe HTTP ${res.status}; tool calls will still be attempted.`);
      return null;
    }
    v = (await res.json()) as VersionInfo;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[tela-mcp] version probe failed (${msg}); tool calls will still be attempted.`);
    return null;
  }

  try {
    if (!v || typeof v.version !== "string") {
      log(`[tela-mcp] version probe returned no version field; skipping compat check.`);
      return v;
    }
    if (!semver.valid(v.version) || !semver.valid(deps.builtAgainst)) {
      log(
        `[tela-mcp] backend version=${v.version} built_against=${deps.builtAgainst} — ` +
          `skipping semver compat check (non-semver value).`,
      );
      return v;
    }
    if (semver.gt(v.version, deps.builtAgainst)) {
      log(
        `[tela-mcp] backend version ${v.version} > built-against ${deps.builtAgainst}; ` +
          `some tools may fail. Update: npm install -g tela-mcp@latest`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[tela-mcp] semver compat check threw (${msg}); proceeding regardless.`);
  }
  return v;
}
