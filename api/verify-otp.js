// api/verify-otp.js
import bcrypt from 'bcryptjs';
import { supabase, signJwt, cookieSerialize, corsHeaders } from './utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'POST') { res.setHeader('Allow','POST,OPTIONS'); return res.status(405).json({ error:'Method not allowed' }); }

  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ error:'missing email or otp' });

    const now = new Date().toISOString();
    const { data, error } = await supabase.from('otps').select('*').eq('email', email).eq('used', false).gt('expires_at', now).order('created_at',{ascending:false}).limit(5);
    if (error) { console.error('supabase otps select error', error); return res.status(500).json({ error:'db error' }); }
    if (!data || data.length === 0) return res.status(400).json({ error:'no valid otp found' });

    let matched = null;
    for (const row of data) {
      const ok = await bcrypt.compare(otp, row.otp_hash);
      if (ok) { matched = row; break; }
    }
    if (!matched) return res.status(400).json({ error:'invalid otp' });

    // mark used
    await supabase.from('otps').update({ used: true }).eq('id', matched.id);

    // create or get user
    const { data: udata } = await supabase.from('users').select('*').eq('email', email).limit(1);
    let user = udata && udata[0];
    if (!user) {
      const { data: ins } = await supabase.from('users').insert([{ email }]).select().single();
      user = ins;
    }

    // sign token and set cookie
    const token = signJwt({ user_id: user.id, email: user.email });
    const isProd = process.env.NODE_ENV === 'production' || (req.headers.host && req.headers.host.includes('vercel'));
    const cookie = cookieSerialize('token', token, { maxAge: 7*24*3600, httpOnly:true, secure:isProd, sameSite:'None', path:'/' });
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ ok:true, email: user.email });
  } catch (err) {
    console.error('verify-otp error', err);
    return res.status(500).json({ error:'verify failed' });
  }
}
