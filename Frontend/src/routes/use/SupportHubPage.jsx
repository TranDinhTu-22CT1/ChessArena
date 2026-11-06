import React from 'react';
import { FileWarning, LifeBuoy } from 'lucide-react';
import SupportTicketsPage from './SupportTicketsPage';
import MyReportsPanel from './MyReportsPanel';
import '../../styles/support-center.css';

function stateFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const reports = params.get('tab') === 'reports';
  return {
    tab: reports ? 'reports' : 'tickets',
    reportId: reports ? params.get('report') || '' : '',
    ticketId: reports ? '' : params.get('ticket') || '',
    focus: window.location.pathname === '/support/tickets' || params.get('view') === 'list' ? 'list' : 'create'
  };
}

export default function SupportHubPage({ authUser, onLogin, onNavigate }) {
  const [view, setView] = React.useState(stateFromLocation);

  React.useEffect(() => {
    const sync = () => setView(stateFromLocation());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const selectTab = (tab) => {
    const path = tab === 'reports' ? '/support/tickets?tab=reports' : '/support/tickets?tab=tickets';
    window.history.pushState(null, '', path);
    setView({ tab, reportId: '', ticketId: '', focus: tab === 'tickets' ? view.focus : 'create' });
  };

  return (
    <main className="support-hub">
      <header className="support-hub-hero">
        <span><LifeBuoy size={17} /> TRUNG TÂM NGƯỜI DÙNG</span>
        <h1>Ticket &amp; Báo cáo</h1>
        <p>Theo dõi yêu cầu đã gửi, trao đổi với quản trị viên và xem kết quả báo cáo người chơi.</p>
      </header>
      <nav className="support-hub-tabs" aria-label="Hỗ trợ và báo cáo">
        <button type="button" className={view.tab === 'tickets' ? 'active' : ''} aria-current={view.tab === 'tickets' ? 'page' : undefined} onClick={() => selectTab('tickets')}><LifeBuoy size={18} /> Ticket hỗ trợ</button>
        <button type="button" className={view.tab === 'reports' ? 'active' : ''} aria-current={view.tab === 'reports' ? 'page' : undefined} onClick={() => selectTab('reports')}><FileWarning size={18} /> Báo cáo người chơi</button>
      </nav>

      {view.tab === 'tickets' && <section className="support-hub-panel">
        
        <div id="support-ticket-list"><SupportTicketsPage embedded authUser={authUser} onLogin={onLogin} onNavigate={onNavigate} selectedTicketId={view.ticketId} /></div>
      </section>}
      {view.tab === 'reports' && <section className="support-hub-panel">
        <MyReportsPanel authUser={authUser} onLogin={onLogin} selectedReportId={view.reportId} />
      </section>}
    </main>
  );
}
