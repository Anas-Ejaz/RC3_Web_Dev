# Recruitment & Talent Intelligence Platform (frontend)

Next.js (App Router, TypeScript), Tailwind, shadcn/ui, TanStack Query, React Hook Form + Zod, Recharts, sonner.
AI output is advisory: every screen says so and every hiring decision is made by a person.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend origin (e.g. `http://localhost:8000`). `/api/*` is proxied to it by a Next.js rewrite, so the HttpOnly auth cookie stays same-site. No trailing slash, no `/api/v1`. |
| `NEXT_PUBLIC_USE_MOCKS` | `true` serves contract-shaped data from MSW for development. `false` calls the real API. Must be `false` in production. |

## Demo accounts (mock mode)

- Recruiter: `recruiter@demo.com` / `password`

## Demo scenario

1. Recruiter posts a Backend Developer job (Python, Django, PostgreSQL, Docker).
2. Three candidates apply with resumes.
3. Recruiter opens ranked applicants and reads the explainable scores and missing-evidence flags.
4. Recruiter shortlists one, generates interview questions, and schedules an interview.
5. The dashboard updates.

## Scripts

- `npm run dev` start the dev server
- `npm run build` production build
- `npm run lint` lint
- `npx tsc --noEmit` type check

## Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel choose **Add New, Project**, import the repo. The Next.js preset is detected automatically.
3. Under **Environment Variables** add:
   - `NEXT_PUBLIC_API_URL` = your deployed backend origin (HTTPS)
   - `NEXT_PUBLIC_USE_MOCKS` = `false`
4. Deploy. Rewrites are read at build time, so **redeploy** after changing `NEXT_PUBLIC_API_URL`.
5. On the backend, allow the Vercel domain in CORS and set the auth cookie to `Secure` and `SameSite=Lax`. Because requests go through the `/api/*` rewrite, the browser sees a same-origin request.

## Troubleshooting

- **Logged out on every refresh:** the cookie is not being set. Check `NEXT_PUBLIC_API_URL`, and that the backend cookie is `Secure` on HTTPS.
- **404 on API calls:** `NEXT_PUBLIC_API_URL` includes `/api/v1`. Remove it.
- **Mock data in production:** `NEXT_PUBLIC_USE_MOCKS` is not `false`. Change it and redeploy.