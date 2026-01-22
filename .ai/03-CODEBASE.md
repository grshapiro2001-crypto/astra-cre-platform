# Codebase Inventory - Astra CRE Platform

**Purpose:** Quick reference of what EXISTS. Check this BEFORE building anything new.  
**Update:** Add new files/components as you create them.  
**Length:** Keep concise - just names and one-line descriptions.

---

## Completed Features

### ✅ Core Features (Working)
- **Document Upload & Extraction** - Upload PDF, Claude extracts metrics
- **Deal Folders** - Organize properties into folders
- **Property Detail View** - Display extracted data for single property
- **Side-by-Side Comparison** - Compare 2-5 properties in table
- **Investment Criteria Filtering** - Highlight rows based on user-selected metrics
- **BOV Multi-Tier Pricing** - Display 2-5 pricing scenarios from BOV documents
- **CSV Export** - Export comparison data to CSV
- **Dark/Light Mode** - Theme toggle with persistence

### ✅ Data Management
- **Duplicate Detection** - Warns when saving duplicate property
- **Folder Creation** - Create empty folders without uploading
- **Folder Deletion** - Delete folders with/without documents
- **Orphaned Properties** - Properties can exist without folders

---

## Frontend File Structure

### Pages (`frontend/src/pages/`)
- `Library.tsx` - Deal folder grid (main page)
- `FolderDetail.tsx` - Properties within a folder
- `PropertyDetail.tsx` - Single property view with all metrics
- `ComparisonPage.tsx` - Side-by-side comparison table
- `Upload.tsx` - Document upload and extraction preview

### Components - Library (`frontend/src/components/library/`)
- `CreateFolderModal.tsx` - Create new deal folder
- `DeleteFolderModal.tsx` - Delete folder with confirmation
- `SaveToFolderModal.tsx` - Save property to folder (new or existing)

### Components - Comparison (`frontend/src/components/comparison/`)
- `ComparisonTable.tsx` - Main comparison table with gradient highlighting
- `InvestmentCriteriaPanel.tsx` - Select metrics to highlight

### Components - Property (`frontend/src/components/property/`)
- `BOVPricingTiers.tsx` - Display BOV pricing tiers with tabs
- `PricingAnalysis.tsx` - Pricing summary cards

### Components - Upload (`frontend/src/components/upload/`)
- `PDFUploader.tsx` - Drag-and-drop file upload
- `ExtractionPreview.tsx` - Show extracted data before saving

### Components - UI (`frontend/src/components/ui/`)
**shadcn/ui components - DON'T MODIFY THESE:**
- `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`
- `select.tsx`, `table.tsx`, `tabs.tsx`, `badge.tsx`, `checkbox.tsx`
- `alert.tsx`, `alert-dialog.tsx`, `radio-group.tsx`, `separator.tsx`, `skeleton.tsx`

### Services (`frontend/src/services/`)
- `dealFolderService.ts` - Folder CRUD operations
- `propertyService.ts` - Property operations
- `comparisonService.ts` - Comparison data fetching

### Utils (`frontend/src/utils/`)
- `criteriaEvaluation.ts` - Calculate gradient colors for criteria filtering
- `csvExport.ts` - Export comparison data to CSV

### Types (`frontend/src/types/`)
- `property.ts` - TypeScript interfaces for property data

### Other Frontend Files
- `App.tsx` - Main app component with routing
- `index.css` - Global Tailwind imports
- `main.tsx` - React entry point
- `components.json` - shadcn/ui configuration
- `tailwind.config.js` - Tailwind configuration

---

## Backend File Structure

### API Routes (`backend/app/api/routes/`)
- `deal_folders.py` - Deal folder endpoints
  - `GET /deal-folders` - List all folders
  - `POST /deal-folders` - Create folder
  - `GET /deal-folders/{id}` - Get folder with properties
  - `DELETE /deal-folders/{id}` - Delete folder
  
- `properties.py` - Property endpoints
  - `GET /properties/{id}` - Get property details
  - `GET /properties` - List properties (with filters)
  - `DELETE /properties/{id}` - Delete property
  
- `upload.py` - Upload and extraction endpoints
  - `POST /upload` - Upload PDF and extract data
  - `POST /upload/save-to-folder` - Save extracted property to folder
  - `POST /compare` - Get comparison data for multiple properties

### Models (`backend/app/models/`)
- `deal_folder.py` - DealFolder SQLAlchemy model
- `property.py` - Property, BOVPricingTier, BOVCapRate models

### Schemas (`backend/app/schemas/`)
- `deal_folder.py` - Pydantic schemas for folders
- `property.py` - Pydantic schemas for properties

### Services (`backend/app/services/`)
- `claude_extraction_service.py` - Claude API integration for PDF extraction
- `bov_service.py` - BOV-specific extraction logic
- `comparison_service.py` - Comparison data aggregation
- `property_service.py` - Property business logic
- `pdf_service.py` - PDF file handling

### Utils (`backend/app/utils/`)
- `file_handler.py` - File upload/storage utilities

### Other Backend Files
- `main.py` - FastAPI app initialization, CORS, routes
- `config.py` - Configuration, environment variables
- `requirements.txt` - Python dependencies

---

## Database Schema

### Tables

**`deal_folders`**
- `id` (Integer, PK)
- `folder_name` (String, unique)
- `property_type` (String, nullable)
- `document_count` (Integer, default 0)
- `user_id` (String)
- `created_at`, `last_updated` (DateTime)

