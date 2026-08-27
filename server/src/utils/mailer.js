// Sends mail over the Resend HTTPS API (https://api.resend.com) instead of
// raw SMTP. Render's free tier blocks all outbound SMTP ports (25/465/587),
// which is why the old nodemailer/Gmail transport just hung until timeout.
// Plain HTTPS on port 443 is not affected, so this works on Render free tier.
const RESEND_API_URL = 'https://api.resend.com/emails';

function genCode() {
  // 6-digit numeric code, zero-padded
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(toEmail, fullName, code) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set. Add it in your Render environment variables.');
  }

  const controller = new AbortController();
  // Fail fast instead of hanging forever if the network/API is ever unreachable.
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'FitForge <onboarding@resend.dev>',
        to: [toEmail],
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
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Timed out contacting the email API (Resend).');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = { sendVerificationEmail, genCode };
