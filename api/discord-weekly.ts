import { getSql } from "../server/db.js";
import { startOfWeek, todayIsoInTimeZone } from "../server/date.js";
import { allowMethods, ApiRequest, ApiResponse, sendError } from "../server/http.js";

type AttendanceRow = {
  name: string;
  days: number;
  hours: number;
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!allowMethods(req, res, ["GET"])) return;

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers?.authorization;
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    sendError(res, 401, "Unauthorized.");
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    sendError(res, 500, "DISCORD_WEBHOOK_URL is not configured.");
    return;
  }

  const timeZone = process.env.REPORT_TIME_ZONE || "America/Los_Angeles";
  const reportDate = todayIsoInTimeZone(timeZone);
  const weekStart = startOfWeek(reportDate);

  try {
    const sql = await getSql();
    if (!sql) {
      sendError(res, 500, "DATABASE_URL is not configured.");
      return;
    }

    const rows = (await sql`
      SELECT
        team_members.name,
        COUNT(DISTINCT meeting_logs.meeting_date)::int AS days,
        COALESCE(SUM(meeting_logs.hours), 0)::float8 AS hours
      FROM team_members
      LEFT JOIN meeting_logs
        ON meeting_logs.member_id = team_members.id
        AND meeting_logs.meeting_date BETWEEN ${weekStart} AND ${reportDate}
      GROUP BY team_members.id, team_members.name
      ORDER BY days DESC, hours DESC, team_members.name ASC
    `) as AttendanceRow[];

    if (!rows.length) {
      sendError(res, 500, "No teammates are configured.");
      return;
    }

    const mostDays = Math.max(...rows.map((row) => Number(row.days)));
    const leastDays = Math.min(...rows.map((row) => Number(row.days)));
    const most = rows.filter((row) => Number(row.days) === mostDays);
    const least = rows.filter((row) => Number(row.days) === leastDays);
    const content = [
      "**FTC build attendance**",
      `Week of ${weekStart} through ${reportDate}`,
      `🏆 Most attendance: ${formatPeople(most)}`,
      `📉 Least attendance: ${formatPeople(least)}`,
    ].join("\n");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });

    if (!response.ok) {
      console.error("Discord webhook error", response.status, await response.text());
      sendError(res, 502, "Discord rejected the weekly report.");
      return;
    }

    res.status(200).json({
      ok: true,
      period: { startDate: weekStart, endDate: reportDate },
      most,
      least,
    });
  } catch (error) {
    console.error("weekly Discord report error", error);
    sendError(res, 500, "Could not create the weekly Discord report.");
  }
}

function formatPeople(rows: AttendanceRow[]): string {
  return rows
    .map((row) => `${row.name} (${formatDays(Number(row.days))}, ${formatHours(Number(row.hours))})`)
    .join(", ");
}

function formatDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, "")}h`;
}
