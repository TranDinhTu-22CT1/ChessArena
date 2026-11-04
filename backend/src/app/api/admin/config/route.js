import { adminTestAccessStatus, requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';
import { cleanWebsiteSettings, readWebsiteSettings } from '../../../../lib/websiteSettings';
import { schemaFailure } from '../../../../lib/schemaReadiness';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-config', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'config:view');
  if (permissionError) return permissionError;
  try {
    return Response.json({ ok: true, config: await readWebsiteSettings(context.supabase), testAdmin: await adminTestAccessStatus(context.supabase) });
  } catch (error) {
    return schemaFailure(error) || Response.json({ ok: false, error: 'Không đọc được cài đặt website.' }, { status: 503 });
  }
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-config-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'config:view');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  const payload = await readJsonPayload(request);
  let settings;
  try { settings = cleanWebsiteSettings(payload?.settings); } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
  const rows = Object.entries(settings).map(([setting_key, value]) => ({ setting_key, value, updated_by: context.admin.id, updated_at: new Date().toISOString() }));
  const { error } = await context.supabase.from('website_settings').upsert(rows, { onConflict: 'setting_key' });
  if (error) return schemaFailure(error) || Response.json({ ok: false, error: 'Không lưu được cài đặt website.' }, { status: 503 });
  await writeAdminAudit(context.supabase, context.admin, 'website_settings.update', { changedKeys: Object.keys(settings) });
  return Response.json({ ok: true, config: settings });
}
