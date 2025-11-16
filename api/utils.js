// api/utils.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** pick random SMTP config from env: SMTP_1_HOST ... SMTP_N_PASS */
export function pickRandomSmtp() {
  const count = parseInt(process.env.SMTP_COUNT || '1', 10);
  const i = Math.floor(Math.random() * count) + 1;
  return {
    host: process.env[`SMTP_${i}_HOST`],
    port: parseInt(process.env[`SMTP_${i}_PORT`] || '587', 10),
    user: process.env[`SMTP_${i}_USER`],
    pass: process.env[`SMTP_${i}_PASS`],
    secure: (process.env[`SMTP_${i}_SECURE`] === 'true')
  };
}

/** JWT helpers */
export function signJwt(payload, opts = {}) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const token = jwt.sign(payload, secret, { expiresIn: opts.expiresIn || '7d' });
  return token;
}
export function verifyJwt(token) {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

/** hash OTP / password */
export async function hashOtp(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

/** cookie serializer */
export function cookieSerialize(name, val, options = {}) {
  const parts = [];
  const encoded = encodeURIComponent(val);
  parts.push(`${name}=${encoded}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${new Date(options.expires).toUTCString()}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join('; ');
}

/** CORS headers */
export function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  else headers['Access-Control-Allow-Origin'] = '*';
  return headers;
}

/** simple cookie parser */
export function parseCookie(cookieHeader = '') {
  const obj = {};
  cookieHeader.split(';').forEach(pair => {
    const [k, ...rest] = pair.trim().split('=');
    if (!k) return;
    obj[k] = decodeURIComponent(rest.join('=') || '');
  });
  return obj;
}
