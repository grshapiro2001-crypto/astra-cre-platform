#!/bin/bash
# Quick fix script to assign property to folder using the new API endpoint

# Configuration
API_BASE="http://localhost:8000/api/v1"

# Get your auth token from browser localStorage
# Open browser console and run: localStorage.getItem('token')
AUTH_TOKEN="your-token-here"

# STEP 1: Find orphaned properties
echo "=== Finding orphaned properties ==="
curl -X GET "$API_BASE/properties" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.properties[] | select(.deal_folder_id == null) | {id, deal_name, deal_folder_id}'

# STEP 2: Find folders
echo -e "\n=== Finding folders ==="
curl -X GET "$API_BASE/deal-folders" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.[] | {id, folder_name, document_count}'

# STEP 3: Assign property to folder
# Replace PROPERTY_ID and FOLDER_ID with actual IDs from above
PROPERTY_ID=1  # Replace with your property ID
FOLDER_ID=1    # Replace with your folder ID

echo -e "\n=== Assigning property $PROPERTY_ID to folder $FOLDER_ID ==="
curl -X PATCH "$API_BASE/properties/$PROPERTY_ID/folder?folder_id=$FOLDER_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"

# STEP 4: Verify
echo -e "\n=== Verifying folder ==="
curl -X GET "$API_BASE/deal-folders/$FOLDER_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '{folder_name, document_count}'

echo -e "\n=== Checking folder contents ==="
curl -X GET "$API_BASE/deal-folders/$FOLDER_ID/properties" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.[] | {id, deal_name, document_type}'
