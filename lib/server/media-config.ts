import { z } from "zod";

const configSchema = z.object({
  endpoint: z.string().min(1),
  port: z.number().int().positive().max(65_535).optional(),
  useSSL: z.boolean(),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  bucket: z.string().min(1),
  region: z.string().min(1).default("us-east-1"),
  forcePathStyle: z.boolean().default(true),
});

export type MediaStorageConfig = z.infer<typeof configSchema>;

function cleanEnv(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

function parseBoolean(raw: string | undefined, fallback: boolean) {
  if (!raw) return fallback;
  const cleaned = cleanEnv(raw).toLowerCase();
  return ["1", "true", "yes", "on"].includes(cleaned);
}

function parsePort(raw: string | undefined) {
  if (!raw) return undefined;
  const cleaned = cleanEnv(raw);
  const parsed = Number(cleaned);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function getMediaStorageConfig(): MediaStorageConfig {
  const endpoint =
    cleanEnv(process.env.S3_ENDPOINT) ||
    (process.env.MINIO_ROOT_USER ? "minio:9000" : "");
  const portRaw = process.env.S3_PORT;
  const port = parsePort(portRaw);
  const useSSL = parseBoolean(process.env.S3_USE_SSL, false);
  const accessKey =
    cleanEnv(process.env.S3_ACCESS_KEY) ||
    cleanEnv(process.env.S3_KEY) ||
    cleanEnv(process.env.MINIO_ROOT_USER);
  const secretKey =
    cleanEnv(process.env.S3_SECRET_KEY) ||
    cleanEnv(process.env.S3_SECRET) ||
    cleanEnv(process.env.MINIO_ROOT_PASSWORD);
  const bucket =
    cleanEnv(process.env.S3_BUCKET) ||
    cleanEnv(process.env.S3_BUCKET_NAME) ||
    "eclpse";
  const region = cleanEnv(process.env.S3_REGION) || "us-east-1";
  const forcePathStyle = parseBoolean(process.env.S3_FORCE_PATH_STYLE, true);

  if (!endpoint) throw new Error("S3_ENDPOINT не указан в переменных окружения");
  if (!accessKey) throw new Error("S3_ACCESS_KEY не указан в переменных окружения");
  if (!secretKey) throw new Error("S3_SECRET_KEY не указан в переменных окружения");

  return {
    endpoint,
    port,
    useSSL,
    accessKey,
    secretKey,
    bucket,
    region,
    forcePathStyle,
  };
}

export function buildS3Endpoint(config: MediaStorageConfig) {
  const endpoint = config.endpoint.trim();
  const hasProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(endpoint);
  const endpointUrl = hasProtocol ? endpoint : `${config.useSSL ? "https" : "http"}://${endpoint}`;

  let url: URL;
  try {
    url = new URL(endpointUrl);
  } catch {
    throw new Error(`Invalid S3 endpoint: ${config.endpoint}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported S3 endpoint protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("S3 endpoint must not include credentials");
  }
  if (config.port) {
    url.port = String(config.port);
  }

  const cleanPath = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${cleanPath}`;
}
