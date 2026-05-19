#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
DEFAULT_DATA_DIR="/app/default-data"
DATA_FILE_FORMAT="${DATA_FILE_FORMAT:-json}"
SESSION_SECRET_FILE="$DATA_DIR/.session-secret"
RUNTIME_USER="nextjs"
RUNTIME_GROUP="nodejs"

normalize_data_ext() {
	case "$(echo "$DATA_FILE_FORMAT" | tr '[:upper:]' '[:lower:]')" in
		yaml|yml) echo "yaml" ;;
		*) echo "json" ;;
	esac
}

TARGET_DATA_EXT="$(normalize_data_ext)"

log() {
	printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "go-nav: $*"
}

log "starting container"
log "data directory: $DATA_DIR"

mkdir -p "$DATA_DIR/uploads"

has_local_config_file() {
	base="$1"
	[ -f "$DATA_DIR/$base.yaml" ] || [ -f "$DATA_DIR/$base.yml" ] || [ -f "$DATA_DIR/$base.json" ]
}

find_default_config_file() {
	base="$1"
	if [ "$TARGET_DATA_EXT" = "yaml" ]; then
		candidates="yaml yml json"
	else
		candidates="json yaml yml"
	fi
	for ext in $candidates; do
		file="$DEFAULT_DATA_DIR/$base.$ext"
		if [ -f "$file" ]; then
			echo "$file"
			return 0
		fi
	done
	return 1
}

init_config_file() {
	base="$1"
	if has_local_config_file "$base"; then
		return 0
	fi
	default_file="$(find_default_config_file "$base" || true)"
	if [ -z "$default_file" ]; then
		return 0
	fi
	target="$DATA_DIR/$base.$TARGET_DATA_EXT"
	cp "$default_file" "$target"
	log "initialized $(basename "$target")"
}

init_config_file "nav"
init_config_file "website"

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
