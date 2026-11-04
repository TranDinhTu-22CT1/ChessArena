const OWNED_SUPPORT_REQUEST_SELECT = [
  'id', 'user_id', 'status', 'subject', 'message', 'attachments',
  'admin_note', 'reviewed_at', 'created_at', 'updated_at'
].join(', ');

export async function findOwnedSupportRequest(supabase, userId, requestId) {
  const { data, error } = await supabase
    .from('support_requests')
    .select(OWNED_SUPPORT_REQUEST_SELECT)
    .eq('id', requestId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
