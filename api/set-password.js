// api/set-password.js
import bcrypt from 'bcryptjs';
import { supabase, verifyJwt, corsHeaders } from './utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'POST') { res.setHeader('Allow','POST,OPTIONS'); return res.status(405).json({ error:'Method not allowed' }); }

  const cookie = req.headers.cookie || '';
  const tokenMatch = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('token='));
  if (!tokenMatch) return res.status(401).json({ error:'not authenticated' });
  const token = decodeURIComponent(tokenMatch.split('=')[1]);
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error:'invalid token' });

  const { oldPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error:'password too short' });

  try {
    const { data } = await supabase.from('users').select('password_hash').eq('id', payload.user_id).limit(1);
    const user = data && data[0];
    if (user && user.password_hash) {
      if (!oldPassword) return res.status(400).json({ error:'old password required' });
      const ok = await bcrypt.compare(oldPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error:'old password wrong' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from('users').update({ password_hash: newHash }).eq('id', payload.user_id);
    if (error) { console.error('set-password update err', error); return res.status(500).json({ error:'db error' }); }
    return res.status(200).json({ ok:true });
  } catch (err) {
    console.error('set-password err', err);
    return res.status(500).json({ error:'server error' });
  }
}
