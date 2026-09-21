import { getDemoMembers, upsertDemoLog } from "../server/demo.js";
import { getSql } from "../server/db.js";
import { isValidIsoDate, todayIso } from "../server/date.js";
import { allowMethods, ApiRequest, ApiResponse, bodyObject, sendError } from "../server/http.js";

type LogRow = { id: number; member_id: number; meeting_date: string; hours: number };

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!allowMethods(req, res, ["POST"])) return;
  const payload = bodyObject(req);
  const memberId = Number(payload.memberId);
  const meetingDate = String(payload.meetingDate ?? "");
  const hours = Number(payload.hours);

  if (!Number.isInteger(memberId) || memberId < 1) {
    sendError(res, 400, "Choose a valid teammate.");
    return;
  }
  if (!isValidIsoDate(meetingDate) || meetingDate > todayIso()) {
    sendError(res, 400, "Choose today or a previous date.");
    return;
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    sendError(res, 400, "Hours must be between 0.25 and 24.");
    return;
  }

  const roundedHours = Math.round(hours * 100) / 100;

  try {
    const sql = await getSql();
    if (!sql) {
      if (!getDemoMembers().some((member) => member.id === memberId)) {
        sendError(res, 404, "That teammate is not on the roster.");
        return;
      }
      res.status(201).json({ log: upsertDemoLog(memberId, meetingDate, roundedHours), dataSource: "demo" });
      return;
    }

    const rows = (await sql`
      INSERT INTO meeting_logs (member_id, meeting_date, hours)
      VALUES (${memberId}, ${meetingDate}, ${roundedHours})
      ON CONFLICT (member_id, meeting_date)
      DO UPDATE SET hours = EXCLUDED.hours, updated_at = now()
      RETURNING id, member_id, meeting_date::text, hours::float8
    `) as LogRow[];
    res.status(201).json({ log: rows[0], dataSource: "neon" });
  } catch (error) {
    console.error("logs API error", error);
    sendError(res, 500, "We could not save that session. Check the Neon schema and try again.");
  }
}
