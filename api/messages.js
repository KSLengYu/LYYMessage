// api/messages.js
import { supabase, verifyJwt, corsHeaders } from './utils.js';
import fetch from 'node-fetch';

/** helper to parse cookies */
function parseCookie(header='') {
  return header.split(';').map(s=>s.trim()).reduce((acc,cur)=>{
    const [k,...rest]=cur.split('='); if(!k) return acc; acc[k]=decodeURIComponent(rest.join('=')); return acc;
  },{});
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));

  // GET: list messages (with optional parent_id for replies)
  if (req.method === 'GET') {
    const q = req.query || {};
    const parent_id = q.parent_id || null;
    const limit = parseInt(q.limit || '50', 10);
    try {
      let query = supabase.from('messages').select('*').order('created_at',{ascending:false}).limit(limit);
      if (parent_id) query = supabase.from('messages').select('*').eq('parent_id', parent_id).order('created_at',{ascending:true});
      const { data, error } = await query;
      if (error) { console.error('messages get error', error); return res.status(500).json({ error:'db error' }); }
      // For each message, enrich with user qq info if exists
      const enriched = await Promise.all((data||[]).map(async m => {
        if (m.user_id) {
          const { data: u } = await supabase.from('users').select('qq_id,qq_name,qq_avatar,display_name').eq('id', m.user_id).limit(1);
          if (u && u[0]) {
            return { ...m, qq_id: u[0].qq_id, qq_name: u[0].qq_name, qq_avatar: u[0].qq_avatar, display_name: u[0].display_name };
          }
        }
        return m;
      }));
      return res.status(200).json(enriched);
    } catch (err) {
      console.error('messages get err', err);
      return res.status(500).json({ error:'server error' });
    }
  }

  // POST: create message (auth or guest)
  if (req.method === 'POST') {
    const body = req.body || {};
    const content = (body.content || '').toString().trim();
    const parent_id = body.parent_id || null;
    if (!content) return res.status(400).json({ error:'content required' });

    // auth: token or guest cookie
    const cookieHeader = req.headers.cookie || '';
    const cookies = parseCookie(cookieHeader);
    let userId = null, email = null, isGuest = false, guestKey = null;

    const token = cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (token) {
      const payload = verifyJwt(token);
      if (!payload) return res.status(401).json({ error:'invalid token' });
      userId = payload.user_id; email = payload.email;
      // check banned
      try {
        const { data: u } = await supabase.from('users').select('is_banned').eq('id', userId).limit(1).single();
        if (u && u.is_banned) return res.status(403).json({ error:'banned' });
      } catch (e) {}
    } else {
      guestKey = cookies.guest_id || req.headers['x-guest-key'] || null;
      if (!guestKey) return res.status(401).json({ error:'guest not initialized' });
      isGuest = true;
      // check guest limit
      try {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const { count } = await supabase.from('messages').select('id',{ count:'exact' }).eq('is_guest', true).eq('email', guestKey).gte('created_at', todayStart.toISOString());
        const limit = parseInt(process.env.GUEST_DAILY_LIMIT || '5', 10);
        if (count >= limit) return res.status(403).json({ error:'guest limit reached' });
      } catch (e) {}
    }

    // capture ip and device
    const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    const device = ua.slice(0, 300);

    // ip location via ip-api.com (free)
    let ip_location = '';
    try {
      if (ip && ip !== '::1' && !ip.startsWith('127.')) {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
        const geo = await geoRes.json();
        if (geo && geo.status === 'success') ip_location = `${geo.country||''} ${geo.regionName||''} ${geo.city||''}`.trim();
      }
    } catch (e) { console.warn('geo error', e); }

    const insertObj = {
      content, parent_id,
      user_id: userId,
      email: userId ? email : guestKey,
      is_guest: isGuest,
      ip, ip_location, device
    };

    try {
      const { data, error } = await supabase.from('messages').insert([insertObj]).select().single();
      if (error) { console.error('messages insert err', error); return res.status(500).json({ error:'db error' }); }
      // optional: insert into audit table
      try {
        await supabase.from('message_audit').insert([{ message_id: data.id, action:'created', actor_user_id: userId }]);
      } catch (e) {}
      return res.status(200).json({ ok:true, message: data });
    } catch (err) {
      console.error('messages post err', err);
      return res.status(500).json({ error:'server error' });
    }
  }

  // POST /undo or /restore or DELETE endpoints could be separate routes;
  // for simplicity implement simple undo and restore via query param action
  if (req.method === 'PUT') {
    const { action, id } = req.query || {};
    if (!id) return res.status(400).json({ error:'missing id' });
    const cookieHeader = req.headers.cookie || '';
    const cookies = parseCookie(cookieHeader);
    const token = cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const payload = token ? verifyJwt(token) : null;
    try {
      const { data: msg } = await supabase.from('messages').select('*').eq('id', id).limit(1).single();
      if (!msg) return res.status(404).json({ error:'message not found' });
      // check permissions
      const isAuthor = payload && payload.user_id && msg.user_id === payload.user_id;
      // load user role
      let isAdmin = false;
      if (payload) {
        const { data: u } = await supabase.from('users').select('role').eq('id', payload.user_id).limit(1).single();
        isAdmin = u && u.role === 'admin';
      }
      if (action === 'undo') {
        // only author (within 30m) or admin
        const canUndo = isAdmin || (isAuthor && (new Date() - new Date(msg.created_at) <= 30*60*1000));
        if (!canUndo) return res.status(403).json({ error:'forbidden' });
        const { error } = await supabase.from('messages').update({ deleted:true, deleted_at:new Date().toISOString(), deleted_by: payload ? payload.user_id : null }).eq('id', id);
        if (error) return res.status(500).json({ error:'db error' });
        return res.status(200).json({ ok:true });
      } else if (action === 'restore') {
        // only admin or author
        const canRestore = isAdmin || isAuthor;
        if (!canRestore) return res.status(403).json({ error:'forbidden' });
        const { error } = await supabase.from('messages').update({ deleted:false, restored:true, deleted_at:null, deleted_by:null }).eq('id', id);
        if (error) return res.status(500).json({ error:'db error' });
        return res.status(200).json({ ok:true });
      } else {
        return res.status(400).json({ error:'unknown action' });
      }
    } catch (err) {
      console.error('messages put err', err);
      return res.status(500).json({ error:'server error' });
    }
  }

  return res.status(405).json({ error:'Method not allowed' });
}
