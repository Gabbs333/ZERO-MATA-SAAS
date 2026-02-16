
#!/bin/bash

# Script de déploiement des Edge Functions
# Assurez-vous d'avoir fait 'supabase link' vers le nouveau projet avant.

echo "🚀 Déploiement des Edge Functions..."

# Liste des fonctions détectées
functions=(
  "cleanup-exports"
  "expire-subscriptions"
  "generate-rapport-pdf"
  "generate-stock-csv"
  "generate-ventes-csv"
)

PROJECT_ID="gmwxcwvknlnydaajvlow"

for func in "${functions[@]}"; do
  echo "👉 Deploying $func to project $PROJECT_ID..."
  npx supabase functions deploy "$func" --project-ref "$PROJECT_ID" --no-verify-jwt

done

echo "✅ Déploiement terminé."
