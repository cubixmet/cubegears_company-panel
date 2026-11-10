import { BellRing, CheckCheck, RefreshCw, Settings2 } from 'lucide-react';

export const NotificationsHeader = ({ unread, onMarkAll, onRefresh, onSettings, loading }) => (
  <header className="notifications-dashboard-header">
    <div className="notifications-dashboard-header-title">
      <span className="notifications-dashboard-header-icon" aria-hidden="true"><BellRing size={19}/></span>
      <div>
        <h1>Notifications</h1>
        <p>Workshop alerts, approvals, stock, payments and account updates.</p>
      </div>
    </div>
    <div className="notifications-dashboard-header-actions">
      <span className="notifications-dashboard-header-badge">{unread} unread</span>
      {onSettings && <button type="button" className="notification-refresh" onClick={onSettings}>
        <Settings2 size={15} aria-hidden="true"/> Notification Settings
      </button>}
      <button type="button" className="notification-refresh" onClick={onRefresh} disabled={loading}>
        <RefreshCw size={15} aria-hidden="true"/> Refresh
      </button>
      <button type="button" className="notification-mark-all" onClick={onMarkAll} disabled={loading || !unread}>
        <CheckCheck size={15} aria-hidden="true"/> Mark all read
      </button>
    </div>
  </header>
);
