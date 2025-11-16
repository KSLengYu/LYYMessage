// api/bind-qq.js
import fetch from 'node-fetch';
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

  const { qq } = req.body || {};
  if (!qq) return res.status(400).json({ error:'missing qq' });

  try {
    // fetch portrait - returns JSONP
    const endpoint = `https://r.qzone.qq.com/fcg-bin/cgi_get_portrait.fcg?uins=${qq}`;
    const r = await fetch(endpoint);
    const txt = await r.text();
    let nickname = '';
    try {
      const s = txt.indexOf('(');
      const e = txt.lastIndexOf(')');
      const inner = txt.substring(s+1, e);
      const obj = JSON.parse(inner);
      const key = Object.keys(obj)[0];
      const arr = obj[key];
      nickname = Array.isArray(arr) && arr.length>0 ? (arr[6] || arr[0] || '') : '';
    } catch (e) {
      nickname = '';
    }
    const avatar = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`;

    const { error } = await supabase.from('users').update({ qq_id: qq, qq_name: nickname, qq_avatar: avatar }).eq('id', payload.user_id);
    if (error) { console.error('supabase bind qq error', error); return res.status(500).json({ error:'db error' }); }

    return res.status(200).json({ ok:true, qq, qq_name: nickname, qq_avatar: avatar });
  } catch (err) {
    console.error('bind-qq error', err);
    return res.status(500).json({ error:'server error' });
  }
}
