import nodemailer from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { HttpError } from "@/lib/server/http";
import { translate } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";

const SMTP_HOST = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_SECURE =
  process.env.SMTP_SECURE?.toLowerCase() === "true" || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER?.trim();
const SMTP_PASSWORD = process.env.SMTP_PASSWORD?.trim();
const SMTP_VERIFY = process.env.SMTP_VERIFY?.toLowerCase() !== "false";
const SMTP_DEBUG = process.env.SMTP_DEBUG?.toLowerCase() === "true";
const SMTP_USE_SES =
  process.env.SMTP_USE_SES?.toLowerCase() === "true" || SMTP_PORT === 443;

function getSenderAddress(): string {
  const rawFrom = (process.env.SMTP_FROM?.trim() || SMTP_USER || "").trim();
  if (!rawFrom) {
    return "Eclipse";
  }
  const match = rawFrom.match(/<([^>]+)>/);
  const email = match ? match[1].trim() : rawFrom;
  return `Eclipse <${email}>`;
}

function buildSimpleEmailHtml(code: string, description: string, locale: Locale = "en") {
  const t = (source: string) => translate(source, undefined, locale);
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6;">
    <p style="margin: 0 0 16px; font-size: 16px;">${t("Ваш код")} - <strong style="font-size: 18px; letter-spacing: 1px;">${code}</strong></p>
    <p style="margin: 0 0 16px;">${t(description)}</p>
    <p style="margin: 0 0 24px; opacity: 0.75; font-size: 14px;">${t("Если вы не запрашивали этот код, просто проигнорируйте данное письмо.")}</p>
    <p style="margin: 0;">
      ${t("С уважением,")}<br />
      Eclipse
    </p>
  </body>
</html>`;
}

export function buildLoginCodeEmailHtml(code: string, locale: Locale = "en") {
  return buildSimpleEmailHtml(
    code,
    "Этот код нужен для того, чтобы подтвердить, что вы являетесь владельцем этого адреса электронной почты в Eclipse. Не сообщайте его никому.",
    locale,
  );
}

export function buildPasswordResetCodeEmailHtml(code: string, locale: Locale = "en") {
  return buildSimpleEmailHtml(
    code,
    "Этот код нужен для сброса пароля от вашего аккаунта в Eclipse. Не сообщайте его никому.",
    locale,
  );
}

export function buildCodeEmailHtml(title: string, description: string, code: string, locale: Locale = "en") {
  return buildSimpleEmailHtml(code, description, locale);
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let cachedSesClient: SESv2Client | null = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!SMTP_USER) {
    throw new HttpError(500, "SMTP_USER не настроен");
  }

  if (!SMTP_PASSWORD) {
    throw new HttpError(500, "SMTP_PASSWORD не настроен");
  }

  cachedTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
    requireTLS: !SMTP_SECURE,
    tls: {
      servername: SMTP_HOST,
    },
    logger: SMTP_DEBUG,
    debug: SMTP_DEBUG,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });

  return cachedTransporter;
}

function getSesClient() {
  if (cachedSesClient) {
    return cachedSesClient;
  }

  if (!SMTP_USER) {
    throw new HttpError(500, "SMTP_USER (Access Key ID) не настроен");
  }
  if (!SMTP_PASSWORD) {
    throw new HttpError(500, "SMTP_PASSWORD (Secret Access Key) не настроен");
  }
  const region = process.env.SMTP_REGION || "us-east-1";
  const endpoint = process.env.SMTP_SES_ENDPOINT || "https://postbox.cloud.yandex.net";
  cachedSesClient = new SESv2Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: SMTP_USER,
      secretAccessKey: SMTP_PASSWORD,
    },
  });
  return cachedSesClient;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new HttpError(504, message)), ms),
    ),
  ]);
}

async function sendEmail(params: { to: string; subject: string; text: string; html: string }) {
  const sender = getSenderAddress();
  if (SMTP_USE_SES) {
    const sesClient = getSesClient();

    const command = new SendEmailCommand({
      FromEmailAddress: sender,
      Destination: {
        ToAddresses: [params.to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: params.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: params.html,
              Charset: "UTF-8",
            },
            Text: {
              Data: params.text,
              Charset: "UTF-8",
            },
          },
        },
      },
    });

    try {
      await sesClient.send(command);
    } catch (sesError: unknown) {
      const err = sesError as Record<string, unknown>;
      console.error("[SES ERROR] Yandex Postbox send failed:", {
        name: err?.name,
        message: err?.message,
        code: err?.Code,
        httpStatus: (err?.$metadata as Record<string, unknown>)?.httpStatusCode,
        requestId: (err?.$metadata as Record<string, unknown>)?.requestId,
        raw: String(sesError),
      });
      throw sesError;
    }
  } else {
    const transporter = getTransporter();

    try {
      await withTimeout(
        transporter.sendMail({
          from: sender,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html,
        }),
        10_000,
        "SMTP send timeout",
      );
    } catch (error) {
      // If cached pooled connection went stale, reset cache and retry once
      console.warn("SMTP send failed, retrying with fresh connection:", error);
      cachedTransporter = null;
      const retryTransporter = getTransporter();
      await withTimeout(
        retryTransporter.sendMail({
          from: sender,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html,
        }),
        10_000,
        "SMTP send timeout",
      );
    }
  }
}

export async function sendLoginCodeEmail(to: string, code: string, locale: Locale = "en") {
  try {
    console.log("[DEBUG EMAIL] sendLoginCodeEmail triggered");
    console.log("[DEBUG EMAIL] process.cwd():", process.cwd());
    console.log("[DEBUG EMAIL] SMTP_USER:", process.env.SMTP_USER ? `DEFINED (${process.env.SMTP_USER.slice(0, 4)}...)` : "UNDEFINED");
    console.log("[DEBUG EMAIL] SMTP_PASSWORD:", process.env.SMTP_PASSWORD ? "DEFINED" : "UNDEFINED");
    console.log("[DEBUG EMAIL] SMTP_USE_SES:", process.env.SMTP_USE_SES);
    console.log("[DEBUG EMAIL] SMTP_PORT:", process.env.SMTP_PORT);

    const description =
      "Этот код нужен для того, чтобы подтвердить, что вы являетесь владельцем этого адреса электронной почты в Eclipse. Не сообщайте его никому.";

    await sendEmail({
      to,
      subject: translate("Код подтверждения - {0}", { 0: code }, locale),
      text: `${translate("Ваш код", undefined, locale)} - ${code}\n\n${translate(description, undefined, locale)}\n\n${translate("Если вы не запрашивали этот код, просто проигнорируйте данное письмо.", undefined, locale)}\n\n${translate("С уважением,", undefined, locale)}\nEclipse`,
      html: buildLoginCodeEmailHtml(code, locale),
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    console.error("[EMAIL] sendLoginCodeEmail failed:", {
      name: err?.name,
      message: err?.message,
      code: err?.Code || err?.code,
      httpStatus: (err?.$metadata as Record<string, unknown>)?.httpStatusCode,
    });
    throw new HttpError(502, "Не удалось отправить email");
  }
}

export async function sendPasswordResetCodeEmail(to: string, code: string, locale: Locale = "en") {
  try {
    console.log("[DEBUG EMAIL] sendPasswordResetCodeEmail triggered");
    console.log("[DEBUG EMAIL] process.cwd():", process.cwd());
    console.log("[DEBUG EMAIL] SMTP_USER:", process.env.SMTP_USER ? `DEFINED (${process.env.SMTP_USER.slice(0, 4)}...)` : "UNDEFINED");
    console.log("[DEBUG EMAIL] SMTP_PASSWORD:", process.env.SMTP_PASSWORD ? "DEFINED" : "UNDEFINED");
    console.log("[DEBUG EMAIL] SMTP_USE_SES:", process.env.SMTP_USE_SES);
    console.log("[DEBUG EMAIL] SMTP_PORT:", process.env.SMTP_PORT);

    const description =
      "Этот код нужен для сброса пароля от вашего аккаунта в Eclipse. Не сообщайте его никому.";

    await sendEmail({
      to,
      subject: translate("Сброс пароля - {0}", { 0: code }, locale),
      text: `${translate("Ваш код", undefined, locale)} - ${code}\n\n${translate(description, undefined, locale)}\n\n${translate("Если вы не запрашивали сброс пароля, просто проигнорируйте данное письмо.", undefined, locale)}\n\n${translate("С уважением,", undefined, locale)}\nEclipse`,
      html: buildPasswordResetCodeEmailHtml(code, locale),
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    console.error("[EMAIL] sendPasswordResetCodeEmail failed:", {
      name: err?.name,
      message: err?.message,
      code: err?.Code || err?.code,
      httpStatus: (err?.$metadata as Record<string, unknown>)?.httpStatusCode,
    });
    throw new HttpError(502, "Не удалось отправить email");
  }
}
