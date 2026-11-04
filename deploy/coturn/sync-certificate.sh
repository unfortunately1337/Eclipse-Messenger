#!/bin/sh
# Root-only helper; copies the existing site's certificate without exposing keys.
# Configure COTURN_CERT_SOURCE and COTURN_KEY_SOURCE in a root-owned env file.
set -eu
: "${COTURN_CERT_SOURCE:?Set COTURN_CERT_SOURCE}"
: "${COTURN_KEY_SOURCE:?Set COTURN_KEY_SOURCE}"
test "$(id -u)" = 0
test -r "$COTURN_CERT_SOURCE"
test -r "$COTURN_KEY_SOURCE"
openssl x509 -in "$COTURN_CERT_SOURCE" -checkend 86400 -noout >/dev/null
openssl x509 -in "$COTURN_CERT_SOURCE" -checkhost eclpse.ru -noout >/dev/null
cert_public=$(openssl x509 -in "$COTURN_CERT_SOURCE" -pubkey -noout | openssl sha256)
key_public=$(openssl pkey -in "$COTURN_KEY_SOURCE" -pubout 2>/dev/null | openssl sha256)
test "$cert_public" = "$key_public"
target=/etc/coturn/tls
install -d -o root -g turnserver -m 0750 "$target"
if cmp -s "$COTURN_CERT_SOURCE" "$target/fullchain.pem" && cmp -s "$COTURN_KEY_SOURCE" "$target/privkey.pem"; then exit 0; fi
install -o root -g turnserver -m 0640 "$COTURN_CERT_SOURCE" "$target/fullchain.pem.next"
install -o root -g turnserver -m 0640 "$COTURN_KEY_SOURCE" "$target/privkey.pem.next"
mv "$target/fullchain.pem.next" "$target/fullchain.pem"
mv "$target/privkey.pem.next" "$target/privkey.pem"
# Updating a certificate restarts relay allocations; ICE reconnect handles this.
if systemctl is-active --quiet coturn; then systemctl restart coturn; fi
