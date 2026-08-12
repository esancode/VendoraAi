#!/bin/sh
set -e

echo "Running Prisma Push..."
npx prisma db push --accept-data-loss

# Opcional: Aqui poderíamos rodar `node dist/prisma/seed.js` caso existam seeds fixos

echo "Starting Application..."
node dist/main.js
