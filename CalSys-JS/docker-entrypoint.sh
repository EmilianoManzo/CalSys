#!/bin/sh
set -e
API_URL="${REACT_APP_API_URL:-http://localhost:3000/api}"
sed -i "s|REACT_APP_API_URL_PLACEHOLDER|${API_URL}|g" /usr/share/nginx/html/env.js
exec "$@"
