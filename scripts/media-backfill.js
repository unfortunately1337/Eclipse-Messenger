const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return String(value).trim();
}

function parseBool(value, fallback) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function buildS3Endpoint(endpoint, port, useSSL) {
  const hasProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(endpoint);
  const endpointUrl = hasProtocol ? endpoint : `${useSSL ? "https" : "http"}://${endpoint}`;
  const url = new URL(endpointUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported S3 endpoint protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error("S3 endpoint must not include credentials");
  }
  if (port) {
    url.port = String(port);
  }

  return url.toString();
}

async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function hasUrlColumn(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'MediaAsset'
      AND column_name = 'url'
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const endpoint = requireEnv("S3_ENDPOINT");
  const accessKey = requireEnv("S3_ACCESS_KEY");
  const secretKey = requireEnv("S3_SECRET_KEY");
  const bucket = requireEnv("S3_BUCKET");
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const portRaw = process.env.S3_PORT?.trim();
  const port = portRaw ? Number(portRaw) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port <= 0 || port > 65_535)) {
    throw new Error("Invalid S3_PORT");
  }
  const useSSL = parseBool(process.env.S3_USE_SSL, false);
  const forcePathStyle = parseBool(process.env.S3_FORCE_PATH_STYLE, true);

  const s3 = new S3Client({
    region,
    endpoint: buildS3Endpoint(endpoint, port, useSSL),
    forcePathStyle,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const prisma = new PrismaClient();
  const hasUrl = await hasUrlColumn(prisma);
  if (!hasUrl) {
    console.log("url column is missing; backfill skipped.");
    await prisma.$disconnect();
    return;
  }

  const assets = await prisma.mediaAsset.findMany({
    where: {
      objectKey: null,
    },
  });

  console.log(`Found ${assets.length} legacy assets to backfill`);

  for (const asset of assets) {
    if (!asset.url || !asset.url.startsWith("/uploads/")) {
      console.log(`[skip] ${asset.id} has non-legacy url: ${asset.url}`);
      continue;
    }

    const legacyKey = asset.url.replace(/^\//, "");
    const objectKey = legacyKey;
    const filePath = path.join(process.cwd(), "public", legacyKey);

    if (!fs.existsSync(filePath)) {
      console.warn(`[missing] ${asset.id} file not found: ${filePath}`);
      continue;
    }

    let etag = null;
    const exists = await objectExists(s3, bucket, objectKey);
    if (!exists) {
      const buffer = fs.readFileSync(filePath);
      const result = await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: buffer,
          ContentType: asset.mimeType || "application/octet-stream",
          ContentLength: buffer.length,
        }),
      );
      etag = result.ETag || null;
      console.log(`[upload] ${asset.id} -> ${objectKey}`);
    } else {
      console.log(`[exists] ${asset.id} -> ${objectKey}`);
    }

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        objectKey,
        bucket,
        etag,
        status: "ready",
      },
    });
  }

  await prisma.$disconnect();
  console.log("Backfill finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
