import 'dotenv/config';

/** Credentials for one role. `undefined` when not configured. */
export interface Credentials {
  email: string;
  password: string;
}

function creds(emailKey: string, passwordKey: string, fallback?: Credentials): Credentials | undefined {
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  if (email && password) return { email, password };
  return fallback;
}

const bool = (v: string | undefined) => v === '1' || v?.toLowerCase() === 'true';

// Legacy `email`/`password` are treated as the student credentials.
const legacy = creds('email', 'password');

export const config = {
  port: Number(process.env.PORT || 8987),
  /** Public base URL the AI uses to reach this server (for image proxy links). */
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 8987}`).replace(/\/$/, ''),

  student: creds('STUDENT_EMAIL', 'STUDENT_PASSWORD', legacy),
  employee: creds('EMPLOYEE_EMAIL', 'EMPLOYEE_PASSWORD'),

  proxy: {
    /** Explicit proxy URL, e.g. http://user:pass@host:8080 or socks5://host:1080. */
    url: process.env.PROXY_URL?.trim() || undefined,
    /** When true and no explicit url, auto-pick a working free proxy. */
    useRandom: bool(process.env.PROXY_USE_RANDOM),
    randomProtocol: process.env.PROXY_RANDOM_PROTOCOL || 'http',
    randomCountry: process.env.PROXY_RANDOM_COUNTRY || 'in',
    randomTries: Number(process.env.PROXY_RANDOM_TRIES || 8),
    timeout: Number(process.env.PROXY_TIMEOUT || 15000),
  },
};

export type Role = 'student' | 'employee';
