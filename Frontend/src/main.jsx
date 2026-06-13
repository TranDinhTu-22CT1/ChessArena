import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SystemStatePage from './components/SystemStatePage.jsx';
import './styles.css';
import './styles/profile-history.css';
import './styles/social-center.css';
import './styles/learning-tournaments.css';
import './styles/puzzle-premium.css';
import './styles/leaderboard.css';
import './styles/auth.css';
import './styles/system-states.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <SystemStatePage
          variant="runtime"
          eyebrow="ChessArena gặp sự cố"
          title="Không thể hiển thị nội dung"
          description="Một thành phần giao diện vừa gặp lỗi. Bạn có thể tải lại trang; dữ liệu tài khoản và các ván đã lưu không bị ảnh hưởng."
          icon="error"
          primaryLabel="Tải lại trang"
          onPrimary={() => window.location.reload()}
          secondaryLabel="Về trang chủ"
          onSecondary={() => window.location.assign('/')}
        />
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
