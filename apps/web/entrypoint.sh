#!/bin/sh
set -e
node /app/migrate.js
exec node apps/web/server.js
