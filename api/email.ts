import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  app_url: string;
}

export async function sendEmail({ to, subject, text, html, config }: { to: string, subject: string, text: string, html?: string, config?: SmtpConfig }) {
  if (!config) {
    console.warn(`Email not sent: No SMTP configuration provided.`);
    return;
  }

  const { host, username: user, password: pass, port, secure, from_email: from } = config;

  if (!host || !user || !pass) {
    const missing = [];
    if (!host) missing.push('host');
    if (!user) missing.push('username');
    if (!pass) missing.push('password');
    console.warn(`Email not sent: Missing SMTP configuration fields: ${missing.join(', ')}`);
    return;
  }

  console.log(`Attempting to send email to ${to} via ${host}...`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent successfully! Message ID: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
