# FTC Build Meetings

A small attendance tracker for FTC build teams. Teammates choose their name, save the hours they worked on a date, and see daily time, weekly totals, recent sessions, and build streaks.

The app is intentionally framework-free: HTML and CSS for the interface, TypeScript for the browser behavior and Vercel API functions, and Neon Postgres for durable data.

## Vercel + Neon setup

1. Import this folder into a Vercel project.
2. Add a Neon integration or set a Vercel environment variable named `DATABASE_URL` to the Neon connection string.
3. Open the Neon SQL Editor and run [`schema.sql`](./schema.sql) once.
4. Deploy. The Vercel build command is `npm run build`.

For local development, install dependencies, set `DATABASE_URL` in a local `.env`, then run `npm run dev` with the Vercel CLI. If `DATABASE_URL` is not present, the app uses clearly labeled demo data so the interface can still be previewed; demo entries are not durable.

## Data model

- `team_members` stores the selectable roster.
- `meeting_logs` stores one daily entry per teammate. Saving the same teammate/date again updates that day’s hours.

The dashboard treats Monday as the start of a week and uses date-only values, so hours do not shift because of server timezone differences.
