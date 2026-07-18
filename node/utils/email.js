const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Not "noreply@" — Gmail's spam heuristics penalize no-reply senders (see
// Resend's own delivery Insights panel), and it's a needlessly hostile UX
// for an address people may legitimately want to reply to.
const EMAIL_FROM = process.env.EMAIL_FROM || "NotAManga <hello@notamanga.dpdns.org>";

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured; skipping email send to", to);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend request failed (${res.status}): ${body}`);
  }
}

function emailShell(title, bodyHtml) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #14151a; padding: 32px; color: #c8c9d0;">
      <div style="max-width: 480px; margin: 0 auto; background: #1c1d24; border: 1px solid #2c2d38; border-radius: 12px; padding: 32px;">
        <h1 style="color: #f5f5f7; font-size: 20px; margin: 0 0 16px;">${title}</h1>
        ${bodyHtml}
        <p style="color: #8b8c99; font-size: 12px; margin-top: 32px;">NotAManga</p>
      </div>
    </div>
  `;
}

function buttonHtml(url, label) {
  return `<a href="${url}" style="display:inline-block;background:#ff6740;color:#14151a;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;margin:16px 0;">${label}</a>`;
}

async function sendVerificationEmail(to, url) {
  await sendEmail({
    to,
    subject: "Verify your NotAManga email address",
    html: emailShell(
      "Verify your email",
      `<p>Confirm this is your email address to finish setting up your NotAManga account.</p>
       ${buttonHtml(url, "Verify email")}
       <p style="font-size:13px;color:#8b8c99;">This link expires in 1 hour. If you didn't create an account, you can ignore this email.</p>`
    ),
  });
}

async function sendPasswordResetEmail(to, url) {
  await sendEmail({
    to,
    subject: "Reset your NotAManga password",
    html: emailShell(
      "Reset your password",
      `<p>Someone requested a password reset for this account. Click below to choose a new password.</p>
       ${buttonHtml(url, "Reset password")}
       <p style="font-size:13px;color:#8b8c99;">This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password won't change.</p>`
    ),
  });
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
