// api/guest-create.js
import { cookieSerialize, corsHeaders, supabase } from './utils.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'POST') { res.setHeader('Allow','POST,OPTIONS'); return res.status(405).json({ error:'Method not allowed' }); }

  // generate guest id
  const guestKey = 'guest_' + crypto.randomBytes(8).toString('hex');
  // set cookie for 24h
  const cookie = cookieSerialize('guest_id', guestKey, { maxAge: 24*3600, httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', path: '/' });
  res.setHeader('Set-Cookie', cookie);

  // optionally insert a row in guest_posts tracking (not necessary here)
  try {
    await supabase.from('guest_posts').insert([{ guest_key: guestKey }]);
  } catch (e) { /* ignore */ }

  return res.status(200).json({ ok:true, guest_id: guestKey });
}
