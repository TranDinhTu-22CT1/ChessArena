function cleanText(value, fallback = '') {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 220);
}

function cleanActionUrl(value) {
  const url = String(value || '').trim();
  if (!url || !url.startsWith('/')) return null;
  return url.slice(0, 240);
}

export async function createUserNotification(supabase, {
  recipientUserId,
  audience = 'user',
  type = 'system',
  title,
  body = '',
  actionUrl = null,
  priority = 'normal',
  metadata = {}
}) {
  if (!supabase || (!recipientUserId && audience === 'user')) return null;

  const payload = {
    recipient_user_id: recipientUserId || null,
    audience: ['user', 'admin', 'system'].includes(audience) ? audience : 'user',
    type: cleanText(type, 'system').slice(0, 80),
    title: cleanText(title, 'Thông báo ChessArena'),
    body: cleanText(body),
    action_url: cleanActionUrl(actionUrl),
    priority: ['low', 'normal', 'high', 'critical'].includes(priority) ? priority : 'normal',
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  };

  const { data, error } = await supabase
    .from('user_notifications')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('Could not create notification:', error.message);
    return null;
  }
  return data;
}
