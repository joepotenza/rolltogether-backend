/*
  utils/email.js
  MailGun Email API
  - sendEmailMessage: Sends an email using MailGun API
*/
const FormData = require("form-data");
const Mailgun = require("mailgun.js");

const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_SENDER } = process.env;

function sendEmailMessage({ to, subject, text, html }) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: MAILGUN_API_KEY,
  });
  try {
    const data = mg.messages.create(MAILGUN_DOMAIN, {
      from: `Roll Together <${MAILGUN_SENDER}>`,
      to: [to],
      subject,
      text,
      html,
    });
    return data;
  } catch (error) {
    // For now we silently log to console when emails fail (happens a lot in sandbox)
    console.error(error);
  }
}

module.exports = { sendEmailMessage };
