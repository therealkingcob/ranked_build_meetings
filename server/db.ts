type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let sqlClient: SqlClient | null = null;

export async function getSql(): Promise<SqlClient | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!sqlClient) {
    const { neon } = await import("@neondatabase/serverless");
    sqlClient = neon(connectionString) as unknown as SqlClient;
  }
  return sqlClient;
}
