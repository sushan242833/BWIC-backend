interface EmailVerificationTemplateInput {
  recipientName: string;
  otp: string;
  expiresInMinutes: number;
}

interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export const buildEmailVerificationEmailTemplate = ({
  recipientName,
  otp,
  expiresInMinutes,
}: EmailVerificationTemplateInput): EmailTemplate => {
  const safeName = recipientName.trim() || "there";
  const subject = "Verify your account";
  const text = [
    `Hello ${safeName},`,
    "",
    `Your verification code is: ${otp}. It expires in ${expiresInMinutes} minutes.`,
    "",
    "Blue Whale Investment",
  ].join("\n");

  const html = `
    <div style="margin:0; padding:32px 16px; background-color:#f7f7ff; font-family:Inter, Arial, sans-serif; color:#131b2e;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:24px; padding:36px 32px; box-shadow:0 24px 48px rgba(19,27,46,0.08);">
        <div style="display:inline-block; margin-bottom:20px; padding:12px 16px; border-radius:16px; background:#eef0ff; color:#004ac6; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; font-size:12px;">
          Blue Whale Investment
        </div>
        <h1 style="margin:0 0 12px; font-family:Manrope, Arial, sans-serif; font-size:30px; line-height:1.1; color:#131b2e;">
          Verify your account
        </h1>
        <p style="margin:0 0 20px; font-size:16px; line-height:1.7; color:#434655;">
          Hello ${safeName},
        </p>
        <p style="margin:0 0 28px; font-size:16px; line-height:1.7; color:#434655;">
          Your verification code is:
        </p>
        <div style="margin-bottom:28px; padding:18px 20px; border-radius:18px; background:#f3f5ff; font-family:Menlo, Consolas, monospace; font-size:32px; font-weight:700; letter-spacing:0.35em; text-align:center; color:#004ac6;">
          ${otp}
        </div>
        <p style="margin:0; font-size:14px; line-height:1.7; color:#737686;">
          This code expires in ${expiresInMinutes} minutes. If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  return { subject, text, html };
};
