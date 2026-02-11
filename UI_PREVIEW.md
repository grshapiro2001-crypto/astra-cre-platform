# ARCHIVED — See .ai/ folder for current documentation

> **Note:** This file is archived as of February 11, 2026. UI has evolved significantly with new purple theme, progressive empty states, and new features. See [README.md](README.md) for current feature list.

## 🎨 Visual Representation of Current UI

### 1. Login Page (`/login`)
```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│                    Sign in to CRE Platform                │
│              Or create a new account [link]               │
│                                                           │
│   ┌───────────────────────────────────────────────┐     │
│   │  Email address                                 │     │
│   │  ┌──────────────────────────────────────────┐│     │
│   │  │ you@example.com                          ││     │
│   │  └──────────────────────────────────────────┘│     │
│   │                                                │     │
│   │  Password                                      │     │
│   │  ┌──────────────────────────────────────────┐│     │
│   │  │ ••••••••                                  ││     │
│   │  └──────────────────────────────────────────┘│     │
│   │                                                │     │
│   │  ┌──────────────────────────────────────────┐│     │
│   │  │          Sign in [Button]                 ││     │
│   │  └──────────────────────────────────────────┘│     │
│   └───────────────────────────────────────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 2. Register Page (`/register`)
```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│                    Create your account                    │
│            Or sign in to existing account [link]          │
│                                                           │
│   ┌───────────────────────────────────────────────┐     │
│   │  Full Name (Optional)                          │     │
│   │  [John Doe                                   ] │     │
│   │                                                │     │
│   │  Email address *                               │     │
│   │  [you@example.com                            ] │     │
│   │                                                │     │
│   │  Password *                                    │     │
│   │  [At least 8 characters                      ] │     │
│   │                                                │     │
│   │  Confirm Password *                            │     │
│   │  [Confirm your password                      ] │     │
│   │                                                │     │
│   │  ┌──────────────────────────────────────────┐│     │
│   │  │        Create account [Button]            ││     │
│   │  └──────────────────────────────────────────┘│     │
│   └───────────────────────────────────────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3. Dashboard Page (After Login)
```
┌────────────────────────────────────────────────────────────────┐
│  CRE Platform                           John Doe    [Logout]    │ ← Header
├──────────┬─────────────────────────────────────────────────────┤
│          │  Dashboard                                           │
│ Dashboard│                                                      │
│ Library  │  ┌────────────────────────────────────────────────┐ │
│ Upload   │  │ Welcome, John Doe!                             │ │
│Comparison│  │                                                 │ │
│          │  │ This is your CRE Platform dashboard. You can   │ │
│  [Dark   │  │ upload Offering Memorandums, manage your       │ │
│  Sidebar]│  │ property library, and compare properties.      │ │
│          │  │                                                 │ │
│          │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ │ │
│          │  │  │  Upload    │ │  Library   │ │ Comparison │ │ │
│          │  │  │ Properties │ │            │ │            │ │ │
│          │  │  │            │ │ Organize   │ │ Compare    │ │ │
│          │  │  │Upload and  │ │ your       │ │ properties │ │ │
│          │  │  │analyze OMs │ │ properties │ │ side-by-   │ │ │
│          │  │  │and BOVs    │ │ with       │ │ side       │ │ │
│          │  │  │            │ │ folders    │ │            │ │ │
│          │  │  └────────────┘ └────────────┘ └────────────┘ │ │
│          │  │                                                 │ │
│          │  └────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
  Sidebar      Main Content Area
```

### 4. Library Page (Placeholder - Phase 3)
```
┌────────────────────────────────────────────────────────────────┐
│  CRE Platform                           John Doe    [Logout]    │
├──────────┬─────────────────────────────────────────────────────┤
│          │  Property Library                                    │
│ Dashboard│                                                      │
│→Library ←│  ┌────────────────────────────────────────────────┐ │
│ Upload   │  │                                                 │ │
│Comparison│  │ Your property library will be displayed here.  │ │
│          │  │ This feature will be implemented in Phase 3.   │ │
│          │  │                                                 │ │
│          │  └────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

### 5. Upload Page (Placeholder - Phase 2)
```
┌────────────────────────────────────────────────────────────────┐
│  CRE Platform                           John Doe    [Logout]    │
├──────────┬─────────────────────────────────────────────────────┤
│          │  Upload Property                                     │
│ Dashboard│                                                      │
│ Library  │  ┌────────────────────────────────────────────────┐ │
│→Upload  ←│  │                                                 │ │
│Comparison│  │ PDF upload and extraction functionality will   │ │
│          │  │ be implemented in Phase 2.                     │ │
│          │  │                                                 │ │
│          │  └────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

## 🎨 Design System

### Colors
- **Primary Blue**: `#3b82f6` (buttons, links, highlights)
- **Primary Hover**: `#2563eb`
- **Background**: `#f9fafb` (light gray)
- **Cards**: `#ffffff` (white with shadow)
- **Text**: `#111827` (dark gray)
- **Sidebar**: `#1f2937` (dark gray/black)

