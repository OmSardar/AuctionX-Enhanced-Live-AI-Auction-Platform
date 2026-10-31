#!/bin/sh
set -e

# ==============================================================================
# AuctionX Frontend Nginx Entrypoint Script
# ==============================================================================
# Validates environment configuration and generates runtime Nginx config
# from template using controlled variable substitution.

if [ -z "$BACKEND_UPSTREAM_URL" ]; then
  echo "FATAL: BACKEND_UPSTREAM_URL environment variable is required." >&2
  echo "Provide a valid backend upstream URL (e.g. http://auctionx-server:10000 on Render or http://server:5000 in Docker Compose)." >&2
  exit 1
fi

# Trim whitespace
BACKEND_UPSTREAM_URL="$(printf '%s' "$BACKEND_UPSTREAM_URL" | tr -d '[:space:]')"

# Validate URL protocol (must begin with http:// or https://)
case "$BACKEND_UPSTREAM_URL" in
  http://*|https://*)
    ;;
  *)
    echo "FATAL: BACKEND_UPSTREAM_URL must begin with http:// or https:// (received: '$BACKEND_UPSTREAM_URL')." >&2
    exit 1
    ;;
esac

# Reject embedded credentials (e.g. http://user:pass@host)
case "$BACKEND_UPSTREAM_URL" in
  *@*)
    echo "FATAL: BACKEND_UPSTREAM_URL must not contain embedded user credentials ('@')." >&2
    exit 1
    ;;
esac

# Reject unsafe / injection characters
case "$BACKEND_UPSTREAM_URL" in
  *[[:space:]\'\"\;\\\{\}\<\>\`]*|*[\$\(\)]*)
    echo "FATAL: BACKEND_UPSTREAM_URL contains invalid or unsafe characters." >&2
    exit 1
    ;;
esac

# Reject trailing slash or path (Nginx proxy_pass requires clean origin)
proto_rest="${BACKEND_UPSTREAM_URL#*://}"
if [ -z "$proto_rest" ]; then
  echo "FATAL: BACKEND_UPSTREAM_URL must include a valid host (received: '$BACKEND_UPSTREAM_URL')." >&2
  exit 1
fi

case "$proto_rest" in
  */*)
    echo "FATAL: BACKEND_UPSTREAM_URL must not contain a path or trailing slash (expected origin format: http(s)://host[:port]). Received: '$BACKEND_UPSTREAM_URL'." >&2
    exit 1
    ;;
esac

# Normalize and validate listening port (Render injects PORT; default to 80 if not set)
export PORT="${PORT:-80}"
case "$PORT" in
  ''|*[!0-9]*)
    echo "FATAL: PORT must be an integer between 1 and 65535 (received: '$PORT')." >&2
    exit 1
    ;;
  *)
    if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
      echo "FATAL: PORT must be an integer between 1 and 65535 (received: '$PORT')." >&2
      exit 1
    fi
    ;;
esac

export BACKEND_UPSTREAM_URL

echo "[AuctionX Nginx Entrypoint] Starting Nginx listener on port ${PORT} -> proxying to upstream ${BACKEND_UPSTREAM_URL}"

# Substitute ONLY ${PORT} and ${BACKEND_UPSTREAM_URL} into the template
# (prevents arbitrary shell interpolation and preserves internal Nginx variables like $host, $remote_addr)
if [ -f /etc/nginx/templates/default.conf.template ]; then
  envsubst '${PORT} ${BACKEND_UPSTREAM_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
else
  echo "WARNING: /etc/nginx/templates/default.conf.template not found; relying on pre-existing configuration." >&2
fi

# Verify generated Nginx configuration syntax
nginx -t

# Execute CMD (default: nginx -g "daemon off;")
exec "$@"
