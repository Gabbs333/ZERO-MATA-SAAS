#!/bin/bash
# Load environment variables from app-admin/.env
# We need to handle the fact that .env might not be in a format sourceable by bash directly if it has spaces or quotes issues, 
# but typically VITE_ vars are simple. 
# A safer way is to grep them.

SUPABASE_URL=$(grep VITE_SUPABASE_URL app-admin/.env | cut -d '=' -f2)
SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY app-admin/.env | cut -d '=' -f2)

# Trim whitespace/newlines
SUPABASE_URL=$(echo $SUPABASE_URL | xargs)
SUPABASE_KEY=$(echo $SUPABASE_KEY | xargs)

EMAIL="admin@snackbar.cm"
PASSWORD="password123"

echo "Testing login to: $SUPABASE_URL"

# We use curl to hit the GoTrue /token endpoint directly
curl -v -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }"
