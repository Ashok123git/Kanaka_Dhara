# Kanaka Dhara — Frontend

React (Vite + TypeScript + Tailwind) app for the Kanaka Dhara wholesaler ledger. Connects to the FastAPI backend; auth via phone + OTP and JWT.

## Structure (from plan)

- **`src/api/`** — API client (`client.ts`), auth header injection, 401 → clear token + redirect; `auth`, `wholesalers`, `contacts`, `orders`, `transactions`.
- **`src/auth/`** — `AuthContext`, `useAuth`, `ProtectedRoute`.
- **`src/pages/`** — Welcome, Login (phone + OTP), Register (business profile), Home, Chat (per contact), NotFound.
- **`src/lib/`** — `storage.ts` (legacy; phase out in favour of API + React Query).
- **`src/types/`** — Domain types aligned with API DTOs.

## Setup

```bash
cp .env.example .env
# Edit .env: set VITE_API_BASE_URL (e.g. http://localhost:8000)
npm install
npm run dev
```

Runs at `http://localhost:5173`. Ensure the backend is running for API calls.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview production build
