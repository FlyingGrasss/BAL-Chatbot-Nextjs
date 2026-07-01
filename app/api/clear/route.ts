import { clearSession } from "../../../src/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  clearSession(typeof body.session_id === "string" ? body.session_id : "default");
  return Response.json({ ok: true });
}
