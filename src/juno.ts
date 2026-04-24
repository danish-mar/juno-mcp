import { JunoClient } from "juno-erp-client";
import 'dotenv/config';

const email = process.env.email!;
const password = process.env.password!;

let session: any = null;

export async function refreshSession() {
  const client = new JunoClient({ debug: false });
  const success = await client.login(email, password);
  if (!success) throw new Error("Login failed");
  session = await client.exportSession();
  return session;
}

export async function getClient() {
  const client = new JunoClient({ debug: false });
  if (!session) {
    await refreshSession();
  }
  await client.importSession(session);
  return client;
}

export async function executeWithRetry<T>(operation: (client: JunoClient) => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const client = await getClient();
      const result = await operation(client);
      
      if (typeof result === 'string' && result.startsWith('<!DOCTYPE')) {
        console.error(`Login page detected in result. Refreshing session (attempt ${attempts + 1})`);
        await refreshSession();
        attempts++;
        continue;
      }
      return result;
    } catch (error: any) {
      const message = String(error?.message ?? error);
      if (message.includes('<!DOCTYPE') || message.includes('Unexpected token') || message.includes('not valid JSON')) {
        console.error(`Detected HTML/login redirect or JSON parse failure: ${message}. Refreshing session (attempt ${attempts + 1})`);
        await refreshSession();
        attempts++;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Operation failed after refreshing session multiple times");
}

export function trimData(obj: any): any {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimData);
  if (obj && typeof obj === 'object') {
    const trimmed: any = {};
    for (const key in obj) {
      if (key === 'studentAttendanceData' || key === 'worksheetIds') {
        const value = obj[key];
        if (typeof value === 'string') {
          trimmed[key] = value.length > 50 ? value.substring(0, 50) + '...' : value;
        } else {
          trimmed[key] = value;
        }
      } else {
        trimmed[key] = trimData(obj[key]);
      }
    }
    return trimmed;
  }
  return obj;
}
