import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarRange, ChevronRight, Files, HardDrive, IndianRupee } from 'lucide-react';
import { storageHistoryService } from '../../services/storageHistory.service';
import { AccountHeader } from '../../components/account';
import { formatStorageBytes, formatStorageDelta, storageBytes } from '../../utils/storageUnits';

const creditAmount = (value) => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))} credits`;
const dayLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const toIso = (date) => date.toISOString().slice(0, 10);
const daysAgo = (count) => toIso(new Date(Date.now() - count * 86400000));

export function StorageHistory() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(toIso(new Date()));
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventCount, setEventCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [eventsError, setEventsError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      storageHistoryService.getStorageHistory({ from, to }),
      storageHistoryService.getStorageEvents({ from, to })
    ]).then(([history, activity]) => {
      if (!active) return;
      if (history.status === 'fulfilled') {
        setRows(Array.isArray(history.value) ? history.value : []);
        setHistoryError('');
      } else {
        setRows([]);
        setHistoryError(history.reason?.message || 'Could not load usage history.');
      }
      if (activity.status === 'fulfilled') {
        setEvents(Array.isArray(activity.value?.results) ? activity.value.results : []);
        setEventCount(activity.value?.count || 0);
        setEventsError('');
      } else {
        setEvents([]);
        setEventCount(0);
        setEventsError(activity.reason?.message || 'Could not load storage activity.');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [from, to]);

  const summary = useMemo(() => storageHistoryService.summarizeStorageHistory(rows), [rows]);

  const showAllHistory = () => {
    setFrom('');
    setTo('');
  };

  const loadMore = async () => {
    if (loadingMore || events.length >= eventCount) return;
    setLoadingMore(true);
    try {
      const more = await storageHistoryService.getStorageEvents({ from, to, offset: events.length, limit: 50 });
      setEvents((previous) => [...previous, ...(Array.isArray(more?.results) ? more.results : [])]);
      setEventCount(Number(more?.count || 0));
      setEventsError('');
    } catch (exc) {
      setEventsError(exc?.message || 'Could not load additional storage events.');
    } finally {
      setLoadingMore(false);
    }
  };

  const preset = (days) => {
    setTo(toIso(new Date()));
    setFrom(daysAgo(days - 1));
  };

  return (
    <div className="saas-page storage-history-page">
      <AccountHeader
        title="Storage History"
        subtitle="Review file uploads, deletions and daily storage usage."
        active="storage"
        onNavigate={navigate}
      />

      <section className="saas-card saas-wide storage-filter-card">
        <div className="storage-range-presets">
          <button onClick={() => preset(7)}>7 days</button>
          <button onClick={() => preset(30)}>30 days</button>
          <button onClick={() => preset(90)}>90 days</button>
          <button onClick={showAllHistory}>All recorded activity</button>
        </div>
        <div className="storage-range-inputs">
          <label><span>From</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>To</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </section>

      <div className="storage-summary-grid">
        <section className="saas-card"><CalendarRange size={20} /><span>Interval</span><strong>{summary.days} days</strong></section>
        <section className="saas-card"><HardDrive size={20} /><span>Average stored</span><strong>{formatStorageBytes(summary.averageBytes)}</strong></section>
        <section className="saas-card"><HardDrive size={20} /><span>Peak storage</span><strong>{formatStorageBytes(summary.peakBytes)}</strong></section>
        <section className="saas-card"><IndianRupee size={20} /><span>Storage charge</span><strong>{rows.some((row) => row.charge != null) ? creditAmount(summary.totalCharge) : 'Not billed'}</strong></section>
      </div>

      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><span className="saas-kicker">STORAGE ACTIVITY</span><h2>Upload and deletion log</h2></div><span>{events.length} of {eventCount} recorded events</span></div>
        {eventsError && <p className="saas-error" role="alert">{eventsError}</p>}
        {loading && <div className="saas-loading">Loading storage activity…</div>}
        <div className="storage-history-list">
          {events.map((event) => (
            <div className="storage-history-row" key={event.id}>
              <div className="storage-history-date"><strong>{event.eventType}</strong><span>{new Date(event.occurredAt).toLocaleString('en-IN')}</span></div>
              <div><span>File</span><strong>{event.filename}</strong></div>
              <div><span>Performed by</span><strong>{event.actor || 'System'}</strong></div>
              <div><span>Change</span><strong>{formatStorageDelta(event.deltaBytes)}</strong></div>
              <div><span>After event</span><strong>{formatStorageBytes(event.storageAfterBytes)}</strong></div>
            </div>
          ))}
          {!loading && !eventsError && !events.length && <p className="saas-muted">No recorded storage changes in this date range.</p>}
        </div>
        {events.length < eventCount && <button className="saas-button" type="button" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Loading…' : `Load 50 more file events (${eventCount - events.length} remaining)`}
        </button>}
      </section>

      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><span className="saas-kicker">DAILY BREAKDOWN</span><h2>{from} → {to}</h2></div><span>{rows.length} snapshots</span></div>
        {historyError && <p className="saas-error" role="alert">{historyError}</p>}
        {loading ? <div className="saas-loading">Loading usage history…</div> : historyError ? null : (
          <div className="storage-history-list">
            {rows.map((row) => (
              <button key={row.date} className="storage-history-row" onClick={() => navigate(`/account/storage/history/${row.date}`)}>
                <div className="storage-history-date"><strong>{dayLabel.format(new Date(`${row.date}T12:00:00`))}</strong><span>{row.snapshotType === 'live' ? 'Live snapshot' : row.snapshotType === 'event-ledger' ? 'Recorded change' : 'Saved snapshot'}</span></div>
                <div><span>Stored</span><strong>{formatStorageBytes(storageBytes(row))}</strong></div>
                <div><span>Files</span><strong>{row.fileCount}</strong></div>
                <div><span>Rate</span><strong>{row.rate == null ? "Not billed" : String(row.rate) + " credits / GB / billing period"}</strong></div>
                <div><span>Charge</span><strong>{row.charge == null ? "—" : creditAmount(row.charge)}</strong></div>
                <ChevronRight size={18} />
              </button>
            ))}
            {!rows.length && <p className="saas-muted">No usage snapshots in this interval.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

export function StorageDayDetail() {
  const navigate = useNavigate();
  const { date } = useParams();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storageHistoryService.getStorageDay(date).then(setSnapshot).finally(() => setLoading(false));
  }, [date]);

  if (loading) return <div className="saas-page"><div className="saas-loading">Loading snapshot…</div></div>;
  if (!snapshot) return <div className="saas-page"><div className="saas-error">Storage snapshot not found.</div></div>;

  return (
    <div className="saas-page storage-history-page">
      <header className="saas-page-head">
        <div>
          <span className="saas-kicker">DAILY STORAGE SNAPSHOT</span>
          <h1>{dayLabel.format(new Date(`${snapshot.date}T12:00:00`))}</h1>
          <p>Files and storage recorded for this billing day.</p>
        </div>
      </header>

      <div className="storage-summary-grid">
        <section className="saas-card"><HardDrive size={20} /><span>Stored</span><strong>{Number(snapshot.usedGb).toFixed(2)} GB</strong></section>
        <section className="saas-card"><Files size={20} /><span>Files</span><strong>{snapshot.fileCount}</strong></section>
        <section className="saas-card"><IndianRupee size={20} /><span>Rate</span><strong>₹{snapshot.rate}/GB/day</strong></section>
        <section className="saas-card"><IndianRupee size={20} /><span>Daily charge</span><strong>{snapshot.charge == null ? "—" : creditAmount(snapshot.charge)}</strong></section>
      </div>

      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><span className="saas-kicker">FILES IN SNAPSHOT</span><h2>Stored files</h2></div><span>{snapshot.files?.length || 0} files</span></div>
        <div className="saas-media-list">
          {(snapshot.files || []).map((file) => (
            <article className="saas-media-row" key={file.id}>
              <div className="saas-file-icon">IMG</div>
              <div className="saas-file-main"><strong>{file.name}</strong><span>{file.category} · {file.sizeMb} MB · {file.uploadedBy}</span></div>
              <span className="saas-file-date">{file.uploadedAt ? dayLabel.format(new Date(file.uploadedAt)) : '—'}</span>
            </article>
          ))}
          {!snapshot.files?.length && <p className="saas-muted">No file metadata was stored in this snapshot.</p>}
        </div>
      </section>
      {events.length < eventCount && <button className="saas-button" disabled={loadingMore} onClick={loadMore}>Load more storage events ({events.length} / {eventCount})</button>}
    </div>
  );
}