**`properties`**
- `id` (Integer, PK)
- `deal_folder_id` (Integer, FK, nullable) - Can be NULL (orphaned)
- `property_name` (String)
- `document_type` (String) - "OM", "BOV", etc.
- `address`, `city`, `state`, `zip_code`
- `property_type` (String)
- `units`, `total_sf`, `year_built`, `occupancy_percent`
- `t12_*`, `t3_*`, `y1_*` (Financial metrics)
- `calculated_*` (Derived metrics)
- `user_id`, `created_at`, `last_updated`

**`bov_pricing_tiers`**
- `id` (Integer, PK)
- `property_id` (Integer, FK)
- `tier_number` (Integer)
- `tier_type` (String) - "asking_price", "market", etc.
- `tier_label` (String, nullable)
- `pricing` (Numeric)
- `price_per_unit`, `price_per_sf`
- `unlevered_irr`, `levered_irr`, `equity_multiple`, `avg_cash_on_cash`
- `leverage_ltv`, `loan_amount`, `interest_rate`
- `io_period_years`, `amortization_years`
- `terminal_cap_rate`, `hold_period_years`

**`bov_cap_rates`**
- `id` (Integer, PK)
- `property_id` (Integer, FK)
- `bov_pricing_tier_id` (Integer, FK, nullable)
- `rate_type` (String) - "Trailing", "Proforma", "Stabilized"
- `value` (Numeric)
- `noi_basis` (String) - "T12", "Y1", etc.
- `qualifier` (Text) - "Tax-adjusted", "As-is", etc.

**`analysis_logs`**
- `id` (Integer, PK)
- `property_id` (Integer, FK)
- `extraction_time_seconds` (Float)
- `status` (String)
- `error_message` (Text, nullable)
- `created_at`

---

## API Endpoints Summary

### Deal Folders
- `GET /api/v1/deal-folders` - List all folders
- `POST /api/v1/deal-folders` - Create new folder
- `GET /api/v1/deal-folders/{id}` - Get folder with properties
- `DELETE /api/v1/deal-folders/{id}` - Delete folder

### Properties
- `GET /api/v1/properties/{id}` - Get property details
- `GET /api/v1/properties` - List properties (with optional filters)
- `DELETE /api/v1/properties/{id}` - Delete property

### Upload & Analysis
- `POST /api/v1/upload` - Upload PDF, extract data with Claude
- `POST /api/v1/upload/save-to-folder` - Save extracted property

### Comparison
- `POST /api/v1/compare` - Compare multiple properties

---

## Key Libraries & Dependencies

### Frontend
- `react` v18 - UI framework
- `react-router-dom` - Client-side routing
- `vite` - Build tool
- `tailwindcss` - Utility-first CSS
- `lucide-react` - Icons
- `recharts` - Charts (for future analytics)

### Backend
- `fastapi` - Web framework
- `sqlalchemy` - ORM
- `pydantic` - Validation
- `anthropic` - Claude API client
- `pypdf2` / `pdfplumber` - PDF processing
- `python-multipart` - File uploads

---

## shadcn/ui Components Available

**Button Variants:**
- `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`

**Card Components:**
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

**Dialog Components:**
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`

**Form Components:**
- `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Checkbox`, `RadioGroup`, `RadioGroupItem`

**Display Components:**
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Badge`, `Separator`, `Skeleton`
- `Alert`, `AlertTitle`, `AlertDescription`
- `AlertDialog` (for confirmations)

**Use these instead of building custom components!**

---

## Reusable Patterns

### API Call Pattern
```typescript
// In service file
export const propertyService = {
  async getProperty(id: string) {
    const response = await fetch(`${API_URL}/properties/${id}`);
    if (!response.ok) throw new Error('Failed to fetch property');
    return response.json();
  }
};

// In component
useEffect(() => {
  propertyService.getProperty(id)
    .then(data => setProperty(data))
    .catch(err => setError(err.message));
}, [id]);
```

### Modal Pattern
```typescript
const [isOpen, setIsOpen] = useState(false);

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

### Comparison Table Gradient Pattern
```typescript
// In criteriaEvaluation.ts
export function getGradientColor(
  value: number,
  values: number[],
  direction: 'highest' | 'lowest'
): string {
  // Returns Tailwind class: 'bg-emerald-500/20', 'bg-yellow-400/20', etc.
}
```

---

## What's NOT Built Yet

### Planned Features (Not Started)
- Portfolio Analysis with map view
- Smart portfolios (filter-based)
- Manual portfolios (user-curated)
- Property image uploads
- Team collaboration
- Comments on properties
- Activity feed
- Advanced analytics dashboard

### Known Gaps
- No pagination (shows all items)
- No search functionality
- No bulk operations
- No undo/redo
- No keyboard shortcuts
- No offline mode

---

<before_building>
## Before Building Anything New

**Ask yourself:**

1. **Does this component already exist?**
   - Check `/components/ui` first (shadcn)
   - Check feature folders (`/library`, `/comparison`, `/property`)
   - Check other pages - can you reuse?

2. **Does this API endpoint already exist?**
   - Check `backend/app/api/routes/` files
   - Can you add a parameter instead of new endpoint?

3. **Does this utility function already exist?**
   - Check `/utils` folders (frontend and backend)
   - Can you extend existing function?

4. **Is this data already in the database?**
   - Check schema above
   - Can you query existing tables?

**If YES to any → REUSE, don't rebuild!**
</before_building>

---

**Last Updated:** January 21, 2026  
**Keep this updated:** Add new files/components as you create them.  
**Token Count:** ~2,000 (optimized for context)
