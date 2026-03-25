import nodemailer from "nodemailer";
import env from "@config/env";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: nodemailer.Transporter | null = null;

const assertEmailConfig = () => {
  if (!env.mail.isConfigured) {
    throw new Error(
      "SMTP email configuration is incomplete. Check SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM.",
    );
  }
};

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  assertEmailConfig();

  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: {
      user: env.mail.user,
      pass: env.mail.pass,
    },
  });

  return transporter;
};

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
}: SendEmailOptions) => {
  await getTransporter().sendMail({
    from: env.mail.from,
    to,
    subject,
    text,
    html,
  });
};
