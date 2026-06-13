import React from 'react';
import SystemStatePage from '../../components/SystemStatePage';

export default function NotFoundPage({ onNavigate }) {
  return (
    <SystemStatePage
      variant="not-found"
      eyebrow="Nước đi không hợp lệ"
      code="404"
      title="Trang này nằm ngoài bàn cờ"
      description="Đường dẫn có thể đã thay đổi hoặc không còn tồn tại. Hãy quay về khu vực chính để tiếp tục thi đấu và luyện tập."
      icon="search"
      primaryLabel="Về trang chủ"
      onPrimary={() => onNavigate('home')}
      secondaryLabel="Quay lại"
      onSecondary={() => window.history.back()}
    />
  );
}
