import { safeArray } from './validation.js';

const USER_REPORT_SELECT = `
  id, reported_user_id, category, severity, description, status, evidence,
  game_id, created_at, updated_at, reviewed_at,
  reported:reported_user_id(id, username, display_name, photo_url),
  game:game_id(id, white_name, black_name, result, status, time_control, created_at)
`;

export function publicReportResult(status) {
  if (status === 'resolved') return 'Đã xử lý và áp dụng biện pháp phù hợp.';
  if (status === 'dismissed') return 'Đã đóng sau khi xem xét bằng chứng.';
  if (status === 'escalated') return 'Đã chuyển cấp để kiểm tra thêm.';
  if (status === 'in_review') return 'Đội kiểm duyệt đang xem xét.';
  return 'Đang chờ đội kiểm duyệt tiếp nhận.';
}

export function reportForReporter(report) {
  return {
    id: report.id,
    reportedUserId: report.reported_user_id,
    reported: report.reported || null,
    category: report.category,
    severity: report.severity,
    description: report.description,
    status: report.status,
    result: publicReportResult(report.status),
    evidence: report.evidence || {},
    gameId: report.game_id,
    game: report.game || null,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    reviewedAt: report.reviewed_at
  };
}

export async function listReportsForReporter(supabase, userId) {
  const { data, error } = await supabase
    .from('player_reports')
    .select(USER_REPORT_SELECT)
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return safeArray(data).map(reportForReporter);
}
