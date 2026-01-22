-- Fix for orphaned "Tower on Piedmont" property
-- Run this SQL directly on your SQLite database

-- STEP 1: Find your property and folder IDs
-- This shows all properties without folders
SELECT id, deal_name, property_address, deal_folder_id
FROM properties
WHERE deal_folder_id IS NULL;

-- This shows all folders
SELECT id, folder_name, document_count
FROM deal_folders;

-- STEP 2: Update property to assign to folder
-- Replace [property_id] and [folder_id] with actual IDs from queries above
-- Example: If property id=5 and folder id=3:
--   UPDATE properties SET deal_folder_id = 3 WHERE id = 5;

UPDATE properties
SET deal_folder_id = [folder_id]
WHERE id = [property_id];

-- STEP 3: Update folder document count
-- Replace [folder_id] with the actual folder ID
UPDATE deal_folders
SET document_count = (
  SELECT COUNT(*)
  FROM properties
  WHERE deal_folder_id = [folder_id]
)
WHERE id = [folder_id];

-- STEP 4: Verify the fix
SELECT
  p.id as property_id,
  p.deal_name,
  p.deal_folder_id,
  f.folder_name,
  f.document_count
FROM properties p
LEFT JOIN deal_folders f ON p.deal_folder_id = f.id
WHERE p.deal_name = 'Tower on Piedmont';

-- GENERAL FIX: Assign all orphaned properties to auto-created folders
-- This creates a folder for each orphaned property and assigns it
-- Run this if you have multiple orphaned properties

-- WARNING: This will create NEW folders for orphaned properties
-- Only run this if you want to create individual folders for each orphaned property

BEGIN TRANSACTION;

-- For each orphaned property, this would need to be done individually
-- Or you can use the new PATCH endpoint from the UI

COMMIT;
