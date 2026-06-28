import axios from 'axios';
import { parseProxyUrl, buildProxyAgent } from 'juno-erp-client';
import { config } from './config.js';

// The ProxyOptions type isn't re-exported by name, so derive it from the helper.
export type ProxyOptions = ReturnType<typeof parseProxyUrl>;

const ERP_PROBE_URL = 'https://erp.mgmu.ac.in/login.htm';

let resolved: ProxyOptions | undefined;
let resolveDone = false;

/**
 * Forgets the cached proxy so the next {@link resolveProxy} call re-resolves.
 * Called after a request fails: a random free proxy may have died, and a fresh
 * pick should be attempted instead of failing until the process restarts.
 * No-op effect for explicit/no-proxy modes (re-resolving returns the same thing).
 */
export function invalidateProxy(): void {
  if (config.proxy.useRandom && !config.proxy.url) {
    resolveDone = false;
    resolved = undefined;
  }
}

/** Fetches a plain `ip:port` list of free proxies from ProxyScrape. */
async function fetchFreeProxies(protocol: string, country: string, timeoutMs: number): Promise<string[]> {
  const url = `https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies`
    + `&protocol=${protocol}&timeout=${timeoutMs}&country=${country}&proxy_format=ipport&format=text`;
  const res = await axios.get<string>(url, { responseType: 'text', timeout: timeoutMs });
  return String(res.data).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

/** Returns true if the proxy can reach the ERP. */
async function probe(proxy: ProxyOptions, timeout: number): Promise<boolean> {
  try {
    const agent = buildProxyAgent(proxy);
    const res = await axios.get(ERP_PROBE_URL, {
      httpAgent: agent, httpsAgent: agent, proxy: false, timeout,
      validateStatus: () => true,
    });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Resolves the proxy to use, once, based on config:
 *   - PROXY_URL set         → use it.
 *   - PROXY_USE_RANDOM=true  → pick the first reachable free proxy.
 *   - otherwise              → no proxy.
 * The result is cached for the process lifetime.
 */
export async function resolveProxy(): Promise<ProxyOptions | undefined> {
  if (resolveDone) return resolved;
  resolveDone = true;

  const { url, useRandom, randomProtocol, randomCountry, randomTries, timeout } = config.proxy;

  if (url) {
    resolved = parseProxyUrl(url);
    console.error(`[proxy] using ${resolved.protocol}://${resolved.host}:${resolved.port}`);
    return resolved;
  }

  if (useRandom) {
    console.error(`[proxy] fetching free ${randomProtocol} proxies (country=${randomCountry})…`);
    try {
      const list = await fetchFreeProxies(randomProtocol, randomCountry, timeout);
      for (const hp of shuffle(list).slice(0, randomTries)) {
        const [host, port] = hp.split(':');
        const candidate = { protocol: randomProtocol, host, port: Number(port) } as ProxyOptions;
        if (await probe(candidate, timeout)) {
          resolved = candidate;
          console.error(`[proxy] using random ${host}:${port}`);
          return resolved;
        }
      }
      console.error('[proxy] no free proxy responded — continuing without a proxy.');
    } catch (e) {
      console.error('[proxy] failed to fetch free proxies — continuing without a proxy:', (e as Error).message);
    }
  }

  resolved = undefined;
  return resolved;
}
