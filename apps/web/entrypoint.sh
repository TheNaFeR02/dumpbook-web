#!/bin/sh
set -e
NODE_PATH=/app/node_modules:/app/apps/web/node_modules node /app/migrate.js
exec node apps/web/server.js
