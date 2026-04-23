// Webshare Rotating Proxy - routes ALL outgoing requests through rotating IPs
import { ProxyAgent } from 'undici';

const PROXY_HOST = process.env.PROXY_HOST || '';
const PROXY_PORT = process.env.PROXY_PORT || '';
const PROXY_USER = process.env.PROXY_USER || '';
const PROXY_PASS = process.env.PROXY_PASS || '';

let dispatcher: ProxyAgent | undefined;

if (PROXY_HOST && PROXY_PORT && PROXY_USER && PROXY_PASS) {
  const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
  dispatcher = new ProxyAgent(proxyUrl);
  console.log(`[Proxy] Webshare rotating proxy active -> ${PROXY_HOST}:${PROXY_PORT}`);
} else {
  console.warn('[Proxy] No proxy credentials found in .env — using direct connections');
}

export function getDispatcher(): ProxyAgent | undefined {
  return dispatcher;
}

/**
 * Proxy-aware fetch wrapper.
 * Every call goes through your Webshare rotating proxy,
 * so each request gets a random exit IP from your proxy pool.
 *
 * Falls back to direct fetch if proxy is not configured.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function proxyFetch(url: string, init?: RequestInit & { dispatcher?: any }): Promise<Response> {
  if (dispatcher) {
    return fetch(url, { ...init, dispatcher } as any);
  }
  return fetch(url, init);
}
