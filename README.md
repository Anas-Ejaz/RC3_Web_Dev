# AI Recruitment & Talent Intelligence Platform (backend)

FastAPI backend for a recruitment platform where **AI recommends and humans decide**. It parses resumes, verifies
every claim against the resume text, scores candidates with code (not with an LLM), supports semantic talent search
and duplicate detection, and records every status change in an audit trail.

## What it does
- Candidates upload a resume (PDF); it is parsed into skills, education, experience and projects.
- Recruiters post jobs; applicants get a computed, explainable assessment against the job.
- Recruiters shortlist, reject, schedule interviews and generate interview questions. All status changes are manual and audited.
- Talent pool and semantic search surface past applicants (only those who consented).
- Duplicate detection finds candidates with several accounts; merging is human-confirmed and non-destructive.
- A fairness test checks that personal attributes do not change scores.

## Architecture
```
Server/
  app/
    main.py            FastAPI app, CORS, routers (all under /api/v1)
    core/              config, database, deps (role guards), errors, security, rate_limit, logging
    models/            SQLAlchemy models (user, job, candidate, application, interview, talent, enums)
    schemas/           Pydantic schemas (kept separate from models)
    services/          business logic (routers stay thin)
      parsing.py       upload validation, PyMuPDF with pdfplumber fallback
      resumes.py       parse pipeline (LLM extraction + evidence verification)
      verification.py  fuzzy evidence checks against the real resume text
      normalize.py     skill aliases and surface forms
      embeddings.py    embed(texts) via fastembed
      matching.py      scoring engine
      applications.py  apply, status changes, audit, notes, override, compute_scores
      anonymize.py     strips personal attributes before scoring/embedding
      talent_pool.py   shared eligibility rules (consent, retention, ownership)
      search.py        semantic talent search (pgvector)
      duplicates.py    duplicate detection and merge
      fairness.py, recommendations.py, questions.py, interviews.py, notifications.py, analytics.py, llm.py
    routers/           auth, health, jobs, candidates, applications, interviews, analytics, fairness, talent
    tests/             pytest suite (runs against the real database)
  alembic/             migrations 0001-0007
  scripts/             seed.py, purge_retention.py, check_requirements.py
  Dockerfile, docker-compose.yml, .env.example
```
Stack: Python 3.11+, FastAPI, SQLAlchemy 2 (sync) + Alembic, PostgreSQL (Neon) + pgvector, Pydantic v2, Groq (JSON mode),
fastembed (BAAI/bge-small-en-v1.5, 384 dims), rapidfuzz, PyMuPDF.

## Scoring formula and evidence states
`overall = 0.50 * skills + 0.25 * experience + 0.15 * projects + 0.10 * qualifications` (each 0-100).
All scores are computed in code from embeddings and verified evidence. The LLM only extracts structured data and writes
prose from already computed results. A recruiter can override a score; the override needs a reason and is flagged.

Each required skill gets one state: `confirmed`, `weak_evidence` or `no_evidence_found`.
The platform never says a candidate "lacks" a skill, only that no evidence was found in the resume.

## Hallucination verification
Every extracted skill and claim carries an `evidence_excerpt`. The excerpt is checked (exact, then fuzzy) against the
stored resume text. Skills also need their excerpt to actually mention the skill. Failures get `verified=false` and are
listed in `unsupported_claims`. Semantic search excerpts go through the same check and are dropped if they fail.

## Fairness approach and known limits
Before scoring, search and embedding, `anonymize.strip_for_scoring` removes name, email, phone, links and lines such as
"Age:", "Gender:", "Nationality:", "Address:". `POST /fairness/test` scores the same resume with and without such
attributes and reports `max_abs_delta` against a `tolerance`.
Known limits:
- Indirect proxies are NOT removed: school names, graduation years, employer names, clubs.
- The test cannot prove the embedding model is bias-free; it only shows that the listed attributes do not change scores.
- Stripping is pattern-based; unusual formats (for example attributes inside a sentence) can slip through.

## Setup (Windows PowerShell)
```powershell
cd Server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env        # then edit .env
python -c "import secrets; print(secrets.token_urlsafe(64))"   # paste into JWT_SECRET
alembic upgrade head
uvicorn app.main:app --reload
```
Open http://localhost:8000/docs (development only). Health check: `GET /api/v1/health`.
The first embedding call downloads the model (about 130 MB) unless you use Docker, which caches it at build time.

## Setup (Docker)
```powershell
docker compose up --build                    # uses DATABASE_URL (Neon) from .env
docker compose --profile local-db up --build # local pgvector Postgres; set DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/recruit
```
The container runs `alembic upgrade head` and then uvicorn on `$PORT`.

