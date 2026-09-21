import { addDemoMember, getDemoMembers } from "../server/demo.js";
import { getSql } from "../server/db.js";
import { allowMethods, ApiRequest, ApiResponse, bodyObject, sendError } from "../server/http.js";

type MemberRow = { id: number; name: string };

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!allowMethods(req, res, ["GET", "POST"])) return;

  try {
    const sql = await getSql();
    if (req.method === "GET") {
      if (!sql) {
        res.status(200).json({ members: getDemoMembers(), dataSource: "demo" });
        return;
      }
      const rows = (await sql`SELECT id, name FROM team_members ORDER BY name ASC`) as MemberRow[];
      res.status(200).json({ members: rows, dataSource: "neon" });
      return;
    }

    const name = String(bodyObject(req).name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) {
      sendError(res, 400, "Enter a teammate name between 2 and 80 characters.");
      return;
    }

    if (!sql) {
      res.status(201).json({ member: addDemoMember(name), dataSource: "demo" });
      return;
    }

    const inserted = (await sql`
      INSERT INTO team_members (name)
      VALUES (${name})
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    `) as MemberRow[];
    const member = inserted[0] ?? ((await sql`SELECT id, name FROM team_members WHERE name = ${name}`) as MemberRow[])[0];
    res.status(inserted.length ? 201 : 200).json({ member, dataSource: "neon" });
  } catch (error) {
    console.error("members API error", error);
    sendError(res, 500, "Neon is connected, but the database is not ready. Run schema.sql, then try again.");
  }
}
