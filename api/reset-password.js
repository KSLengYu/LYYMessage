// api/reset-password.js
import bcrypt from 'bcryptjs';
import { supabase, corsHeaders } from './utils.js';

export default async function handler(req, res){
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) return res.status(400).json({ error:'missing' });
  if (!/^[A-Za-z0-9]{6,}$/.test(newPassword)) return res.status(400).json({ error:'password invalid (letters+digits, >=6)' });

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('otps').select('*').eq('email', email).eq('used', false).gt('expires_at', now).order('created_at',{ascending:false}).limit(5);
    if (error) return res.status(500).json({ error:'db error' });
    if (!data || data.length===0) return res.status(400).json({ error:'no valid otp' });

    let matched = null;
    for (const row of data) {
      const ok = await bcrypt.compare(otp, row.otp_hash);
      if (ok) { matched = row; break; }
    }
    if (!matched) return res.status(400).json({ error:'invalid otp' });

    // mark used
    await supabase.from('otps').update({ used:true }).eq('id', matched.id);

    // set password for user (create user if not exists)
    let { data: udata } = await supabase.from('users').select('*').eq('email', email).limit(1);
    let user = udata && udata[0];
    if (!user) {
      const { data: ins } = await supabase.from('users').insert([{ email }]).select().single();
      user = ins;
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password_hash: hash }).eq('id', user.id);
    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error('reset-password', e);
    return res.status(500).json({ error:'server error' });
  }
}
