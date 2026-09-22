import { getDemoLogs, getDemoMembers } from "../server/demo.js";
import { getCompetitionContext, SDFTC_COMPETITION_SOURCE_URL } from "../server/competitions.js";
import { getSql } from "../server/db.js";
import { addDays, formatLabel, formatShortLabel, isValidIsoDate, startOfWeek, todayIso } from "../server/date.js";
import { allowMethods, ApiRequest, ApiResponse, queryString, sendError } from "../server/http.js";

type MemberRow = { id: number; name: string };
type LogRow = { id: number; member_id: number; meeting_date: string; hours: number };

type LeaderboardEntry = {
  id: number;
  name: string;
  visits: number;
  hours: number;
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!allowMethods(req, res, ["GET"])) return;
  const requestedDate = queryString(req, "date") || todayIso();
  if (!isValidIsoDate(requestedDate) || requestedDate > todayIso()) {
    sendError(res, 400, "Choose a valid date up to today.");
    return;
  }

  const requestedMemberId = Number(queryString(req, "memberId"));

  try {
    const sql = await getSql();
    const members = sql ? ((await sql`SELECT id, name FROM team_members ORDER BY name ASC`) as MemberRow[]) : getDemoMembers();
    const memberId = Number.isInteger(requestedMemberId) && requestedMemberId > 0 ? requestedMemberId : Number(members[0]?.id);
    const member = members.find((item) => Number(item.id) === memberId);
    if (!member) {
      sendError(res, 404, "Choose a teammate from the roster.");
      return;
    }

    const allLogs = sql
      ? ((await sql`
          SELECT id, member_id, meeting_date::text, hours::float8
          FROM meeting_logs
          ORDER BY meeting_date DESC
        `) as LogRow[])
      : members.flatMap((item) => getDemoLogs(Number(item.id)));
    const logs = allLogs.filter((log) => Number(log.member_id) === memberId);

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
    const competition = getCompetitionContext(requestedDate);
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
      leaderboards: {
        week: {
          startDate: weekStart,
          endDate: requestedDate,
          leaders: calculateLeaders(members, allLogs, weekStart, requestedDate),
        },
        sinceLastCompetition: {
          startDate: competition.sinceStartDate,
          endDate: requestedDate,
          leaders: calculateLeaders(members, allLogs, competition.sinceStartDate, requestedDate),
        },
      },
      competition: {
        sourceUrl: SDFTC_COMPETITION_SOURCE_URL,
        last: competition.last,
        next: competition.next,
      },
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

function calculateLeaders(
  members: MemberRow[],
  logs: LogRow[],
  startDate: string | null,
  endDate: string,
): LeaderboardEntry[] {
  const totals = new Map<number, { visits: number; hours: number }>();

  for (const log of logs) {
    const meetingDate = log.meeting_date;
    if (meetingDate > endDate || (startDate && meetingDate < startDate)) continue;

    const memberId = Number(log.member_id);
    const existing = totals.get(memberId) ?? { visits: 0, hours: 0 };
    existing.visits += 1;
    existing.hours = round(existing.hours + Number(log.hours));
    totals.set(memberId, existing);
  }

  const ranked = members
    .map((member) => {
      const totalsForMember = totals.get(Number(member.id)) ?? { visits: 0, hours: 0 };
      return {
        id: Number(member.id),
        name: member.name,
        visits: totalsForMember.visits,
        hours: totalsForMember.hours,
      };
    })
    .sort((a, b) => b.visits - a.visits || b.hours - a.hours || a.name.localeCompare(b.name));

  const topVisits = ranked[0]?.visits ?? 0;
  return topVisits > 0 ? ranked.filter((entry) => entry.visits === topVisits) : [];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
