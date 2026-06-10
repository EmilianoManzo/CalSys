#!/bin/sh
set -e

# Replace the placeholder in the built env.js with the real runtime value.
# Falls back to localhost if REACT_APP_API_URL is not set.
API_URL="${REACT_APP_API_URL:-http://localhost:3000/api}"

sed -i "s|REACT_APP_API_URL_PLACEHOLDER|${API_URL}|g" /usr/share/nginx/html/env.js

exec "$@"
