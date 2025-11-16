// api/unbind-qq.js
import { supabase, verifyJwt, corsHeaders } from './utils.js';

export default async function handler(req, res){
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  const cookie = req.headers.cookie || '';
  const tokenMatch = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('token='));
  if (!tokenMatch) return res.status(401).json({ error:'not authenticated' });
  const token = decodeURIComponent(tokenMatch.split('=')[1]);
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error:'invalid token' });

  try {
    const { error } = await supabase.from('users').update({ qq_id: null, qq_name: null, qq_avatar: null }).eq('id', payload.user_id);
    if (error) return res.status(500).json({ error:'db error' });
    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error('unbind-qq', e);
    return res.status(500).json({ error:'server error' });
  }
}
