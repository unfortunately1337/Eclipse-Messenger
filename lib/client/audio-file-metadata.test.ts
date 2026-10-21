import { describe, expect, it } from "vitest";
import { readAudioFileMetadata } from "./audio-file-metadata";
import { MEDIA_PREFIX, serializeMusicContent } from "@/app/app/(chats)/chat-message-transport";

function taggedAudio() {
  const frame = (name: string, body: Buffer) => {
    const header = Buffer.alloc(10);
    header.write(name); header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
  };
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=", "base64");
  const tags = Buffer.concat([
    frame("TIT2", Buffer.from("\u0003Original title")),
    frame("TPE1", Buffer.from("\u0003Original artist")),
    frame("APIC", Buffer.concat([Buffer.from([0]), Buffer.from("image/png\0"), Buffer.from([3, 0]), image])),
  ]);
  const header = Buffer.from([73, 68, 51, 3, 0, 0, 0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) header[9-i] = (tags.length >>> (7*i)) & 127;
  // MPEG frames allow the parser to finish after reading the ID3 header.
  const mpeg = Buffer.alloc(417 * 3);
  for (let i = 0; i < 3; i++) mpeg.set([255, 251, 144, 0], i*417);
  return new Blob([Buffer.concat([header, tags, mpeg])], { type: "audio/mpeg" });
}

describe("audio file metadata", () => {
  it("keeps embedded title, artist and original cover without reading the whole track for duration", async () => {
    const file = taggedAudio();
    const promise = readAudioFileMetadata(file);
    expect(readAudioFileMetadata(file)).toBe(promise);
    const metadata = await promise;
    expect(metadata.title).toBe("Original title");
    expect(metadata.author).toBe("Original artist");
    expect(metadata.cover?.type).toBe("image/png");
    expect(metadata.cover?.size).toBeGreaterThan(0);
  });
  it("does not prevent sending files with missing or damaged tags", async () => {
    expect(await readAudioFileMetadata(new Blob(["bad audio"]))).toEqual({});
  });
  it("preserves cover access token and metadata in the message payload", () => {
    const payload = JSON.parse(serializeMusicContent("/media/audio", "Title", "Caption", {
      author: "Artist", coverUrl: "/media/cover#encrypted-access", durationMs: 1234,
    }).slice(MEDIA_PREFIX.length));
    expect(payload).toMatchObject({ title: "Title", author: "Artist", caption: "Caption", coverUrl: "/media/cover#encrypted-access", durationMs: 1234 });
  });
});
