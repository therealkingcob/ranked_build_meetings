type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let sqlClient: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;

export async function getSql(): Promise<SqlClient | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!sqlClient) {
    const { neon } = await import("@neondatabase/serverless");
    sqlClient = neon(connectionString) as unknown as SqlClient;
  }

  await ensureSchema(sqlClient);
  return sqlClient;
}

function ensureSchema(sql: SqlClient): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS team_members (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name varchar(80) NOT NULL UNIQUE,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS meeting_logs (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          member_id integer NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
          meeting_date date NOT NULL,
          hours numeric(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (member_id, meeting_date)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS meeting_logs_member_date_idx
          ON meeting_logs (member_id, meeting_date DESC)
      `;
      await sql`
        DELETE FROM team_members AS old_member
        WHERE old_member.name NOT IN ('Rishi', 'Claire', 'Howell', 'Cyrus', 'Lino', 'Shaan', 'Tristan', 'Lylia')
          AND NOT EXISTS (
            SELECT 1
            FROM meeting_logs
            WHERE meeting_logs.member_id = old_member.id
          )
      `;
      await sql`
        INSERT INTO team_members (name)
        VALUES ('Rishi'), ('Claire'), ('Howell'), ('Cyrus'), ('Lino'), ('Shaan'), ('Tristan'), ('Lylia')
        ON CONFLICT (name) DO NOTHING
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
