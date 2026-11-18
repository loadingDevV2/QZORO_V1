# Supabase setup

QZORO uses Supabase for three things:

1. **Auth** — email/password accounts created by the desk owner.
2. **Postgres** — profiles, settings, encrypted provider keys, filed reviews, and the ledger.
3. **Storage** — a private `charts` bucket for screenshots.

## 1. Create the project

Create a Supabase project, then copy the project URL and the **anon/publishable** key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
APP_ENCRYPTION_KEY=...
```

Generate the encryption key with:

```bash
openssl rand -base64 32
```

On Windows, or if `openssl` is unavailable:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Do not use the service-role key in the app. The app never needs it.

## 2. Apply the schema

Link the project and push the migration:

```bash
npx supabase login
npx supabase init          # only if supabase/config.toml does not exist yet
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste [`migrations/20261117000000_qzoro_production.sql`](./migrations/20261117000000_qzoro_production.sql) into the Supabase SQL editor.

The migration creates:

- `profiles`, `desk_settings`, `provider_keys`, `analyses`, and `trades`
- RLS policies that scope every row to `auth.uid()`
- a transactional `clear_journal()` function for the reset action
- the private `charts` Storage bucket and its owner-only policies

## 3. Create users

This app has **no public sign-up page**. Accounts are provisioned by the desk owner:

1. Open **Authentication → Users → Add user**.
2. Enter the user’s email and password.
3. Enable **Auto Confirm User** so the account can sign in immediately.
4. Share the credentials with that user through a secure channel.

Then disable public sign-ups:

- **Authentication → Sign In / Providers → Email**
- turn off **Allow new users to sign up**

That keeps the anon key from being used to create arbitrary accounts through the Supabase Auth API.

## 4. Deploy to Vercel

Add the same environment variables in **Vercel → Project → Settings → Environment Variables**:

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | anon/publishable key, not service role |
| `APP_ENCRYPTION_KEY` | Server | base64 32-byte AES key |
| `GEMINI_API_KEY` etc. | Server | optional fallback provider keys |
| `PROVIDER_TIMEOUT_MS` | Server | optional per-call timeout, default `55000` |
| `ANALYSIS_BUDGET_MS` | Server | optional total analysis budget, default `50000` |
| `DESK_TIMEZONE` | Server | optional IANA timezone, default `UTC` |

The chart upload limit is 4 MB to stay below Vercel’s 4.5 MB request-body limit. The analyze route sets `maxDuration = 60` for Vercel Hobby. Provider work is capped at `ANALYSIS_BUDGET_MS` (default 50s) so a slow first answer still leaves time to file the review, and the JSON repair pass is skipped when too little budget remains. On Pro, raise `maxDuration` to `300` and raise `ANALYSIS_BUDGET_MS` and `PROVIDER_TIMEOUT_MS` together if needed.

## Existing local data

The earlier local-first SQLite journal is **not** migrated automatically. It remains untouched on the machine that ran the local app. The Supabase deployment starts with a clean journal. Export any rows you want to keep before retiring the local workspace.
