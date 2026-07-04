import { listSuggestions } from "../../../../src/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return Response.json({ error: "ADMIN_PASSWORD ayarlı değil." }, { status: 503 });
  }

  const providedPassword = request.headers.get("x-admin-password") || "";
  if (providedPassword !== configuredPassword) {
    return Response.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 250);
  const suggestions = await listSuggestions(limit);
  return Response.json({ suggestions });
}
