#!/bin/bash

# Script to create the first admin user for the multi-tenant SaaS platform
# This script uses Supabase service role key to create an admin user

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Admin User Creation Script ===${NC}"
echo ""

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}Error: SUPABASE_URL environment variable is not set${NC}"
  echo "Please set it to your Supabase project URL"
  echo "Example: export SUPABASE_URL=https://your-project.supabase.co"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set${NC}"
  echo "Please set it to your Supabase service role key"
  echo "Example: export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  exit 1
fi

# Prompt for admin user details
echo -e "${YELLOW}Enter admin user details:${NC}"
read -p "Email: " ADMIN_EMAIL
read -sp "Password: " ADMIN_PASSWORD
echo ""
read -p "First Name: " ADMIN_PRENOM
read -p "Last Name: " ADMIN_NOM

echo ""
echo -e "${YELLOW}Creating admin user...${NC}"

# Create user in Supabase Auth using REST API
CREATE_USER_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASSWORD}\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"nom\": \"${ADMIN_NOM}\",
      \"prenom\": \"${ADMIN_PRENOM}\"
    }
  }")

# Check if user creation was successful
if echo "$CREATE_USER_RESPONSE" | grep -q "\"id\""; then
  USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "${GREEN}✓ User created successfully with ID: ${USER_ID}${NC}"
else
  echo -e "${RED}✗ Failed to create user${NC}"
  echo "Response: $CREATE_USER_RESPONSE"
  exit 1
fi

# Update profile to set admin role and NULL etablissement_id
echo -e "${YELLOW}Setting admin role...${NC}"

UPDATE_PROFILE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/update_admin_profile" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"admin_nom\": \"${ADMIN_NOM}\",
    \"admin_prenom\": \"${ADMIN_PRENOM}\"
  }")

# Alternative: Direct SQL update if RPC function doesn't exist
echo -e "${YELLOW}Updating profile directly via SQL...${NC}"
echo "You may need to run this SQL manually if the script fails:"
echo ""
echo "UPDATE profiles"
echo "SET role = 'admin', etablissement_id = NULL, nom = '${ADMIN_NOM}', prenom = '${ADMIN_PRENOM}'"
echo "WHERE id = '${USER_ID}';"
echo ""

echo -e "${GREEN}=== Admin User Creation Complete ===${NC}"
echo ""
echo "Admin user details:"
echo "  Email: ${ADMIN_EMAIL}"
echo "  User ID: ${USER_ID}"
echo "  Name: ${ADMIN_PRENOM} ${ADMIN_NOM}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "1. Verify the profile was updated correctly by checking the profiles table"
echo "2. The admin user should have role='admin' and etablissement_id=NULL"
echo "3. You can now log in to the admin dashboard at: ${SUPABASE_URL}/admin"
echo ""
echo "To verify, run:"
echo "  SELECT id, email, role, etablissement_id FROM profiles WHERE id = '${USER_ID}';"
echo ""

