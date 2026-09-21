export interface ApiRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(payload: unknown): void;
}

export function allowMethods(req: ApiRequest, res: ApiResponse, methods: string[]): boolean {
  const method = req.method ?? "GET";
  if (methods.includes(method)) return true;
  res.status(405).json({ error: `Method ${method} is not supported.` });
  return false;
}

export function queryString(req: ApiRequest, key: string): string {
  const value = req.query?.[key];
  if (Array.isArray(value)) return String(value[0] ?? "");
  return value === undefined || value === null ? "" : String(value);
}

export function bodyObject(req: ApiRequest): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

export function sendError(res: ApiResponse, status: number, error: string): void {
  res.status(status).json({ error });
}
