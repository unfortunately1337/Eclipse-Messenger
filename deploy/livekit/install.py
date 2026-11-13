#!/usr/bin/env python3
"""Install one SFU node beside the existing Eclipse/Caddy/coturn deployment."""
import argparse
import base64
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import time
import urllib.request


def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def env_values(text):
    result = {}
    for line in text.splitlines():
        key, separator, value = line.partition("=")
        if separator and not key.strip().startswith("#"):
            result[key.strip()] = value.strip().strip("\"'")
    return result


def private_write(path, text):
    temporary = path.with_suffix(path.suffix + ".new")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as file:
        file.write(text)
    temporary.replace(path)
    path.chmod(0o600)


def jwt(key, secret):
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")
    now = int(time.time())
    body = encode({"alg": "HS256", "typ": "JWT"}) + b"." + encode({
        "iss": key, "nbf": now - 5, "exp": now + 60,
        "video": {"roomList": True},
    })
    return (body + b"." + base64.urlsafe_b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).rstrip(b"=")).decode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/opt/messenger")
    parser.add_argument("--public-ip", required=True)
    parser.add_argument("--domain", default="eclpse.ru")
    args = parser.parse_args()
    ip = str(ipaddress.IPv4Address(args.public_ip))
    if not re.fullmatch(r"[a-z0-9.-]+", args.domain):
        raise RuntimeError("Invalid domain")
    root = Path(args.root).resolve()
    env_path, caddy_path = root / ".env", root / "Caddyfile"
    original_env, original_caddy = env_path.read_text(), caddy_path.read_text()
    env = env_values(original_env)
    turn_secret = env.get("WEBRTC_TURN_SECRET")
    if not turn_secret:
        raise RuntimeError("Configure the existing coturn shared secret first")
    inspection = json.loads(run("docker", "inspect", "messenger-caddy-1", capture_output=True).stdout)[0]
    networks = inspection["NetworkSettings"]["Networks"]
    if len(networks) != 1:
        raise RuntimeError("Expected a single Caddy bridge network")
    network_name, connection = next(iter(networks.items()))
    gateway = connection["Gateway"]
    ipaddress.IPv4Address(gateway)
    network = json.loads(run("docker", "network", "inspect", network_name, capture_output=True).stdout)[0]
    subnet = str(ipaddress.IPv4Network(network["IPAM"]["Config"][0]["Subnet"]))
    bridge = network.get("Options", {}).get("com.docker.network.bridge.name") or "br-" + network["Id"][:12]
    block = re.compile(r"(?m)^" + re.escape(args.domain) + r"\s*\{\n(.*?)^\}", re.S)
    match = block.search(original_caddy)
    if not match or (match.group(1).strip() != "reverse_proxy app:3000" and "# Eclipse SFU" not in match.group(1)):
        raise RuntimeError("Caddy site differs from the expected Eclipse layout; refusing to overwrite it")
    caddy = block.sub(args.domain + " {\n"
        "    # Eclipse SFU: preserve the public app and reuse its TLS certificate.\n"
        "    @sfuRtc path /rtc /rtc/*\n"
        "    handle @sfuRtc {\n"
        "        forward_auth app:3000 {\n"
        "            uri /api/calls/sfu-authorize\n"
        "        }\n"
        f"        reverse_proxy {gateway}:7880\n"
        "    }\n"
        "    @sfuApi path /twirp/livekit.RoomService/*\n"
        "    handle @sfuApi {\n"
        f"        reverse_proxy {gateway}:7880\n"
        "    }\n"
        "    handle {\n"
        "        reverse_proxy app:3000\n"
        "    }\n}", original_caddy, count=1)
    run("docker", "exec", "-i", "messenger-caddy-1", "caddy", "adapt", "--config", "/dev/stdin",
        "--adapter", "caddyfile", "--validate", input=caddy, stdout=subprocess.DEVNULL)
    directory = root / "livekit"
    directory.mkdir(mode=0o700, exist_ok=True)
    directory.chmod(0o700)
    credentials_path = directory / "credentials.json"
    if credentials_path.exists():
        credentials = json.loads(credentials_path.read_text())
    else:
        credentials = {"key": "ECLIPSE" + secrets.token_hex(12), "secret": secrets.token_urlsafe(48)}
        private_write(credentials_path, json.dumps(credentials) + "\n")
    config = {
        "port": 7880, "bind_addresses": ["127.0.0.1", gateway],
        "logging": {"level": "info"},
        "rtc": {"node_ip": ip, "use_external_ip": False, "tcp_port": 7881, "udp_port": 7882,
                "stun_servers": [args.domain + ":3478"],
                "turn_servers": [{"host": args.domain, "port": port, "protocol": protocol,
                                  "secret": turn_secret, "ttl": 14400}
                                 for port, protocol in [(3478, "udp"), (3478, "tcp"), (5349, "tls")]]},
        "room": {"auto_create": False},
        "keys": {credentials["key"]: credentials["secret"]},
    }
    # JSON is valid YAML; quoting all values keeps generated secrets literal.
    private_write(directory / "livekit.yaml", json.dumps(config, indent=2) + "\n")
    shutil.copyfile(Path(__file__).with_name("compose.yaml"), directory / "compose.yaml")
    run("ufw", "allow", "7881/tcp", "comment", "Eclipse SFU ICE TCP")
    run("ufw", "allow", "7882/udp", "comment", "Eclipse SFU media UDP")
    run("ufw", "allow", "in", "on", bridge, "from", subnet, "to", gateway, "port", "7880", "proto", "tcp",
        "comment", "Caddy to private Eclipse SFU API")
    sysctl = Path("/etc/sysctl.d/60-eclipse-sfu.conf")
    private_write(sysctl, "# Allow WebRTC socket buffers without reserving this memory up front.\n"
                  "net.core.rmem_max=7500000\nnet.core.wmem_max=7500000\n")
    run("sysctl", "-p", str(sysctl))
    run("docker", "compose", "-p", "eclipse-sfu", "-f", str(directory / "compose.yaml"), "up", "-d")
    token = jwt(credentials["key"], credentials["secret"])
    for attempt in range(30):
        try:
            request = urllib.request.Request("http://127.0.0.1:7880/twirp/livekit.RoomService/ListRooms", data=b"{}",
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=3) as response:
                assert response.status == 200
            break
        except Exception:
            if attempt == 29:
                raise RuntimeError("SFU API did not become ready") from None
            time.sleep(1)
    try:
        # Keep the bind-mounted file inode: replacing it would leave Caddy on the old file.
        caddy_path.write_text(caddy)
        run("docker", "exec", "messenger-caddy-1", "caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile")
        request = urllib.request.Request("https://" + args.domain + "/twirp/livekit.RoomService/ListRooms", data=b"{}",
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=15) as response:
            assert response.status == 200
    except Exception:
        caddy_path.write_text(original_caddy)
        run("docker", "exec", "messenger-caddy-1", "caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile")
        raise
    values = {"LIVEKIT_URL": "wss://" + args.domain,
              "LIVEKIT_API_KEY": credentials["key"], "LIVEKIT_API_SECRET": credentials["secret"]}
    lines = [line for line in original_env.splitlines() if line.partition("=")[0].strip() not in values]
    private_write(env_path, "\n".join(lines) + "\n" + "\n".join(key + "=" + value for key, value in values.items()) + "\n")
    print("SFU is ready over HTTPS/WSS. Restart/redeploy the app to load its new server-only credentials.")


if __name__ == "__main__":
    main()
