// api/send-otp.js
import nodemailer from 'nodemailer';
import { supabase, pickRandomSmtp, hashOtp, corsHeaders } from './utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  const headers = corsHeaders(req); Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));

  if (req.method !== 'POST') { res.setHeader('Allow','POST,OPTIONS'); return res.status(405).json({ error:'Method not allowed' }); }

  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error:'missing email' });

    // generate OTP
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const otpExpiresMin = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + otpExpiresMin * 60 * 1000).toISOString();

    // hash and insert
    const otpHash = await hashOtp(otp);
    const { error } = await supabase.from('otps').insert([{ email, otp_hash: otpHash, purpose:'login', expires_at: expiresAt }]);
    if (error) { console.error('supabase insert otp error', error); return res.status(500).json({ error:'db error' }); }

    const smtp = pickRandomSmtp();
    if (!smtp.host || !smtp.user || !smtp.pass) { console.error('smtp incomplete', smtp); return res.status(500).json({ error:'smtp not configured' }); }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass }
    });

    const mailOptions = {
      from: smtp.user,
      to: email,
      subject: '【留言板】验证码',
      text: `你的验证码是：${otp}。有效期 ${otpExpiresMin} 分钟。`,
      html: `<p>你的验证码是：<strong>${otp}</strong></p><p>有效期 ${otpExpiresMin} 分钟。</p>`
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-otp error', err);
    return res.status(500).json({ error:'send failed' });
  }
}
