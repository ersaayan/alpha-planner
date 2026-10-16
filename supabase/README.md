# Supabase (optional, experimental sync)

> **Status: experimental.** Alpha Planner is local-first. The default build never contacts a server and needs no account. The code in this folder exists for people who want to run their own backend and sync data between devices. The schema and the sync protocol may change without notice.

Sync is **off** unless the app is built with both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` set. With either of them empty the app runs entirely on-device.

## What is here

| Path | Purpose |
|------|---------|
| `migrations/0001_init.sql` | Tables, indexes, `updated_at` triggers, the profile-on-signup trigger and Row Level Security policies. |

Every table has Row Level Security enabled with an owner-only policy (`(select auth.uid()) = user_id`, or `= id` on `profiles`), so a client holding the anon/publishable key can only read and write its own rows.

## Self-hosting steps

1. **Create a Supabase project** at [supabase.com](https://supabase.com), or run one locally with `supabase start` ([Supabase CLI](https://supabase.com/docs/guides/local-development)).

2. **Apply the schema.** Either:

   - with the CLI, from the repository root:

     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```

   - or open the dashboard's **SQL Editor**, paste the contents of [`migrations/0001_init.sql`](migrations/0001_init.sql) and run it.

   The migration enables the `moddatetime` extension in the `extensions` schema, which Supabase projects support out of the box.

3. **Enable email sign-in.** In **Authentication → Providers**, make sure the **Email** provider is enabled. Decide whether you want email confirmation on; the app signs users in with email and password.

4. **Copy your keys.** In **Project Settings → API**, copy the project URL and the **anon / publishable** key.

   > Never put the `service_role` (secret) key in the app or in `.env`. It bypasses Row Level Security and would be extractable from the app bundle.

5. **Configure the app.** From the repository root:

   ```bash
   cp .env.example .env
   ```

   Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`. These variables are inlined at build time, so restart Metro with a cleared cache (`npx expo start -c`) or rebuild the development build after changing them. For EAS builds, define the same variables in your EAS project's environment.

6. **(Optional) Clean up soft-deleted rows.** Categories, tasks and subtasks are soft-deleted (`deleted_at`). The bottom of the migration contains a commented `pg_cron` job that hard-deletes rows older than 30 days. Enable the `pg_cron` extension and uncomment it if you want that.

## Notes for operators

- If you distribute a build with sync enabled, you are running a service that stores users' data. The repository's [PRIVACY.md](../PRIVACY.md) describes only the default, local-first build; publish your own privacy policy for your deployment.
- Keep your Supabase project's Row Level Security enabled on every table you add. The sync client relies on it for isolation.
- Conflict handling is last-write-wins on `updated_at`. Treat sync as a convenience backup, not a collaboration feature.
