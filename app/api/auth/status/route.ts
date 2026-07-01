import { CONFIG } from "../../../../src/lib/config";
import { getIdentity, quotaSnapshot } from "../../../../src/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getIdentity(request.headers);
  if (!identity) {
    return Response.json({
      authenticated: false,
      google_configured: false,
      google_client_id: "",
      https_required: false,
    });
  }

  const usage = await quotaSnapshot(identity);
  const limits = CONFIG.limits[identity.role];
  return Response.json({
    authenticated: true,
    user: identity.public,
    role: identity.role,
    daily_used: usage.daily_used,
    minute_used: usage.minute_used,
    daily_limit: limits.daily,
    minute_limit: limits.minute,
    near_limit: usage.daily_used >= 30,
    google_configured: false,
    google_client_id: "",
    https_required: false,
  });
}
