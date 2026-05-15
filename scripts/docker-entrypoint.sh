#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
DEFAULT_DATA_DIR="/app/default-data"
SESSION_SECRET_FILE="$DATA_DIR/.session-secret"
RUNTIME_USER="nextjs"
RUNTIME_GROUP="nodejs"

log() {
	printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "go-nav: $*"
}

log "starting container"
log "data directory: $DATA_DIR"

mkdir -p "$DATA_DIR/uploads"

if [ -f "$DEFAULT_DATA_DIR/nav.json" ] && [ ! -f "$DATA_DIR/nav.json" ]; then
	cp "$DEFAULT_DATA_DIR/nav.json" "$DATA_DIR/nav.json"
	log "initialized nav.json"
fi

if [ -f "$DEFAULT_DATA_DIR/website.json" ] && [ ! -f "$DATA_DIR/website.json" ]; then
	cp "$DEFAULT_DATA_DIR/website.json" "$DATA_DIR/website.json"
	log "initialized website.json"
fi

if [ -d "$DEFAULT_DATA_DIR/uploads" ] && [ -z "$(find "$DATA_DIR/uploads" -mindepth 1 ! -name .gitkeep -print -quit)" ]; then
	cp -R "$DEFAULT_DATA_DIR/uploads/." "$DATA_DIR/uploads/"
	log "initialized uploads directory"
fi

if [ -z "${SESSION_SECRET:-}" ]; then
	if [ ! -f "$SESSION_SECRET_FILE" ]; then
		umask 077
		od -An -N32 -tx1 /dev/urandom | tr -d " \n" > "$SESSION_SECRET_FILE"
		log "generated session secret file"
	else
		log "using session secret file"
	fi
else
	log "using session secret from environment"
fi

if [ "$(id -u)" = "0" ]; then
	chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$DATA_DIR" 2>/dev/null || true
	if ! su-exec "$RUNTIME_USER:$RUNTIME_GROUP" test -w "$DATA_DIR/uploads"; then
		echo "go-nav: $DATA_DIR is not writable by uid 1001. Please make the mounted host directory writable, for example: chown -R 1001:1001 <host-data-dir>." >&2
		exit 1
	fi
	log "data directory is writable"
	log "starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
	exec su-exec "$RUNTIME_USER:$RUNTIME_GROUP" "$@"
fi

log "starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec "$@"
