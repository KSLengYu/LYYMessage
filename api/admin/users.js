// api/admin/users.js
import { supabase, verifyJwt, corsHeaders } from '../utils.js';

function parseCookie(header='') {
  return header.split(';').map(s=>s.trim()).reduce((acc,cur)=>{
    const [k,...rest]=cur.split('='); if(!k) return acc; acc[k]=decodeURIComponent(rest.join('=')); return acc;
  },{});
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));

  const cookieHeader = req.headers.cookie || '';
  const cookies = parseCookie(cookieHeader);
  const token = cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  const me = token ? verifyJwt(token) : null;
  if (!me) return res.status(401).json({ error:'not authenticated' });

  // check admin
  const { data: u } = await supabase.from('users').select('role').eq('id', me.user_id).limit(1).single();
  if (!u || u.role !== 'admin') return res.status(403).json({ error:'admin only' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('users').select('id,email,qq_id,qq_name,qq_avatar,role,is_banned,created_at').order('created_at',{ascending:false}).limit(200);
    if (error) return res.status(500).json({ error:'db error' });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { action, user_id } = req.body || {};
    if (!action || !user_id) return res.status(400).json({ error:'missing' });
    if (action === 'ban') {
      const { error } = await supabase.from('users').update({ is_banned:true }).eq('id', user_id);
      if (error) return res.status(500).json({ error:'db error' });
      return res.status(200).json({ ok:true });
    } else if (action === 'unban') {
      const { error } = await supabase.from('users').update({ is_banned:false }).eq('id', user_id);
      if (error) return res.status(500).json({ error:'db error' });
      return res.status(200).json({ ok:true });
    } else {
      return res.status(400).json({ error:'unknown action' });
    }
  }

  return res.status(405).json({ error:'Method not allowed' });
}
