const fs = require("fs");
const path = require("path");

const WIDGET_TEMPLATE_PATH = path.resolve(
  __dirname,
  "..",
  "templates",
  "faq-widget-v1-standalone-mock.html"
);

const WEBHOOK_ATTRIBUTE_PATTERN = /data-webhook-url=(["'])[^"']*\1/i;

let cachedTemplate = null;

function readWidgetTemplate() {
  if (cachedTemplate) return cachedTemplate;

  cachedTemplate = fs.readFileSync(WIDGET_TEMPLATE_PATH, "utf8");
  if (!cachedTemplate.trim()) {
    throw new Error("Widget template is empty");
  }
  return cachedTemplate;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildWidgetHtml(webhookUrl) {
  if (!webhookUrl) {
    throw new Error("Webhook URL is required to build widget HTML");
  }

  const template = readWidgetTemplate();
  const escapedWebhookUrl = escapeAttribute(webhookUrl);
  const updated = template.replace(
    WEBHOOK_ATTRIBUTE_PATTERN,
    `data-webhook-url="${escapedWebhookUrl}"`
  );

  if (updated === template) {
    throw new Error("Widget template does not contain a data-webhook-url attribute");
  }

  return updated;
}

module.exports = { buildWidgetHtml };
