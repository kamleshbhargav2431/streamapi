// Webshare Rotating Proxy - routes ALL outgoing requests through rotating IPs
import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY_HOST = process.env.PROXY_HOST || '';
const PROXY_PORT = process.env.PROXY_PORT || '';
const PROXY_USER = process.env.PROXY_USER || '';
const PROXY_PASS = process.env.PROXY_PASS || '';

let proxyAgent: HttpsProxyAgent<string> | undefined;

if (PROXY_HOST && PROXY_PORT && PROXY_USER && PROXY_PASS) {
  const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
  proxyAgent = new HttpsProxyAgent(proxyUrl);
  console.log(`[Proxy] Webshare rotating proxy active -> ${PROXY_HOST}:${PROXY_PORT}`);
} else {
  console.warn('[Proxy] No proxy credentials found in .env — using direct connections');
}

/**
 * Proxy-aware fetch wrapper.
 * Uses Node.js native http/https + https-proxy-agent to route every
 * request through your Webshare rotating proxy. Each request gets a
 * random exit IP from your proxy pool.
 *
 * Falls back to native fetch if proxy is not configured.
 */
export async function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  // No proxy configured — use direct fetch
  if (!proxyAgent) {
    return fetch(url, init);
  }

  return new Promise<Response>((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';

    const reqHeaders: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
      Host: parsedUrl.host,
    };

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: (init?.method as string) || 'GET',
      headers: reqHeaders,
      agent: proxyAgent,
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        // Build standard Response object so the rest of the code works unchanged
        const response = new Response(body, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || '',
          headers: res.headers as HeadersInit,
        });
        resolve(response);
      });
    });

    req.on('error', reject);

    // Support AbortSignal timeout
    if (init?.signal) {
      init.signal.addEventListener('abort', () => {
        req.destroy(new DOMException('Aborted', 'AbortError'));
      });
    }

    // Write request body for POST/PUT
    if (init?.body) {
      req.write(typeof init.body === 'string' ? init.body : init.body);
    }

    req.end();
  });
}
