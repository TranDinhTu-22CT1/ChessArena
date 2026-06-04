import { adminTestAccessStatus, requireAdminPermission, requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-config', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'config:view');
  if (permissionError) return permissionError;
  const testAdmin = await adminTestAccessStatus(context.supabase);

  return Response.json({
    ok: true,
    config: {
      environment: process.env.NODE_ENV || 'development',
      paypalEnv: process.env.PAYPAL_ENV || 'sandbox',
      paypalWebhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      frontendUrl: process.env.FRONTEND_URL || null,
      cookieSecure: process.env.COOKIE_SECURE === 'true',
      firebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL),
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      testAccountsEnabled: testAdmin.enabled,
      adminSessionTtlSeconds: 3600,
      rateLimit: 'in-memory per deployment instance',
      realtimeTables: ['online_games', 'online_game_moves']
    },
    testAdmin
  });
}
