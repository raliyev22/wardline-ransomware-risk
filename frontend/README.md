# Frontend — Ransomware Decision Support (Step 3)

Next.js (App Router) + TypeScript + Tailwind CSS v4 + Lucide icons. Data are fetched client-side from the FastAPI backend in `backend/api/`. **All hospital data and model results are synthetic and illustrative.**

## Run locally

Use two terminals, both starting from the project root `hospital-ransomware-platform/`.

**1. Backend API** (one-time setup, then start):

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/uvicorn backend.api.main:app --reload --port 8000
```

**2. Frontend**:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Completed simulations are available under Dashboard in the workspace sidebar.

### Configuration

The API base URL comes from `NEXT_PUBLIC_API_BASE_URL` and defaults to `http://localhost:8000`. To change it, copy `.env.example` to `.env.local` and edit it. The backend's CORS settings allow `http://localhost:3000` and `http://127.0.0.1:3000`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Structure

| Path | Purpose |
|---|---|
| `src/app/` | Routes: `/` (Hospital Overview), `/threats`, `/simulator`, `/investments`, `/analytics`, `/comparison`, `/dashboard` |
| `src/components/shell/` | Workspace sidebar and organization header |
| `src/components/ui/` | Cards, badges (including the Synthetic badge), tables, stats, coverage bars, loading/error/empty states |
| `src/components/overview/` | Hospital Overview page |
| `src/components/placeholder-page.tsx` | Shared layout for the five planned pages |
| `src/lib/api.ts` | API client: base URL, timeouts, error normalization, de-duplicated GETs |
| `src/lib/use-api.ts` | Client hook giving loading, error and retry state |
| `src/lib/format.ts` | Currency, number and percent formatting, label humanizing, ID-list parsing |
| `src/lib/types.ts` | Response types that mirror `backend/api/schemas.py` |

The Hospital Overview page shows only values returned by `GET /api/hospital`, `GET /api/investments` and `GET /api/risk/baseline`. It hardcodes no figures. Missing fields show "—", empty lists show an empty state, and a failed request shows an error with a Retry button.
