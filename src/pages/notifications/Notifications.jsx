import { appConfirm } from '../../components/common/appDialogs';
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ExternalLink,
  Trash2,
  X
} from 'lucide-react';
import { notificationInboxService } from '../../services/notificationInbox.service';
import { normalizeNotification, unreadNotificationCount } from '../../utils/notificationInbox';
import { useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import {
  NotificationStats,
  NotificationToolbar,
  NotificationsHeader,
} from '../../components/notifications';
import '../../styles/notifications.css';

const service = notificationInboxService;
const categories = ['All', 'New Vehicles', 'Assignments', 'Job Updates', 'Customer Responses', 'Operational', 'Approvals & People', 'Finance', 'Stock', 'Website & Account'];
const priorities = ['All', 'Critical', 'High', 'Normal', 'Low'];
const iconFor = (category) => ({ Finance: '₹', Stock: 'ST', 'Approvals & People': 'HR', 'Website & Account': 'AC', 'Customer Responses': 'EST', 'New Vehicles': 'CAR', Assignments: 'JOB', 'Job Updates': 'UP' })[category] || 'OP';

const timeLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function Notifications() {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await service.list();
      const normalized = (Array.isArray(data) ? data : []).map(normalizeNotification);
      setRows(normalized);
      setSelected((old) => old
        ? normalized.find((item) => item.id === old.id) || null : null);
    } catch (e) {
      if (!silent) setError(e?.message || 'Unable to load notifications.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // A decision may arrive from a customer's separate device. Update the
    // inbox quietly without replacing the user's current category/search.
    const refreshWhenVisible = () => {
      if (!document.hidden) void load(true);
    };
    const timer = window.setInterval(refreshWhenVisible, 60000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || [row.title, row.description, row.reference, row.category]
        .some((value) => String(value || '').toLowerCase().includes(q));
      const matchesCategory = category === 'All' || row.category === category;
      const matchesPriority = priority === 'All' || row.priority === priority;
      const matchesStatus = status === 'All' || row.status === status;
      return matchesQuery && matchesCategory && matchesPriority && matchesStatus;
    });
  }, [rows, query, category, priority, status]);

  const unread = unreadNotificationCount(rows);
  const newCustomerResponses = rows.filter((row) =>
    row.isCustomerEstimateResponse && row.status === 'Unread'
  ).length;
  const high = rows.filter((row) => ['High', 'Critical'].includes(row.priority)).length;
  const today = new Date().toLocaleDateString('en-CA');
  const todayCount = rows.filter((row) => String(row.created || row.createdAt || '').slice(0, 10) === today).length;

  const updateStatus = async (row, nextStatus) => {
    setError('');
    try {
      const updatedRaw = await service.setRead(row, nextStatus === 'Read');
      const updated = normalizeNotification({
        ...row, ...updatedRaw, is_read: nextStatus === 'Read', status: nextStatus
      });
      setRows((old) => old.map((item) => item.id === row.id ? updated : item));
      setSelected((old) => old?.id === row.id ? updated : old);
    } catch (e) { setError(e?.message || 'Unable to update notification.'); }
  };

  const openNotification = (row) => {
    setSelected(row);
    if (row.status === 'Unread') void updateStatus(row, 'Read');
  };

  const markAllRead = async () => {
    const unreadRows = rows.filter((row) => row.status === 'Unread');
    if (!unreadRows.length) return;
    setError('');
    const outcomes = await Promise.allSettled(unreadRows.map((row) => service.setRead(row, true)));
    const succeeded = new Set(
      unreadRows.filter((_, index) => outcomes[index].status === 'fulfilled').map((row) => row.id)
    );
    setRows((old) => old.map((row) =>
      succeeded.has(row.id) ? normalizeNotification({ ...row, is_read: true }) : row));
    setSelected((old) => old && succeeded.has(old.id)
      ? normalizeNotification({ ...old, is_read: true }) : old);
    if (succeeded.size !== unreadRows.length) setError('Some alerts could not be marked as read. Please try again.');
  };

  const remove = async (row) => {
    if (!await appConfirm('Delete this notification?')) return;
    try {
      await service.remove(row);
      setRows((old) => old.filter((item) => item.id !== row.id));
      if (selected?.id === row.id) setSelected(null);
    } catch (e) {
      setError(e?.message || 'Unable to delete notification.');
    }
  };

  return (
    <div className="notifications-page">
      <NotificationsHeader unread={unread} onMarkAll={markAllRead} onRefresh={() => load()} loading={loading}
        onSettings={can('settings.view') ? () => navigate('/settings?section=notifications') : undefined} />

      <NotificationStats
        unread={unread}
        high={high}
        today={todayCount}
        total={rows.length}
      />

      {newCustomerResponses > 0 && (
        <div className="notification-customer-response-strip" role="status">
          <span>
            <strong>{newCustomerResponses} new customer estimate response{newCustomerResponses === 1 ? '' : 's'}</strong>
            <small>Review accepted or declined quotes and open the related Job Card.</small>
          </span>
          <button type="button" onClick={() => {
            setCategory('Customer Responses');
            setStatus('Unread');
          }}>View responses</button>
        </div>
      )}

      <NotificationToolbar
        query={query}
        onQuery={setQuery}
        category={category}
        onCategory={setCategory}
        priority={priority}
        onPriority={setPriority}
        status={status}
        onStatus={setStatus}
        categories={categories}
        priorities={priorities}
        resultCount={filtered.length}
      />

      {error && <div className="notifications-error" role="alert">{error}</div>}

      <div className="notifications-layout">
        <section className="notifications-list">
          {loading ? <div className="notifications-empty" role="status">Loading notifications…</div> : filtered.length ? filtered.map((row) => (
            <article key={row.id} className={`notification-row ${row.status === 'Unread' ? 'is-unread' : ''} ${selected?.id === row.id ? 'is-selected' : ''}`}>
              <button type="button" className="notification-row-open" onClick={() => openNotification(row)}
                aria-label={`View notification: ${row.title}`} aria-current={selected?.id === row.id ? 'true' : undefined}>
                <span className={`notification-avatar priority-${String(row.priority || 'Normal').toLowerCase()}`} aria-hidden="true">{iconFor(row.category)}</span>
                <span className="notification-copy">
                  <span className="notification-title-line">
                    <strong>{row.title}</strong>
                    {row.status === 'Unread' && <span className="unread-dot" aria-label="Unread"/>}
                  </span>
                  <span className="notification-description">{row.description || row.reference || 'System notification'}</span>
                  <span className="notification-meta">
                    <span>{row.category || 'General'}</span><span>{row.priority || 'Normal'}</span>
                    {row.reference && <span>{String(row.reference)}</span>}
                    {row.isCustomerEstimateResponse && <span>{row.customerEstimateDecision}</span>}
                  </span>
                </span>
              </button>
              <div className="notification-side">
                <time dateTime={row.created || row.createdAt}>{timeLabel(row.created || row.createdAt)}</time>
                <div className="notification-actions">
                  <button type="button" aria-label={row.status === 'Unread' ? 'Mark read' : 'Mark unread'}
                    title={row.status === 'Unread' ? 'Mark read' : 'Mark unread'}
                    onClick={() => updateStatus(row, row.status === 'Unread' ? 'Read' : 'Unread')}>
                    {row.status === 'Unread' ? <Check size={16}/> : <Bell size={16}/>}
                  </button>
                  <button type="button" className="danger" aria-label="Delete notification" title="Delete"
                    onClick={() => remove(row)}><Trash2 size={16}/></button>
                </div>
              </div>
            </article>
          )) : <div className="notifications-empty">
            <Bell size={25} aria-hidden="true"/>
            <strong>No notifications found</strong>
            <span>{rows.length ? 'Try another search or filter.' : 'New alerts will appear here.'}</span>
          </div>}
        </section>

        <aside className={`notification-detail ${selected ? 'is-open' : ''}`}>
          {selected ? (
            <>
              <div className="notification-detail-head">
                <div>
                  <span>{selected.category || 'Notification'}</span>
                  <h2>{selected.title}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close notification details"><X size={16}/></button>
              </div>

              <div className="notification-detail-body">
                <div className="notification-detail-badges">
                  <span>{selected.priority || 'Normal'} Priority</span>
                  <span>{selected.status || 'Read'}</span>
                </div>

                <p>{selected.description || 'No additional description was provided for this notification.'}</p>

                <div className="notification-detail-grid">
                  <div><span>Reference</span><strong>{selected.reference || '—'}</strong></div>
                  <div><span>Created</span><strong>{timeLabel(selected.created || selected.createdAt)}</strong></div>
                  <div><span>Category</span><strong>{selected.category || 'General'}</strong></div>
                  <div><span>Status</span><strong>{selected.status || '—'}</strong></div>
                  {selected.isCustomerEstimateResponse && <>
                    <div><span>Customer decision</span><strong>{selected.customerEstimateDecision}</strong></div>
                    <div><span>Decision receipt</span><strong>{selected.receiptId || '—'}</strong></div>
                  </>}
                </div>
              </div>

              <div className="notification-detail-actions">
                {selected.status === 'Unread' && <button type="button" onClick={() => updateStatus(selected, 'Read')}>Mark read</button>}
                {selected.status === 'Read' && <button type="button" onClick={() => updateStatus(selected, 'Unread')}>Mark unread</button>}
                {typeof selected.route === 'string' && selected.route.startsWith('/') && !selected.route.startsWith('//') && (
                  <button type="button" onClick={() => navigate(selected.route)}><ExternalLink size={14}/>{selected.isCustomerEstimateResponse ? 'Review Job Card' : 'Open related page'}</button>
                )}
                <button type="button" className="danger" onClick={() => remove(selected)}><Trash2 size={14}/>Delete</button>
              </div>
            </>
          ) : (
            <div className="notification-detail-empty">
              <ExternalLink size={22}/>
              <strong>Select a notification</strong>
              <span>Open an alert to view full details and actions.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default Notifications;
