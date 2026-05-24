#!/usr/bin/env bash
# Install the marketing.quiz4win.com vhost into the host nginx and reload.
# Re-running is safe; the existing config is overwritten and nginx is reloaded
# only after `nginx -t` succeeds.

set -euo pipefail

CONF_FILENAME="marketing.quiz4win.com.conf"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_CONF="${SCRIPT_DIR}/${CONF_FILENAME}"

if [[ ! -f "${SRC_CONF}" ]]; then
  echo "error: source config not found at ${SRC_CONF}" >&2
  exit 1
fi

# Need root to write into /etc/nginx and to run nginx -s reload.
SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "error: must be run as root or with sudo available" >&2
    exit 1
  fi
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "error: nginx is not installed on this host" >&2
  exit 1
fi

# Detect the nginx layout. Order: Debian/Ubuntu sites-available, then RHEL /
# Amazon Linux conf.d, then macOS Homebrew servers/.
NGINX_AVAILABLE=""
NGINX_ENABLED=""
LAYOUT=""
if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
  NGINX_AVAILABLE="/etc/nginx/sites-available"
  NGINX_ENABLED="/etc/nginx/sites-enabled"
  LAYOUT="debian"
elif [[ -d /etc/nginx/conf.d ]]; then
  NGINX_AVAILABLE="/etc/nginx/conf.d"
  LAYOUT="conf.d"
elif [[ -d /opt/homebrew/etc/nginx/servers ]]; then
  NGINX_AVAILABLE="/opt/homebrew/etc/nginx/servers"
  LAYOUT="brew"
elif [[ -d /usr/local/etc/nginx/servers ]]; then
  NGINX_AVAILABLE="/usr/local/etc/nginx/servers"
  LAYOUT="brew"
else
  echo "error: could not locate a known nginx config directory" >&2
  echo "  expected one of:" >&2
  echo "    /etc/nginx/sites-available  (Debian/Ubuntu)" >&2
  echo "    /etc/nginx/conf.d           (RHEL/CentOS/Amazon Linux)" >&2
  echo "    /opt/homebrew/etc/nginx/servers or /usr/local/etc/nginx/servers (macOS)" >&2
  exit 1
fi

DEST_CONF="${NGINX_AVAILABLE}/${CONF_FILENAME}"

echo "==> Detected nginx layout: ${LAYOUT}"
echo "==> Installing ${CONF_FILENAME} to ${DEST_CONF}"

# Back up any existing config so a botched edit is recoverable.
if [[ -f "${DEST_CONF}" ]]; then
  BACKUP="${DEST_CONF}.bak.$(date +%Y%m%d%H%M%S)"
  ${SUDO} cp -a "${DEST_CONF}" "${BACKUP}"
  echo "    backed up previous config to ${BACKUP}"
fi

${SUDO} install -m 0644 "${SRC_CONF}" "${DEST_CONF}"

# Symlink into sites-enabled on Debian-style layouts.
if [[ "${LAYOUT}" == "debian" ]]; then
  ${SUDO} ln -sf "${DEST_CONF}" "${NGINX_ENABLED}/${CONF_FILENAME}"
  echo "    enabled via ${NGINX_ENABLED}/${CONF_FILENAME}"
fi

echo "==> Validating nginx config (nginx -t)"
if ! ${SUDO} nginx -t; then
  echo "error: nginx -t failed; not reloading. Fix the config above and re-run." >&2
  exit 1
fi

echo "==> Reloading nginx"
# Prefer systemctl when present so unit state stays consistent.
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
  ${SUDO} systemctl reload nginx
elif command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q "^nginx "; then
  ${SUDO} brew services reload nginx >/dev/null
else
  ${SUDO} nginx -s reload
fi

cat <<EOF

OK. marketing.quiz4win.com is now proxied to http://127.0.0.1:5806.

Next steps:
  1. Make sure docker-compose is running:
       docker compose up -d --build
  2. Issue a TLS certificate (one-time):
       sudo certbot --nginx -d marketing.quiz4win.com
  3. Smoke test from this host:
       curl -fsS -H 'Host: marketing.quiz4win.com' http://127.0.0.1/login

EOF
