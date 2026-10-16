# Supabase (optional, experimental sync)

> **Status: experimental.** Alpha Planner is local-first. The default build never contacts a server and needs no account. The code in this folder exists for people who want to run their own backend and sync data between devices. The schema and the sync protocol may change without notice.

Sync is **off** unless the app is built with both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` set. With either of them empty the app runs entirely on-device.

## What is here

| Path | Purpose |
|------|---------|
| `migrations/0001_init.sql` | Tables, indexes, `updated_at` triggers, the profile-on-signup trigger and Row Level Security policies. |
| `migrations/0002_delete_account.sql` | `delete_account()` RPC: a signed-in user deletes their own account; all their rows cascade. |

Every table has Row Level Security enabled with an owner-only policy (`(select auth.uid()) = user_id`, or `= id` on `profiles`), so a client holding the anon/publishable key can only read and write its own rows.

## Self-hosting steps

1. **Create a Supabase project** at [supabase.com](https://supabase.com), or run one locally with `supabase start` ([Supabase CLI](https://supabase.com/docs/guides/local-development)).

2. **Apply the schema.** Either:

   - with the CLI, from the repository root:

     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```

   - or open the dashboard's **SQL Editor**, paste the contents of [`migrations/0001_init.sql`](migrations/0001_init.sql) and run it, then do the same with [`migrations/0002_delete_account.sql`](migrations/0002_delete_account.sql).

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

## How the app behaves with sync on

- Signing in is optional. The app works fully without an account; **Settings → Sync (experimental)** offers "Sign in to sync".
- Changes are queued only while someone is signed in, and each queued change belongs to that account. Signing out (or signing in with a different account) drops the queue, so one account's changes are never uploaded to another. When a different account signs in, the app asks whether to keep the data on the device.
- The sync engine is push-only for now: local changes are uploaded, remote changes are not pulled or merged yet.

## Account deletion

App stores require that users who can create an account can also delete it.

**In the app.** Signed-in users can tap **Settings → Sync → Delete account**. After a confirmation, the app calls the `delete_account()` RPC from [`0002_delete_account.sql`](migrations/0002_delete_account.sql), which deletes the caller's `auth.users` row; the profile and every synced row cascade. The app then signs out and erases its local data.

**On the web.** Google Play also asks for a way to request deletion without the app (for example after uninstalling it). If you distribute a build with sync, publish a page (and link it in your store listing) that tells users how to request deletion, for example:

> To delete your Alpha Planner account and all data synced to our server, email **privacy@your-domain.example** from the address you signed up with, with the subject "Delete my account". We delete the account within 30 days and confirm by email. Data stored only on your device is removed when you uninstall the app or use Settings → Reset All Data.

To fulfil a request, delete the user in the dashboard (**Authentication → Users → … → Delete user**) or run this in the SQL Editor:

```sql
DELETE FROM auth.users WHERE email = 'user@example.com';
```

Everything that belongs to the user cascades, as with the in-app deletion.

## Notes for operators

- If you distribute a build with sync enabled, you are running a service that stores users' data. The repository's [PRIVACY.md](../PRIVACY.md) describes only the default, local-first build; publish your own privacy policy for your deployment.
- Keep your Supabase project's Row Level Security enabled on every table you add. The sync client relies on it for isolation.
- Conflict handling is last-write-wins on `updated_at`. Treat sync as a convenience backup, not a collaboration feature.
