import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, FileImage, HardDrive, IndianRupee } from 'lucide-react';
import { storageHistoryService } from '../../services/storageHistory.service';
import { AccountHeader } from '../../components/account';
import { formatStorageBytes, storageBytes, BYTES_PER_MB } from '../../utils/storageUnits';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

export function StorageDayDetails() {
  const { date: dateParam } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    storageHistoryService.getStorageDay(dateParam)
      .then(setSnapshot)
      .finally(() => setLoading(false));
  }, [dateParam]);

  return (
    <div className="saas-page storage-day-page">
      <AccountHeader
        title={snapshot ? date.format(new Date(`${snapshot.date}T00:00:00`)) : 'Storage Day Details'}
        subtitle="Files, usage and activity for the selected day."
        active="storage"
        onNavigate={navigate}
      />
      {loading ? (
        <div className="saas-loading" role="status">Loading storage snapshot…</div>
      ) : !snapshot ? (
        <div className="saas-error" role="alert">No storage snapshot found for this day.</div>
      ) : (
        <>
      <section className="storage-day-stats">
        <div className="saas-card storage-stat"><HardDrive size={20} /><span>Stored</span><strong>{formatStorageBytes(storageBytes(snapshot))}</strong></div>
        <div className="saas-card storage-stat"><IndianRupee size={20} /><span>Daily charge</span><strong>{snapshot.charge == null ? "—" : money.format(snapshot.charge)}</strong></div>
        <div className="saas-card storage-stat"><FileImage size={20} /><span>Files</span><strong>{snapshot.fileCount}</strong></div>
        <div className="saas-card storage-stat"><CalendarDays size={20} /><span>Rate</span><strong>{snapshot.rate == null ? "Not billed" : "₹" + snapshot.rate + "/GB/day"}</strong></div>
      </section>

      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><span className="saas-kicker">FILES ON THIS DAY</span><h2>{snapshot.fileCount} files</h2></div></div>
        {snapshot.files?.length ? (
          <div className="saas-media-list">
            {snapshot.files.map((file) => (
              <article className="saas-media-row storage-history-file" key={file.id}>
                <div className="saas-file-icon">IMG</div>
                <div className="saas-file-main"><strong>{file.name}</strong><span>{file.category || 'General'} · {formatStorageBytes(file.sizeBytes ?? Math.round(Number(file.sizeMb || 0) * BYTES_PER_MB))} · {file.uploadedBy || 'User'}</span></div>
                <span className="saas-file-date">{file.uploadedAt ? date.format(new Date(file.uploadedAt)) : snapshot.date}</span>
              </article>
            ))}
          </div>
        ) : <p className="saas-muted">No files were present in this snapshot.</p>}
      </section>
        </>
      )}
    </div>
  );
}
