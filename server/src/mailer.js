import nodemailer from 'nodemailer';
import config from './config.js';

function isSmtpConfigured() {
  const { host, port, user, pass, from } = config.smtp;
  return !!(host && port && user && pass && from && config.emailMode === 'smtp');
}

async function sendMail({ to, subject, html, text }) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP not configured');
  }
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html
  });
}

export { isSmtpConfigured, sendMail };

