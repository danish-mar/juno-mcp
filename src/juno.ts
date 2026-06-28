import axios from 'axios';
import { StudentClient, EmployeeClient, buildProxyAgent } from 'juno-erp-client';
import { config, type Role } from './config.js';
import { resolveProxy, invalidateProxy } from './proxy.js';

type AnyClient = StudentClient | EmployeeClient;

// One cached session (exported cookie jar) per role.
const sessions: Record<Role, any> = { student: null, employee: null };

function credsFor(role: Role) {
  const c = config[role];
  if (!c) {
    throw new Error(
      `No ${role} credentials configured. Set ${role.toUpperCase()}_EMAIL and ${role.toUpperCase()}_PASSWORD in your .env.`
    );
  }
  return c;
}

async function makeClient(role: Role): Promise<AnyClient> {
  const proxy = await resolveProxy();
  return role === 'student'
    ? new StudentClient({ debug: false, proxy })
    : new EmployeeClient({ debug: false, proxy });
}

async function refreshSession(role: Role): Promise<any> {
  const { email, password } = credsFor(role);
  const client = await makeClient(role);
  const ok = await client.login(email, password);
  if (!ok) throw new Error(`${role} login failed`);
  sessions[role] = client.exportSession();
  return sessions[role];
}

async function getClient(role: Role): Promise<AnyClient> {
  const client = await makeClient(role);
  if (!sessions[role]) await refreshSession(role);
  client.importSession(sessions[role]);
  return client;
}

function looksLikeLoginPage(value: unknown): boolean {
  const s = typeof value === 'string' ? value : String((value as any)?.message ?? '');
  return s.includes('<!DOCTYPE') || s.includes('Unexpected token') || s.includes('not valid JSON');
}

/**
 * A transport-level failure (dead/slow proxy, connection drop) rather than a
 * session-expiry. A cached random free proxy that has died surfaces here.
 */
function looksLikeNetworkError(error: any): boolean {
  const code = String(error?.code ?? '');
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNABORTED', 'EPROTO'].includes(code)) {
    return true;
  }
  const msg = String(error?.message ?? '').toLowerCase();
  return msg.includes('socket hang up') || msg.includes('tunneling socket') ||
    msg.includes('timeout') || msg.includes('network') || msg.includes('proxy');
}

/**
 * Runs an operation against a freshly-restored client. Retries on session
 * expiry (re-login) and on transport failures (drop the cached proxy so a fresh
 * one is picked) — so a dead free proxy self-heals without a container restart.
 */
async function withClient<T>(role: Role, operation: (client: any) => Promise<T>): Promise<T> {
  let attempts = 0;
  let lastError: unknown;
  while (attempts < 3) {
    try {
      const client = await getClient(role);
      const result = await operation(client);
      if (typeof result === 'string' && result.startsWith('<!DOCTYPE')) {
        await refreshSession(role);
        attempts++;
        continue;
      }
      return result;
    } catch (error: any) {
      lastError = error;
      if (looksLikeNetworkError(error)) {
        console.error(`[${role}] transport error (${error?.code ?? error?.message}); rotating proxy (attempt ${attempts + 1})`);
        invalidateProxy();
        sessions[role] = null; // force a fresh login through the new proxy
        attempts++;
        continue;
      }
      if (looksLikeLoginPage(error)) {
        console.error(`[${role}] login redirect detected, refreshing session (attempt ${attempts + 1})`);
        await refreshSession(role);
        attempts++;
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    `Operation failed after ${attempts} attempts for the ${role} session: ${(lastError as Error)?.message ?? lastError}`
  );
}

/** Type-safe wrappers so tool callbacks get the right client type. */
export const withStudent = <T>(op: (c: StudentClient) => Promise<T>): Promise<T> => withClient('student', op);
export const withEmployee = <T>(op: (c: EmployeeClient) => Promise<T>): Promise<T> => withClient('employee', op);

export function isEmployeeConfigured(): boolean {
  return !!config.employee;
}

// ============================================
// Authenticated image proxy
// ============================================

/** ERP image endpoints we are willing to proxy (prevents this becoming an open proxy). */
const ALLOWED_IMAGE_ENDPOINTS = ['getStudentProfileImageById.json', 'getEmployeeProfileImageById.json'];

export function isAllowedImagePath(relPath: string): boolean {
  const endpoint = relPath.split('?')[0];
  return ALLOWED_IMAGE_ENDPOINTS.includes(endpoint);
}

/** Builds a Cookie header from an exported tough-cookie session. */
function cookieHeader(session: any): string {
  const cookies = session?.cookies ?? [];
  return cookies.map((c: any) => `${c.key}=${c.value}`).join('; ');
}

/**
 * Fetches an authenticated student/employee profile image through the employee
 * session (the side that performs the university search). Refreshes once if the
 * server returns its login page.
 */
export async function fetchAuthenticatedImage(relPath: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!isAllowedImagePath(relPath)) {
    throw new Error(`Image path not allowed: ${relPath}`);
  }

  const proxy = await resolveProxy();
  const agent = proxy ? buildProxyAgent(proxy) : undefined;
  const url = `https://erp.mgmu.ac.in/${relPath}`;

  const doFetch = async () => {
    if (!sessions.employee) await refreshSession('employee');
    return axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      ...(agent && { httpAgent: agent, httpsAgent: agent, proxy: false as const }),
      headers: {
        'Cookie': cookieHeader(sessions.employee),
        'Referer': 'https://erp.mgmu.ac.in/search.htm',
        'User-Agent': 'Mozilla/5.0',
      },
      validateStatus: () => true,
    });
  };

  let res = await doFetch();
  let contentType = String(res.headers['content-type'] || '');

  // A login redirect comes back as HTML — refresh the session and retry once.
  if (res.status >= 300 || contentType.includes('text/html')) {
    await refreshSession('employee');
    res = await doFetch();
    contentType = String(res.headers['content-type'] || '');
  }

  if (res.status >= 300 || contentType.includes('text/html')) {
    throw new Error(`Failed to fetch image (status ${res.status}, type ${contentType || 'unknown'})`);
  }

  return { buffer: Buffer.from(res.data), contentType: contentType || 'image/jpeg' };
}

/** Rewrites a hit's relative ERP `imageUrl` to a public URL served by this MCP. */
export function toProxiedImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl || !isAllowedImagePath(imageUrl)) return imageUrl;
  return `${config.publicUrl}/img/${imageUrl}`;
}

export function trimData(obj: any): any {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimData);
  if (obj && typeof obj === 'object') {
    const trimmed: any = {};
    for (const key in obj) {
      if (key === 'studentAttendanceData' || key === 'worksheetIds') {
        const value = obj[key];
        trimmed[key] = typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value;
      } else {
        trimmed[key] = trimData(obj[key]);
      }
    }
    return trimmed;
  }
  return obj;
}
