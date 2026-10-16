# Security Policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions or pull requests.

Report them privately with GitHub Security Advisories:

1. Go to the [Security tab](https://github.com/ersaayan/alpha-planner/security) of this repository.
2. Choose **Report a vulnerability**, or open [a new private advisory](https://github.com/ersaayan/alpha-planner/security/advisories/new) directly.
3. Describe the issue, the affected version or commit, and steps to reproduce it. Proof-of-concept code is welcome. Please do not include other people's personal data.

This is a hobby-scale, volunteer-maintained project, so we cannot promise a fixed timeline. We aim to acknowledge reports within about a week and will keep you updated as we investigate. We are happy to credit you in the advisory once a fix is released, unless you prefer to stay anonymous.

## Supported versions

Security fixes are made against the latest release and the `master` branch. Older versions are not patched.

## Scope

In scope:

- the app's source code in this repository;
- the optional Supabase schema and Row Level Security policies in [`supabase/`](supabase/);
- secrets or credentials accidentally committed to the repository or its history.

Out of scope:

- vulnerabilities in third-party dependencies that have no impact on Alpha Planner (please report those upstream; Dependabot tracks the ones that do);
- Supabase projects or other backends that someone else deployed with their own configuration;
- issues that require a rooted or jailbroken device, or physical access to an unlocked device.

## Notes for people running sync

Alpha Planner is local-first and the default build does not talk to any server. If you enable the optional, experimental Supabase sync:

- only the anon / publishable key belongs in `.env`; never ship a `service_role` key in the app;
- keep Row Level Security enabled on every table, as the migration does;
- treat the schema and sync protocol as experimental.

If you find a committed secret, report it privately as described above so it can be rotated before it is discussed publicly.
