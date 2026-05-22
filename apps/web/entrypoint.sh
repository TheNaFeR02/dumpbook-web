#!/bin/sh
npx @better-auth/cli migrate
exec node apps/web/server.js