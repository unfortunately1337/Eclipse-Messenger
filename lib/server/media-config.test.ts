import { describe, expect, it } from "vitest";
import { buildS3Endpoint, type MediaStorageConfig } from "@/lib/server/media-config";

function makeConfig(overrides: Partial<MediaStorageConfig> = {}): MediaStorageConfig {
  return {
    endpoint: "localhost",
    useSSL: false,
    accessKey: "access-key",
    secretKey: "secret-key",
    bucket: "uploads",
    region: "us-east-1",
    forcePathStyle: true,
    ...overrides,
  };
}

describe("media storage endpoint", () => {
  it("keeps an explicit HTTP protocol without duplicating it", () => {
    expect(buildS3Endpoint(makeConfig({ endpoint: "http://localhost:9000" }))).toBe("http://localhost:9000");
  });

  it("adds a protocol when the endpoint is provided as a host", () => {
    expect(buildS3Endpoint(makeConfig({ endpoint: "localhost:9000" }))).toBe("http://localhost:9000");
    expect(buildS3Endpoint(makeConfig({ endpoint: "storage.example.com", useSSL: true }))).toBe("https://storage.example.com");
  });

  it("uses the explicit protocol and lets S3_PORT override the URL port", () => {
    expect(buildS3Endpoint(makeConfig({ endpoint: "https://storage.example.com:9443", port: 9000 }))).toBe(
      "https://storage.example.com:9000",
    );
  });

  it("rejects unsupported protocols and credentials inside the endpoint", () => {
    expect(() => buildS3Endpoint(makeConfig({ endpoint: "ftp://storage.example.com" }))).toThrow(
      "Unsupported S3 endpoint protocol",
    );
    expect(() => buildS3Endpoint(makeConfig({ endpoint: "http://user:password@localhost:9000" }))).toThrow(
      "must not include credentials",
    );
  });
});
