export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-file-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, { ...init, headers: { ...CORS, ...(init?.headers ?? {}) } });
}
