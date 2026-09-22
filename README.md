# FTC Build Meetings

A small attendance tracker for FTC build teams. Teammates choose their name, save the hours they worked on a date, and see daily time, weekly totals, recent sessions, and build streaks.

The app is intentionally framework-free: HTML and CSS for the interface, TypeScript for the browser behavior and Vercel API functions, and Neon Postgres for durable data.

The team leaderboard ranks attendance by logged build-session days, with hours shown as supporting context. It shows the leader for the selected week and the leader since the day after the most recent completed San Diego FTC competition. Competition dates are maintained from the [San Diego FTC season calendar](https://www.sdftc.org/2026-27season.html), including the prior regional so the first current-season meet has a useful baseline.

## Vercel + Neon setup

1. Import this folder into a Vercel project.
2. Add a Neon integration or set a Vercel environment variable named `DATABASE_URL` to the Neon connection string.
3. Deploy. The first database request creates the tables and seeds the roster from [`schema.sql`](./schema.sql).
4. The Vercel Cron route `/api/discord-weekly` runs each Saturday evening Pacific time (the cron schedule is UTC) and posts the most and least attendance to Discord.

### Discord weekly report

Create a Discord webhook for the channel that should receive the report, then add these Vercel environment variables for Production and Preview:

- `DISCORD_WEBHOOK_URL`: the Discord webhook URL.
- `CRON_SECRET`: a long random value. Vercel sends it to the cron route as a bearer token.
- `REPORT_TIME_ZONE`: optional IANA timezone; defaults to `America/Los_Angeles`.

Attendance is ranked by days logged from Monday through the report date, with total hours shown beside each name. The schedule `0 1 * * 0` is 6:00 PM Pacific during daylight time and 5:00 PM Pacific during standard time. Push a new deployment after adding the variables.

For local development, install dependencies, set `DATABASE_URL` in a local `.env`, then run `npm run dev` with the Vercel CLI. If `DATABASE_URL` is not present, the app uses clearly labeled demo data so the interface can still be previewed; demo entries are not durable.

## Data model

- `team_members` stores the selectable roster.
- `meeting_logs` stores one daily entry per teammate. Saving the same teammate/date again updates that day’s hours.

The dashboard treats Monday as the start of a week and uses date-only values, so hours do not shift because of server timezone differences.
