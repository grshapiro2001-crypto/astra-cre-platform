# CRE Platform Frontend

React + TypeScript frontend for the Commercial Real Estate Platform.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The default configuration should work for local development.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   └── layout/         # Layout components
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── MainLayout.tsx
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Library.tsx
│   │   ├── Upload.tsx
│   │   └── Comparison.tsx
│   ├── services/           # API services
│   │   ├── api.ts
│   │   └── authService.ts
│   ├── store/              # Zustand state management
│   │   └── authSlice.ts
│   ├── types/              # TypeScript types
│   │   └── auth.ts
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Features

### Phase 1: Authentication ✅
- User registration
- Login with email/password
- JWT token authentication
- Protected routes
- Basic dashboard layout

### Coming Soon
- PDF upload and extraction (Phase 2)
- Property library management (Phase 3)
- Financial comparison tool (Phase 4)

## Routing

| Route | Component | Protected | Description |
|-------|-----------|-----------|-------------|
| `/login` | LoginForm | No | Login page |
| `/register` | RegisterForm | No | Registration page |
| `/dashboard` | Dashboard | Yes | Main dashboard |
| `/library` | Library | Yes | Property library (Phase 3) |
| `/upload` | Upload | Yes | PDF upload (Phase 2) |
| `/comparison` | Comparison | Yes | Property comparison (Phase 4) |
| `/` | - | - | Redirects to dashboard |

## State Management

Using Zustand for lightweight state management.

### Auth Store

```typescript
// Access auth state
const { user, isAuthenticated, isLoading } = useAuthStore();

// Auth actions
const { login, register, logout, checkAuth } = useAuthStore();

// Usage
await login(email, password);
await register(email, password, fullName);
await logout();
```

## API Integration

### Axios Configuration

The app uses Axios with:
- Base URL: `http://localhost:8000/api/v1`
- Credentials: Enabled (for httpOnly cookies)
- Auto JWT token injection
- Auth error handling (401 redirects to login)

### Adding New API Calls

1. Create service file in `src/services/`
2. Use the configured `api` instance
3. Define TypeScript types in `src/types/`

Example:

```typescript
// src/services/propertyService.ts
import { api } from './api';
import { Property } from '@/types/property';

export const propertyService = {
  async getProperties(): Promise<Property[]> {
    const response = await api.get<Property[]>('/properties');
    return response.data;
  },
};
```

## Styling

Using Tailwind CSS for styling.

### Theme Colors

```javascript
primary: {
  50: '#eff6ff',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
}
```

### Common Classes

```css
/* Buttons */
.btn-primary: bg-primary-600 hover:bg-primary-700 text-white

/* Cards */
.card: bg-white shadow rounded-lg p-6

/* Inputs */
.input: border border-gray-300 rounded-md px-3 py-2
```

## Development Guidelines

### Component Structure

```typescript
// Imports
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Component
export const MyComponent = () => {
  // Hooks
  const navigate = useNavigate();
  const [state, setState] = useState();

  // Handlers
  const handleClick = () => {};

  // Render
  return <div>...</div>;
};
```

### TypeScript

- Always define prop types
- Use interfaces for component props
- Define API response types
- Enable strict mode

### Code Organization

- One component per file
- Group related components in folders
- Use barrel exports (index.ts)
- Keep components small and focused

## Building for Production

```bash
# Build
npm run build

# Preview build locally
npm run preview
```

Build output will be in the `dist/` directory.

## Troubleshooting

### API Connection Issues

1. Check backend is running on port 8000
2. Verify `VITE_API_URL` in `.env`
3. Check browser console for CORS errors
4. Clear browser cache/cookies

### Authentication Issues

1. Clear localStorage: `localStorage.clear()`
2. Check JWT token expiration
3. Verify backend authentication endpoints
4. Check Network tab for failed requests

### Build Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Clear npm cache
npm cache clean --force
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:8000/api/v1 |

**Note:** Vite requires the `VITE_` prefix for environment variables to be exposed to the client.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

### Core
- React 18
- TypeScript 5
- Vite 5

### Routing & State
- React Router 6
- Zustand 4

### HTTP & Data
- Axios 1.6

### UI & Styling
- Tailwind CSS 3

### Planned Additions (Phase 2+)
- react-dropzone (file upload)
- @tanstack/react-table (data tables)
- recharts (charts)