### Typography
- **Headings**: Bold, large (text-3xl, text-xl)
- **Body**: Regular, readable (text-sm, text-base)
- **Font Family**: System fonts (SF Pro, Segoe UI, Roboto)

### Components
- **Cards**: White background, rounded corners, shadow
- **Buttons**: Primary blue, hover effect, rounded
- **Inputs**: Border, rounded, focus ring (blue)
- **Sidebar**: Dark gray, white text, active state highlight

## 📱 Responsive Design

Currently optimized for desktop (1024px+) but includes mobile-friendly Tailwind classes:
- Sidebar collapses on mobile (can be enhanced)
- Grid layouts stack vertically on small screens
- Forms remain readable on all devices

## 🔄 User Flow

### Registration Flow
```
1. Visit http://localhost:5173
   ↓
2. Redirect to /dashboard (but not authenticated)
   ↓
3. ProtectedRoute redirects to /login
   ↓
4. Click "create a new account"
   ↓
5. Fill registration form
   ↓
6. Submit → Auto-login → Redirect to /dashboard
   ↓
7. See welcome message with user name
```

### Login Flow
```
1. Visit /login
   ↓
2. Enter email and password
   ↓
3. Submit → Receive JWT token
   ↓
4. Token stored in:
   - httpOnly cookie (secure)
   - localStorage (backup)
   ↓
5. Redirect to /dashboard
   ↓
6. Can navigate to all protected pages
```

### Logout Flow
```
1. Click "Logout" button in header
   ↓
2. Clear cookies and localStorage
   ↓
3. Redirect to /login
   ↓
4. Can no longer access protected routes
```

## 🔐 Security Indicators

The UI shows the user is authenticated by:
- ✅ Header displays user name/email
- ✅ Logout button is visible
- ✅ Can access all navigation items
- ✅ No redirect loops or errors

## 🎯 Interactive Elements

### Header
- User name/email (read-only display)
- **Logout button** (functional - clears auth and redirects)

### Sidebar Navigation
- **Dashboard** - Active state on /dashboard
- **Library** - Navigates to placeholder page
- **Upload** - Navigates to placeholder page
- **Comparison** - Navigates to placeholder page
- Active state: Darker background, white text

### Forms
- Email validation (must be valid email)
- Password validation (min 8 characters)
- Password confirmation match check
- Error messages display in red box
- Loading states: "Signing in..." / "Creating account..."

## 📊 What Data is Currently Stored

### In Database (PostgreSQL)
```sql
users table:
  - id: UUID (e.g., "a1b2c3d4-...")
  - email: "user@example.com"
  - hashed_password: "$2b$12$..." (bcrypt hash)
  - full_name: "John Doe" (optional)
  - is_active: true
  - created_at: timestamp
  - updated_at: timestamp
```

### In Browser
```javascript
localStorage:
  - access_token: "eyJhbGc..." (JWT token)
  - user: {"id": "...", "email": "...", ...}

cookies:
  - access_token: "eyJhbGc..." (httpOnly, secure)
```

### In Memory (Zustand Store)
```javascript
authStore:
  - user: { id, email, full_name, ... }
  - isAuthenticated: true/false
  - isLoading: true/false
  - error: null or error message
```

## 🎬 Next UI Components (Phase 2)

When Phase 2 is implemented, the Upload page will look like:

```
┌────────────────────────────────────────────────────────────────┐
│  CRE Platform                           John Doe    [Logout]    │
├──────────┬─────────────────────────────────────────────────────┤
│          │  Upload Property                                     │
│ Dashboard│                                                      │
│ Library  │  ┌────────────────────────────────────────────────┐ │
│→Upload  ←│  │  ┌──────────────────────────────────────────┐  │ │
│Comparison│  │  │  📄 Drag & Drop PDF Here                 │  │ │
│          │  │  │     or click to browse                    │  │ │
│          │  │  │                                           │  │ │
│          │  │  │  Supported: PDF files up to 50MB         │  │ │
│          │  │  └──────────────────────────────────────────┘  │ │
│          │  │                                                 │ │
│          │  │  [Upload Button]                               │ │
│          │  │                                                 │ │
│          │  │  ── After Upload ──                            │ │
│          │  │                                                 │ │
│          │  │  Extracting data... [Progress Bar 75%]         │ │
│          │  │                                                 │ │
│          │  │  ── Extraction Complete ──                     │ │
│          │  │                                                 │ │
│          │  │  Property Name: [Sunset Apartments          ]  │ │
│          │  │  Address: [123 Main St                      ]  │ │
│          │  │  Submarket: [Downtown                       ]  │ │
│          │  │  Unit Count: [150                           ]  │ │
│          │  │  Cap Rate: [5.75%                           ]  │ │
│          │  │  ...                                           │ │
│          │  │                                                 │ │
│          │  │  [Correct Data] [Save to Library]              │ │
│          │  └────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

---

**Current Status**: Clean, professional UI with authentication working perfectly ✅
**Next**: Implement PDF upload UI and extraction preview 🚀
