const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

function genCode() {
  // 6-digit numeric code, zero-padded
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(toEmail, fullName, code) {
  const t = getTransporter();
  await t.sendMail({
    from: `"FitForge" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Your FitForge verification code',
    text: `Hi ${fullName},\n\nYour FitForge verification code is: ${code}\n\nThis code expires in ${process.env.VERIFICATION_CODE_TTL_MIN || 15} minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#14171A;color:#F2EFE9;border-radius:12px;">
        <h1 style="color:#E8AC3D;font-size:22px;letter-spacing:1px;">FITFORGE</h1>
        <p>Hi ${escapeHtml(fullName)},</p>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:6px;background:#1E2226;border:1px solid #33393E;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">${code}</div>
        <p style="color:#8B9198;font-size:13px;">This code expires in ${process.env.VERIFICATION_CODE_TTL_MIN || 15} minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = { sendVerificationEmail, genCode };
