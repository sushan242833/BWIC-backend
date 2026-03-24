interface PasswordResetEmailTemplateInput {
  recipientName: string;
  resetLink: string;
  expiresInMinutes: number;
}

interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export const buildPasswordResetEmailTemplate = ({
  recipientName,
  resetLink,
  expiresInMinutes,
}: PasswordResetEmailTemplateInput): EmailTemplate => {
  const safeName = recipientName.trim() || "there";
  const subject = "Reset your Blue Whale Investment password";
  const text = [
    `Hello ${safeName},`,
    "",
    "We received a request to reset your Blue Whale Investment password.",
    `Use the link below within ${expiresInMinutes} minutes to choose a new password:`,
    "",
    resetLink,
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "Blue Whale Investment",
  ].join("\n");

  const html = `
    <div style="margin:0; padding:32px 16px; background-color:#f7f7ff; font-family:Inter, Arial, sans-serif; color:#131b2e;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:24px; padding:40px 32px; box-shadow:0 24px 48px rgba(19,27,46,0.08);">
        <div style="margin-bottom:24px;">
          <div style="display:inline-block; padding:12px 16px; border-radius:16px; background:#eef0ff; color:#004ac6; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; font-size:12px;">
            Blue Whale Investment
          </div>
        </div>
        <h1 style="margin:0 0 16px; font-family:Manrope, Arial, sans-serif; font-size:32px; line-height:1.1; color:#131b2e;">
          Reset your password
        </h1>
        <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#434655;">
          Hello ${safeName},
        </p>
        <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#434655;">
          We received a request to reset your password. Use the secure link below within ${expiresInMinutes} minutes to set a new one.
        </p>
        <a
          href="${resetLink}"
          style="display:inline-block; padding:16px 28px; border-radius:14px; background:linear-gradient(135deg, #004ac6 0%, #4b41e1 100%); color:#ffffff; text-decoration:none; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; font-size:13px;"
        >
          Reset Password
        </a>
        <p style="margin:28px 0 8px; font-size:14px; line-height:1.7; color:#737686;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin:0 0 24px; word-break:break-word;">
          <a href="${resetLink}" style="color:#004ac6; text-decoration:underline;">${resetLink}</a>
        </p>
        <div style="padding-top:24px; border-top:1px solid #e2e7ff;">
          <p style="margin:0; font-size:14px; line-height:1.7; color:#737686;">
            If you did not request a password reset, you can safely ignore this email. This link can only be used once.
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
};
