import test from 'node:test';
import assert from 'node:assert/strict';
import { listReportsForReporter, reportForReporter } from '../src/lib/reportAccess.js';

function fakeSupabase(row, capture) {
  const query = {
    select(value) { capture.select = value; return this; },
    eq(column, value) { capture.eq = [column, value]; return this; },
    order(column, options) { capture.order = [column, options]; return this; },
    limit(value) { capture.limit = value; return Promise.resolve({ data: [row], error: null }); }
  };
  return { from(table) { capture.table = table; return query; } };
}

test('My Reports always scopes its query to the authenticated reporter', async () => {
  const capture = {};
  const row = { id: 'report-a', reporter_user_id: 'user-a', reported_user_id: 'target', status: 'pending' };
  const reports = await listReportsForReporter(fakeSupabase(row, capture), 'user-a');
  assert.deepEqual(capture.eq, ['reporter_user_id', 'user-a']);
  assert.equal(capture.table, 'player_reports');
  assert.equal(reports[0].id, 'report-a');
});

test('reporter response strips internal moderation notes and admin identity', () => {
  const visible = reportForReporter({
    id: 'report-a', reported_user_id: 'target', category: 'harassment', status: 'resolved',
    description: 'submitted evidence', evidence: { images: [] }, resolution_note: 'private admin note',
    reviewed_by: 'admin-private', created_at: '2026-09-23T00:00:00Z'
  });
  assert.equal(visible.result, 'Đã xử lý và áp dụng biện pháp phù hợp.');
  assert.equal(visible.resolution_note, undefined);
  assert.equal(visible.reviewed_by, undefined);
  assert.equal(visible.description, 'submitted evidence');
});
