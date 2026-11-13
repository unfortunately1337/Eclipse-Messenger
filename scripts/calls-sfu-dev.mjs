// Local Docker SFU for next dev. No production server or credentials are used.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { isIPv4 } from "node:net";
import { fileURLToPath } from "node:url";
import { RoomServiceClient } from "livekit-server-sdk";

const root = fileURLToPath(new URL("../", import.meta.url));
const file = name => new URL(name, new URL("../", import.meta.url));
const compose = ["compose", "-p", "eclipse-sfu-dev", "--env-file", ".data/livekit-dev/docker.env", "-f", "deploy/livekit/compose.dev.yaml"];
async function docker(args) {
  await new Promise((resolve, reject) => {
    const child = spawn("docker", [...compose, ...args], { cwd: root, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Docker exited with code ${code}`)));
  });
}

try {
  if (process.argv.includes("--stop")) {
    await docker(["stop", "sfu"]);
  } else {
    const envFile = file(".env.local");
    const env = await readFile(envFile, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
    const previousUrl = /^LIVEKIT_URL\s*=\s*["']?([^\r\n"']*)/m.exec(env)?.[1]?.trim();
    if (previousUrl && previousUrl !== "ws://127.0.0.1:7880") throw new Error(".env.local already configures another SFU; keep its settings or clear LIVEKIT_URL before local setup.");
    await mkdir(file(".data/livekit-dev/"), { recursive: true });
    // Docker Desktop cannot route browser ICE to a container's loopback. Advertise
    // the host's LAN adapter, while the signaling/API port stays loopback-only.
    const privateIPv4 = address => isIPv4(address) && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(address);
    const adapter = Object.entries(networkInterfaces()).filter(([name]) => !/loopback|virtual|vethernet|wsl|docker|tun|vpn|happ|tailscale|zerotier/i.test(name))
      .flatMap(([, addresses]) => addresses ?? []).find(address => address.family === "IPv4" && !address.internal && privateIPv4(address.address));
    const mediaIp = process.env.ECLIPSE_SFU_DEV_MEDIA_IP ?? adapter?.address ?? "127.0.0.1";
    if (!privateIPv4(mediaIp)) throw new Error("ECLIPSE_SFU_DEV_MEDIA_IP must be a private IPv4 address of this computer.");
    await writeFile(file(".data/livekit-dev/docker.env"), `ECLIPSE_SFU_DEV_MEDIA_IP=${mediaIp}\n`);
    const credentialsFile = file(".data/livekit-dev/credentials.json");
    let credentials;
    try { credentials = JSON.parse(await readFile(credentialsFile, "utf8")); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      credentials = { key: `dev_${randomBytes(12).toString("hex")}`, secret: randomBytes(32).toString("hex") };
      await writeFile(credentialsFile, JSON.stringify(credentials), { mode: 0o600 });
    }
    // JSON is valid YAML. The API stays on loopback; media uses the host adapter.
    await writeFile(file(".data/livekit-dev/livekit.yaml"), JSON.stringify({
      port: 7880, bind_addresses: ["0.0.0.0"],
      rtc: { tcp_port: 7881, udp_port: 7882, node_ip: mediaIp, use_external_ip: false, enable_loopback_candidate: mediaIp.startsWith("127."), stun_servers: [] },
      keys: { [credentials.key]: credentials.secret }, room: { auto_create: false }, logging: { level: "warn" },
    }, null, 2), { mode: 0o600 });
    await docker(["up", "-d", "sfu"]);
    const client = new RoomServiceClient("http://127.0.0.1:7880", credentials.key, credentials.secret, { requestTimeout: 2 });
    for (let attempt = 0; ; attempt++) {
      try { await client.listRooms(); break; }
      catch { if (attempt >= 15) throw new Error("Local SFU did not become ready. Check docker logs eclipse-sfu-dev."); }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const values = { LIVEKIT_URL: "ws://127.0.0.1:7880", LIVEKIT_API_KEY: credentials.key, LIVEKIT_API_SECRET: credentials.secret };
    let updated = env;
    for (const [name, value] of Object.entries(values)) {
      const pattern = new RegExp(`^${name}\\s*=.*$`, "m");
      const line = `${name}=${JSON.stringify(value)}`;
      updated = pattern.test(updated) ? updated.replace(pattern, line) : `${updated.trimEnd()}\n${line}\n`;
    }
    if (updated !== env) await writeFile(envFile, updated, { mode: 0o600 });
    console.log("Local SFU ready at ws://127.0.0.1:7880. next dev reloads .env.local automatically; reload the messenger tab.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
