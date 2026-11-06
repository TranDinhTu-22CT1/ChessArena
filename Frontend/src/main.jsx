import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SystemStatePage from './components/SystemStatePage.jsx';
import './styles.css';
import './styles/profile-history.css';
import './styles/social-center.css';
import './styles/learning.css';
import './styles/puzzle-premium.css';
import './styles/leaderboard.css';
import './styles/auth.css';
import './styles/system-states.css';
import './styles/interface.css';
import './styles/play-workspace.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  retry = () => {
    this.setState({ error: null });
  };

  goHome = () => {
    window.history.pushState(null, '', '/');
    this.setState({ error: null }, () => {
      window.dispatchEvent(new window.PopStateEvent('popstate'));
    });
  };

  render() {
    if (this.state.error) {
      return (
        <SystemStatePage
          variant="runtime"
          eyebrow="ChessArena gặp sự cố"
          title="Không thể hiển thị nội dung"
          description="Một thành phần giao diện vừa gặp lỗi. Hãy thử dựng lại giao diện; dữ liệu tài khoản và các ván đã lưu vẫn được giữ nguyên."
          icon="error"
          primaryLabel="Thử hiển thị lại"
          onPrimary={this.retry}
          secondaryLabel="Về trang chủ"
          onSecondary={this.goHome}
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
