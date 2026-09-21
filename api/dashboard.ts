import { getDemoLogs, getDemoMembers } from "../server/demo.js";
import { getSql } from "../server/db.js";
import { addDays, formatLabel, formatShortLabel, isValidIsoDate, startOfWeek, todayIso } from "../server/date.js";
import { allowMethods, ApiRequest, ApiResponse, queryString, sendError } from "../server/http.js";

type MemberRow = { id: number; name: string };
type LogRow = { id: number; meeting_date: string; hours: number };

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!allowMethods(req, res, ["GET"])) return;
  const requestedDate = queryString(req, "date") || todayIso();
  if (!isValidIsoDate(requestedDate) || requestedDate > todayIso()) {
    sendError(res, 400, "Choose a valid date up to today.");
    return;
  }

  const requestedMemberId = Number(queryString(req, "memberId"));
  const sql = await getSql();

  try {
    const members = sql ? ((await sql`SELECT id, name FROM team_members ORDER BY name ASC`) as MemberRow[]) : getDemoMembers();
    const memberId = Number.isInteger(requestedMemberId) && requestedMemberId > 0 ? requestedMemberId : Number(members[0]?.id);
    const member = members.find((item) => Number(item.id) === memberId);
    if (!member) {
      sendError(res, 404, "Choose a teammate from the roster.");
      return;
    }

    const logs = sql
      ? ((await sql`
          SELECT id, meeting_date::text, hours::float8
          FROM meeting_logs
          WHERE member_id = ${memberId}
          ORDER BY meeting_date DESC
        `) as LogRow[])
      : getDemoLogs(memberId);

    const hoursByDate = new Map<string, number>();
    for (const log of logs) {
      hoursByDate.set(log.meeting_date, round((hoursByDate.get(log.meeting_date) ?? 0) + Number(log.hours)));
    }

    const weekStart = startOfWeek(requestedDate);
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(requestedDate, index - 6);
      return {
        date,
        label: formatLabel(date),
        hours: hoursByDate.get(date) ?? 0,
        isToday: date === requestedDate,
      };
    });

    const weekly = Array.from({ length: 8 }, (_, index) => {
      const startDate = addDays(weekStart, -7 * (7 - index));
      const naturalEndDate = addDays(startDate, 6);
      const endDate = naturalEndDate > requestedDate ? requestedDate : naturalEndDate;
      return {
        startDate,
        endDate,
        label: formatShortLabel(startDate),
        hours: sumHours(hoursByDate, startDate, endDate),
        isCurrent: startDate === weekStart,
      };
    });

    const currentWeekHours = sumHours(hoursByDate, weekStart, requestedDate);
    const currentStreak = calculateCurrentStreak(hoursByDate, requestedDate);
    const bestStreak = calculateBestStreak(hoursByDate);
    const recent = logs.slice(0, 8).map((log) => ({
      id: Number(log.id),
      meetingDate: log.meeting_date,
      hours: round(Number(log.hours)),
    }));

    res.status(200).json({
      member: { id: Number(member.id), name: member.name },
      today: { date: requestedDate, hours: hoursByDate.get(requestedDate) ?? 0 },
      week: { startDate: weekStart, endDate: requestedDate, hours: currentWeekHours },
      streaks: { current: currentStreak, best: bestStreak },
      daily,
      weekly,
      recent,
      dataSource: sql ? "neon" : "demo",
    });
  } catch (error) {
    console.error("dashboard API error", error);
    sendError(res, 500, "Neon is connected, but the database is not ready. Run schema.sql, then try again.");
  }
}

function sumHours(hoursByDate: Map<string, number>, startDate: string, endDate: string): number {
  let total = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    total += hoursByDate.get(cursor) ?? 0;
    cursor = addDays(cursor, 1);
  }
  return round(total);
}

function calculateCurrentStreak(hoursByDate: Map<string, number>, requestedDate: string): number {
  let cursor = hoursByDate.has(requestedDate) ? requestedDate : addDays(requestedDate, -1);
  let streak = 0;
  while ((hoursByDate.get(cursor) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function calculateBestStreak(hoursByDate: Map<string, number>): number {
  const activeDates = [...hoursByDate.entries()]
    .filter(([, hours]) => hours > 0)
    .map(([date]) => date)
    .sort();
  let best = 0;
  let current = 0;
  let previous = "";
  for (const date of activeDates) {
    if (previous && addDays(previous, 1) === date) current += 1;
    else current = 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
