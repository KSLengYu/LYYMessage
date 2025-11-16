// api/login-password.js
import bcrypt from 'bcryptjs';
import { supabase, signJwt, cookieSerialize, corsHeaders } from './utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'POST') { res.setHeader('Allow','POST,OPTIONS'); return res.status(405).json({ error:'Method not allowed' }); }

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error:'missing' });

  try {
    const { data } = await supabase.from('users').select('id,email,password_hash,is_banned').eq('email', email).limit(1);
    if (!data || data.length === 0) return res.status(401).json({ error:'invalid credentials' });
    const user = data[0];
    if (user.is_banned) return res.status(403).json({ error:'banned' });
    if (!user.password_hash) return res.status(400).json({ error:'password not set' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error:'invalid credentials' });

    const token = signJwt({ user_id: user.id, email: user.email });
    const isProd = process.env.NODE_ENV === 'production';
    const cookie = cookieSerialize('token', token, { maxAge:7*24*3600, httpOnly:true, secure:isProd, sameSite:'None', path:'/' });
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ ok:true, email: user.email });
  } catch (err) {
    console.error('login-password err', err);
    return res.status(500).json({ error:'server error' });
  }
}
