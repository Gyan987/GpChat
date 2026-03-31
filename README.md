# GpChat

GpChat is a Supabase-powered realtime chat app with:
- Email/password authentication
- Realtime messaging
- Room switching (Global, Dev, Random)
- Message edit and delete (own messages)
- Typing indicators
- Search and mine-only filters
- Pinned messages per room
- Theme and sound preferences

## 1) Database setup

1. Open Supabase SQL editor.
2. Run `supabase_setup.sql`.
3. Ensure Realtime is enabled for `public.messages`.

## 2) Auth setup

1. In Supabase Authentication settings, enable Email sign-in.
2. Optionally disable email confirmation for faster local testing.

## 3) Run locally

Open `login.html` in a browser via a local static server.

Example with VS Code Live Server or any static file server:
- root folder: project folder containing `login.html`

## 4) App behavior notes

- If your table does not include advanced columns (`room`, `updated_at`, `is_deleted`), the app falls back to compatibility mode.
- Full features require the schema from `supabase_setup.sql`.
- Slash commands: `/clear`, `/theme`, `/shrug`, `/me text`, `/room global|dev|random`.
