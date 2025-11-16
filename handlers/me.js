// api/me.js
import { verifyJwt, supabase, corsHeaders } from './utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'GET') { res.setHeader('Allow','GET,OPTIONS'); return res.status(405).json({ error:'Method not allowed' }); }

  const cookie = req.headers.cookie || '';
  const tokenMatch = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('token='));
  if (!tokenMatch) return res.status(401).json({ error:'not authenticated' });
  const token = decodeURIComponent(tokenMatch.split('=')[1]);
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error:'invalid token' });

  try {
    const { data } = await supabase.from('users').select('id,email,display_name,qq_id,qq_name,qq_avatar,role,is_banned').eq('id', payload.user_id).limit(1);
    if (!data || data.length === 0) return res.status(200).json({ email: payload.email });
    const u = data[0];
    return res.status(200).json({
      id: u.id, email: u.email, display_name: u.display_name,
      qq_id: u.qq_id, qq_name: u.qq_name, qq_avatar: u.qq_avatar,
      role: u.role, is_banned: u.is_banned
    });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ error:'server error' });
  }
}
