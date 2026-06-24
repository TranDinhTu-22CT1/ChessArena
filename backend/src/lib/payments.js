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

  if (!row.provider || !row.provider_transaction_id) {
    throw new Error('Missing payment transaction provider or provider_transaction_id.');
  }

  const { data, error } = await supabase
    .from('payment_transactions')
    .upsert(row, {
      onConflict: 'provider,provider_transaction_id,kind',
      ignoreDuplicates: false
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return null;
    }
    throw error;
  }

  return data;
}
