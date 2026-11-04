import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

const STATUSES = new Set(['new', 'in_review', 'waiting_user', 'resolved', 'dismissed']);
const CATEGORIES = new Set(['account', 'billing', 'online', 'moderation', 'puzzle', 'technical', 'general']);

function cleanText(value, limit = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanStatus(value) {
  const status = cleanText(value, 40).toLowerCase();
  return STATUSES.has(status) ? status : '';
}

function cleanDate(value, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`;
}

function cleanSearch(value) {
  return cleanText(value, 100).replace(/[,%()]/g, '');
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-support', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'support:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(50, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const status = cleanStatus(searchParams.get('status'));
  const category = String(searchParams.get('category') || '').trim();
  const search = cleanSearch(searchParams.get('search'));
  const dateFrom = cleanDate(searchParams.get('dateFrom'));
  const dateTo = cleanDate(searchParams.get('dateTo'), true);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = context.supabase
    .from('support_requests')
    .select('id, user_id, category, status, subject, message, page_url, contact_email, context, attachments, admin_note, reviewed_at, created_at, updated_at, users:user_id(id, username, display_name, email, photo_url)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (CATEGORIES.has(category)) query = query.eq('category', category);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (search) {
    const { data: users = [] } = await context.supabase.from('users').select('id').or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`).limit(30);
    const userIds = (users || []).map((user) => user.id);
    const clauses = [`subject.ilike.%${search}%`, `message.ilike.%${search}%`, `contact_email.ilike.%${search}%`];
    if (/^[0-9a-f-]{36}$/i.test(search)) clauses.push(`id.eq.${search}`);
    if (userIds.length) clauses.push(`user_id.in.(${userIds.join(',')})`);
    query = query.or(clauses.join(','));
  }

  const { data, count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    requests: data || [],
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-support-write', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  const permissionError = requireAdminPermission(context, 'support:write');
  if (permissionError) return permissionError;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const requestId = cleanText(payload.requestId, 80);
  if (payload.appealDecision) {
    const manageError = requireAdminPermission(context,'users:manage');
    if(manageError)return manageError;
    if(!requestId || !['approved','rejected'].includes(payload.appealDecision) || cleanText(payload.adminNote,1800).length<5) {
      return Response.json({ok:false,error:'Hãy chọn quyết định và ghi rõ kết luận (ít nhất 5 ký tự).'},{status:400});
    }
    const {data,error}=await context.supabase.rpc('review_account_ban_appeal',{
      p_request:requestId,p_admin:context.admin.id,p_decision:payload.appealDecision,p_note:cleanText(payload.adminNote,1800)
    });
    if(error)return Response.json({ok:false,error:'Chưa lưu được quyết định xem xét. Hãy thử lại.'},{status:503});
    return Response.json({ok:true,request:data});
  }
  const status = cleanStatus(payload.status);
  if (!requestId || !status) {
    return Response.json({ ok: false, error: 'Missing request id or status.' }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc('update_support_request_status', {
    p_request: requestId,
    p_admin: context.admin?.id || null,
    p_status: status,
    p_note: cleanText(payload.adminNote, 1800) || null
  });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await writeAdminAudit(context.supabase, context.admin, 'support.update_status', {
    supportRequestId: requestId,
    status,
    targetUserId: data.user_id
  });
  return Response.json({ ok: true, request: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
