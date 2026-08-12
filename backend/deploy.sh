#!/bin/sh
set -e

echo "Running Prisma Migrations..."
npx prisma migrate deploy

# Opcional: Aqui poderíamos rodar `node dist/prisma/seed.js` caso existam seeds fixos

echo "Starting Application..."
exec node dist/main.js
