import test from 'node:test';
import assert from 'node:assert/strict';
import { findOwnedSupportRequest } from '../src/lib/supportAccess.js';

function supportDatabase(ticket, capture) {
  const filters = [];
  const query = {
    select(value) { capture.select = value; return this; },
    eq(column, value) { filters.push([column, value]); return this; },
    maybeSingle() {
      capture.filters = filters;
      const requestedId = filters.find(([column]) => column === 'id')?.[1];
      const requestedUser = filters.find(([column]) => column === 'user_id')?.[1];
      const owned = ticket.id === requestedId && ticket.user_id === requestedUser;
      return Promise.resolve({ data: owned ? ticket : null, error: null });
    }
  };
  return { from(table) { capture.table = table; return query; } };
}

test('support ticket detail requires both the ticket id and authenticated owner', async () => {
  const ticket = { id: 'ticket-a', user_id: 'user-a', status: 'new' };
  const ownerQuery = {};
  const otherUserQuery = {};

  assert.equal(
    await findOwnedSupportRequest(supportDatabase(ticket, ownerQuery), 'user-a', 'ticket-a'),
    ticket
  );
  assert.equal(
    await findOwnedSupportRequest(supportDatabase(ticket, otherUserQuery), 'user-b', 'ticket-a'),
    null
  );
  assert.equal(ownerQuery.table, 'support_requests');
  assert.deepEqual(ownerQuery.filters, [['id', 'ticket-a'], ['user_id', 'user-a']]);
  assert.deepEqual(otherUserQuery.filters, [['id', 'ticket-a'], ['user_id', 'user-b']]);
});
