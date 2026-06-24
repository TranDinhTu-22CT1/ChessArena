function clean(value, limit = 240) {
  return String(value || '').trim().slice(0, limit) || null;
}

export async function recordPaymentTransaction(supabase, transaction) {
  const row = {
    user_id: transaction.userId || null,
    provider: transaction.provider,
    provider_transaction_id: clean(transaction.providerTransactionId),
    provider_event_id: clean(transaction.providerEventId),
    kind: transaction.kind || 'subscription',
    status: transaction.status || 'pending',
    tier: clean(transaction.tier, 40),
    billing_cycle: clean(transaction.billingCycle, 40),
    currency: clean(transaction.currency, 12) || 'USD',
    amount: Number.isFinite(Number(transaction.amount)) ? Number(transaction.amount) : null,
    metadata: transaction.metadata && typeof transaction.metadata === 'object' ? transaction.metadata : {},
    occurred_at: transaction.occurredAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let query = supabase.from('payment_transactions').insert(row);
  if (row.provider_event_id) {
    query = supabase.from('payment_transactions').upsert(row, {
      onConflict: 'provider,provider_event_id',
      ignoreDuplicates: false
    });
  } else if (row.provider_transaction_id) {
    query = supabase.from('payment_transactions').upsert(row, {
      onConflict: 'provider,provider_transaction_id,kind',
      ignoreDuplicates: false
    });
  }

  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}
