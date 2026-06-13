import { requireOnlineUser } from '../../../../lib/online';
import { activeBanForUser, activeMuteForUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'user-moderation', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;

  const [ban, mute] = await Promise.all([
    Object.hasOwn(context, 'activeBan')
      ? context.activeBan
      : activeBanForUser(context.supabase, context.user.id),
    activeMuteForUser(context.supabase, context.user.id)
  ]);

  return Response.json({
    ok: true,
    moderation: {
      banned: Boolean(ban),
      muted: Boolean(mute),
      ban: ban ? {
        reason: ban.reason,
        banType: ban.ban_type,
        expiresAt: ban.expires_at || null
      } : null,
      mute: mute ? {
        reason: mute.reason,
        scopes: mute.scopes || [],
        expiresAt: mute.expires_at || null
      } : null
    }
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
