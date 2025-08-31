#!/bin/bash

# Script para tentar conectar ao Supabase via Docker
echo "🐳 Tentando conectar ao PostgreSQL do Supabase via Docker..."

# Informações de conexão
HOST="db.gcfyrcpugmducptktjic.supabase.co"
PORT="5432"
USER="postgres"
DATABASE="postgres"

echo "📡 Testando conectividade..."

# Tentar conectar e executar um comando simples
docker run --rm postgres:15 psql \
  -h "$HOST" \
  -p "$PORT" \
  -U "$USER" \
  -d "$DATABASE" \
  -c "SELECT version();" \
  2>&1

echo ""
echo "Se a conexão funcionou acima, execute:"
echo "docker run --rm -i postgres:15 psql -h $HOST -p $PORT -U $USER -d $DATABASE < complete-kds-setup.sql"