## Environment variables
| Variable | Default | Purpose |
|---|---|---|
| ENVIRONMENT | development | `production` disables /docs and enforces safe cookie/secret settings |
| LOG_LEVEL | INFO | logging level (resume text and keys are never logged) |
| API_PREFIX | /api/v1 | route prefix |
| FRONTEND_URL | http://localhost:3000 | the only allowed CORS origin |
| DATABASE_URL | local Postgres | Neon/Postgres URL (pgvector required) |
| JWT_SECRET | change-me | JWT signing key (32+ chars required in production) |
| JWT_ALGORITHM | HS256 | JWT algorithm |
| ACCESS_TOKEN_EXPIRE_MINUTES | 60 | session length |
| COOKIE_NAME | access_token | HttpOnly cookie name |
| COOKIE_SECURE | false | `true` on https |
| COOKIE_SAMESITE | lax | `lax` (same-site/proxy) or `none` (cross-site, needs Secure) |
| LOGIN_MAX_ATTEMPTS / LOGIN_WINDOW_SECONDS | 5 / 300 | login rate limit |
| GROQ_API_KEY | empty | required for all AI features |
| GROQ_MODEL_EXTRACT / GROQ_MODEL_EXPLAIN | llama-3.3-70b-versatile | models for extraction / prose |
| GROQ_TIMEOUT_SECONDS | 30 | per-call timeout |
| EMBEDDING_PROVIDER | fastembed | only fastembed is implemented |
| EMBEDDING_MODEL | BAAI/bge-small-en-v1.5 | must output 384 dims |
| EMBEDDING_DIM | 384 | must match the pgvector column |
| MAX_UPLOAD_MB | 5 | upload limit |
| TALENT_POOL_RETENTION_DAYS | 180 | talent-pool window, measured from Application.updated_at |
| DUPLICATE_SIMILARITY_THRESHOLD | 0.92 | cosine threshold for resume-text duplicates |
| DEMO_PASSWORD | Demo-Str0ng-Pass1 | seed accounts only |

## Migrations, seed, tests
```powershell
alembic upgrade head                 # apply migrations (required before pytest)
python -m scripts.seed               # idempotent demo data via the real AI pipeline (needs GROQ_API_KEY)
python -m scripts.seed --reset       # delete only demo users (@demo.example.com), then seed again
pytest -q                            # tests run against the real database inside rolled-back transactions
python -m scripts.purge_retention    # dry-run retention purge; add --apply to execute
python -m scripts.check_requirements # compare imports with requirements.txt
```

## Demo walkthrough
1. Run the seed and note the printed credentials and scores. The three candidates score differently; missing skills show "no evidence found".
2. Log in as `recruiter@demo.example.com` (Swagger `POST /auth/login`, or the frontend).
3. Open the job "Backend Developer"; list applicants sorted by score. Open the strong candidate: breakdown, skill evidence, explanation.
4. Show the partial match: Docker is only `weak_evidence` (a project mention), PostgreSQL is `no_evidence_found`.
5. Show the shortlist reason in the audit trail, the generated interview questions and the scheduled interview.
6. Log in as `interviewer@demo.example.com` to show the interviewer's view and conflict detection.
7. As the recruiter, run `POST /fairness/test` on an application and show `max_abs_delta` within `tolerance`.
8. Create a second job, then `GET /talent/pool?job_id=<id>`: the partial match appears (opted in, reviewed).
9. `POST /talent/search` with `{"query": "python django developer, at least 2 years", "limit": 10}`: scores and evidence excerpts.
10. `GET /talent/duplicates` (empty on the seed data), to show that duplicate detection works without false positives.

## API overview
Base path `/api/v1`. Auth is an HttpOnly JWT cookie. Pagination: `?page=1&page_size=20` returns `{items,total,page,page_size}`.
- Auth and health: `/auth/*`, `/health`
- Jobs: `/jobs`, `/jobs/{id}`, `/jobs/{id}/apply`
- Candidate: `/candidate/resume`, `/candidate/resume/reparse`, `/candidate/recommendations`, `/candidate/talent-pool-consent` (GET/PUT)
- Applications: list, detail, status change (manual, audited), notes, skill corrections (`PUT /skills`), `/override`, `/reassess`, compare, questions
- Interviews: schedule (`force`), cancel (`PUT {"status":"cancelled"}`), feedback
- Notifications: list, `POST /notifications/{id}/read`
- Analytics: `/analytics/funnel`, `/analytics/skill-gaps` (both accept `?job_id=`)
- Talent (recruiter only): `GET /talent/pool?job_id=`, `POST /talent/search`, `GET /talent/duplicates`, `POST /talent/duplicates/{id}/merge|dismiss`
- Fairness: `POST /fairness/test`
The generated OpenAPI schema at `/docs` (development) is the complete reference.

