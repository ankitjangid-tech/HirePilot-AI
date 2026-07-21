const nodemailer = require("nodemailer");

let transporter = null;

const isPlaceholderValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  return (
    !normalized ||
    normalized.startsWith("your_") ||
    normalized.startsWith("replace_") ||
    normalized.includes("example.com")
  );
};

const isEmailConfigured = () =>
  !isPlaceholderValue(process.env.EMAIL_USER) &&
  !isPlaceholderValue(process.env.EMAIL_PASS);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return transporter;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildEmailHtml = ({
  recipientName,
  title,
  paragraphs = [],
  details = [],
}) => {
  const detailRows = details
    .filter((detail) => detail && detail.value !== null && detail.value !== undefined)
    .map(
      (detail) => `
        <tr>
          <td style="padding:6px 12px 6px 0;color:#667085;font-weight:600;vertical-align:top;">
            ${escapeHtml(detail.label)}
          </td>
          <td style="padding:6px 0;color:#172033;vertical-align:top;">
            ${escapeHtml(detail.value)}
          </td>
        </tr>`
    )
    .join("");

  const paragraphHtml = paragraphs
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;line-height:1.6;color:#344054;">${escapeHtml(
          paragraph
        )}</p>`
    )
    .join("");

  return `
    <div style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033;">
      <div style="max-width:620px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #d9e1ec;border-radius:12px;">
        <p style="margin:0 0 20px;color:#2563eb;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
          HirePilot AI
        </p>
        <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#172033;">
          ${escapeHtml(title)}
        </h1>
        <p style="margin:0 0 14px;line-height:1.6;color:#344054;">
          Hello ${escapeHtml(recipientName || "there")},
        </p>
        ${paragraphHtml}
        ${
          detailRows
            ? `<table role="presentation" style="width:100%;margin:18px 0;border-collapse:collapse;">${detailRows}</table>`
            : ""
        }
        <p style="margin:20px 0 0;line-height:1.6;color:#667085;">
          Sign in to HirePilot AI to review the latest details.
        </p>
      </div>
    </div>`;
};

const sendEmail = async (to, subject, html) => {
  if (!to) {
    console.warn("[EMAIL] Notification skipped because the recipient is unavailable.");
    return {
      sent: false,
      configured: isEmailConfigured(),
      status: "skipped_missing_recipient",
    };
  }

  if (!isEmailConfigured()) {
    console.warn(
      "[EMAIL] Notification skipped because EMAIL_USER and EMAIL_PASS are not configured."
    );
    return {
      sent: false,
      configured: false,
      status: "skipped_not_configured",
    };
  }

  try {
    await getTransporter().sendMail({
      from: `"HirePilot AI" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("[EMAIL] Notification sent successfully.");
    return {
      sent: true,
      configured: true,
      status: "sent",
    };
  } catch (error) {
    console.warn(
      `[EMAIL] Notification delivery failed${
        error && error.code ? ` (${error.code})` : ""
      }. The platform action remains complete.`
    );

    return {
      sent: false,
      configured: true,
      status: "failed",
    };
  }
};

const getEmailDeliveryMessage = (result) => {
  if (result?.sent) {
    return "Email notification sent.";
  }

  if (result?.status === "skipped_not_configured") {
    return "Email notification skipped because email is not configured.";
  }

  if (result?.status === "skipped_missing_recipient") {
    return "Email notification skipped because the recipient email is unavailable.";
  }

  return "Email notification could not be delivered, but the platform update was saved.";
};

module.exports = {
  buildEmailHtml,
  getEmailDeliveryMessage,
  isEmailConfigured,
  sendEmail,
};
