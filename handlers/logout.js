// api/logout.js
import { cookieSerialize, corsHeaders } from './utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
  // clear cookie
  const cookie = cookieSerialize('token', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'None', path: '/' });
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok:true });
}