## Security
- Role dependencies on every route: `require_recruiter`, `require_candidate`, `get_current_user`.
- Ownership checks in every query; other people's data returns 404, never 403.
- JWT in an HttpOnly cookie; Secure/SameSite configurable; login rate limiting.
- CORS limited to `FRONTEND_URL` with credentials; `/docs` disabled in production.
- Argon2 password hashing; input validation with Pydantic; upload size and type checks.
- Resume text, queries and API keys are never logged; secrets come only from the environment.
- Humans stay in control: AI recommends; every status change is manual and audited (who, from, to, reason, time).

## Error codes
Response shape: `{"detail": "...", "code": "...", "fields": {...}}`.
| Code | HTTP | Meaning |
|---|---|---|
| LLM_TIMEOUT | 504 | AI call timed out; retry |
| LLM_RATE_LIMITED | 429 | Groq rate limit; wait and retry |
| LLM_UNAVAILABLE | 503 | Groq unreachable |
| LLM_NOT_CONFIGURED | 503 | GROQ_API_KEY missing |
| LLM_AUTH_FAILED / LLM_ERROR / LLM_INVALID_OUTPUT | 503 / 502 / 502 | key rejected / provider error / invalid JSON twice |
| FILE_TOO_LARGE | 413 | over MAX_UPLOAD_MB |
| UNSUPPORTED_FILE_TYPE | 415 | not a supported resume type |
| EMPTY_FILE | 422 | zero bytes |
| EMBEDDING_UNAVAILABLE / EMBEDDING_PROVIDER_UNSUPPORTED / EMBEDDING_DIM_MISMATCH | 503 | embedding model problems |
| DUPLICATE_ALREADY_RESOLVED | 409 | duplicate pair already merged or dismissed |
| NOT_FOUND / VALIDATION_ERROR | 404 / 422 | missing or not yours / invalid input (`fields` lists them) |
| SCHEDULING_CONFLICT, INVALID_TRANSITION, REASON_REQUIRED, ALREADY_APPLIED, RESUME_REQUIRED | see routers | scheduling overlap (override with `force`), disallowed status change, reason missing, duplicate application, no parsed resume |
Parse problems are not errors: upload returns 200 with `parse_status` `failed` or `empty`.

## Contract deviations and extras (for the frontend teammate)
- `ApplicationOut.job_title`.
- `POST /candidate/resume/reparse`; `POST /notifications/{id}/read`; `GET` and `PUT /candidate/talent-pool-consent`.
- Fairness response has `max_abs_delta`, `tolerance` and an optional attribute `"nationality"`.
- Interviews accept `force`, can be cancelled with `PUT {"status":"cancelled"}`; `InterviewOut` has `feedback[]` and names; conflicts include `"kind"`.
- Analytics `/funnel` and `/skill-gaps` accept `?job_id=`.
- `GET /talent/pool` requires `job_id` and returns `consent_given`, `retention_expires_at`, `retention_days_left`.
- `PUT /skills`, `/override`, `/reassess` return the updated Assessment.
- Upload errors: 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_FILE_TYPE`, 422 `EMPTY_FILE`; parse problems return 200 with `parse_status` failed/empty.
- `POST /talent/search` returns the contract array and adds response headers `X-Search-Mode` (`llm+embeddings` or `embeddings-only`) and `X-Search-Fallback-Reason` (LLM error code). CORS exposes them.
- `GET /talent/duplicates` items are `{id, candidate_a:{candidate_id,name}, candidate_b:{candidate_id,name}, similarity, reasons[]}` with `candidate_a.candidate_id < candidate_b.candidate_id` (the contract did not define a/b).
- `POST /talent/duplicates/{id}/dismiss` returns `{id, status}`; `.../merge` takes `{primary_candidate_id, reason (min 5 chars)}` and returns `{moved_application_ids, skipped_application_ids}`. Merge is non-destructive: accounts and resumes stay; only this recruiter's application records move, and conflicting ones are skipped.
- Cookies: with a Next.js rewrite proxy use `COOKIE_SAMESITE=lax`; with direct cross-site calls use `none` + Secure and `credentials: "include"`.

## Known limitations
- Fairness: indirect proxies are not removed; the test cannot prove the embedding model is unbiased.
- Search: chunk embeddings are built lazily on the first search or duplicate scan, so that call is slower.
- Search without the LLM falls back to keyword terms plus embeddings (reported in `X-Search-Mode`).
- Duplicate detection scans all candidates who applied to the recruiter's jobs, regardless of talent-pool consent.
- Total years of experience can double count overlapping roles; it is only a rough score component.
- Only the fastembed embedding provider exists; the vector column is fixed at 384 dimensions.
- Login throttling is in-process memory; with several workers or instances the limits are per instance.
- Retention purge is a manual script (no scheduler); run it from a cron job or a platform scheduled task.
- Groq free-tier rate limits can slow parsing and assessments during a demo.