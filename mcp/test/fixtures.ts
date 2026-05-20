import { TelaClient } from "../src/client.js";

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

export interface MockResponseSpec {
  status?: number;
  body: unknown;
}

export function makeMockClient(spec: MockResponseSpec): {
  client: TelaClient;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers as Record<string, string>;
      for (const k of Object.keys(h)) headers[k] = h[k];
    }
    requests.push({ url, method, headers });
    return new Response(JSON.stringify(spec.body), {
      status: spec.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const client = new TelaClient({
    baseUrl: "http://test.local",
    apiKey: "tela_pat_test",
    fetchImpl,
    retryDelayMs: 1,
  });
  return { client, requests };
}

export function makeFlakyClient(specs: MockResponseSpec[]): {
  client: TelaClient;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  let i = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers as Record<string, string>;
      for (const k of Object.keys(h)) headers[k] = h[k];
    }
    requests.push({ url, method, headers });
    const spec = specs[Math.min(i, specs.length - 1)];
    i++;
    return new Response(JSON.stringify(spec.body), {
      status: spec.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const client = new TelaClient({
    baseUrl: "http://test.local",
    apiKey: "tela_pat_test",
    fetchImpl,
    retryDelayMs: 1,
  });
  return { client, requests };
}
