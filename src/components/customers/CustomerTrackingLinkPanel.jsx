import { appConfirm } from '../common/appDialogs';
import { useEffect, useState } from 'react';
import { Copy, Link2, RefreshCw, ShieldOff } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { WhatsAppManualShareButton } from '../common/WhatsAppManualShareButton';
import { USE_MOCK_API } from '../../api/apiConfig';

export function CustomerTrackingLinkPanel({ customerId, canManage = false }) {
  const [link, setLink] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!customerId) return;
    setError('');
    setLink('');
    setEnabled(false);
    setNeedsRegeneration(false);
    setLoading(true);
    try {
      if (USE_MOCK_API) throw new Error('Customer tracking links require the live Django backend.');
      const result = await apiClient.get(`/customer-portal/links/${customerId}`);
      setLink(result.url || '');
      setEnabled(Boolean(result.enabled));
    } catch (cause) {
      setNeedsRegeneration(cause?.status === 409);
      setError(cause?.message || 'Unable to load customer link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [customerId]);

  const change = async (action) => {
    if (busy || !canManage) return;
    const text = action === 'revoke'
      ? 'Revoke this customer link? Anyone with the old URL will lose access.'
      : 'Regenerate the tracking URL? The previous link will stop working.';
    if (!await appConfirm(text)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiClient.post(`/customer-portal/links/${customerId}`, { action });
      setLink(result.url || '');
      setEnabled(Boolean(result.enabled));
      setNeedsRegeneration(false);
      setNotice(action === 'revoke' ? 'Tracking URL revoked.' : 'New secure tracking URL generated.');
    } catch (cause) {
      setError(cause?.message || 'Unable to update customer tracking link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('Secure link copied.');
    } catch {
      setError('Could not copy automatically. Select and copy the URL.');
    }
  };


  return (
    <section className="customer-tracking-panel" aria-label="Secure customer tracking">
      <div className="customer-tracking-heading">
        <h2><Link2 size={18}/> Customer Tracking Portal</h2>
        <p>Private access link for this customer. Share only with the vehicle owner.</p>
      </div>
      {loading ? <p role="status">Loading secure tracking link…</p> : <>
        {enabled && link ? <>
          <label htmlFor="customer-tracking-url">Customer tracking URL</label>
          <input id="customer-tracking-url" value={link} readOnly onFocus={(e) => e.target.select()}/>
          <div className="customer-tracking-actions">
            <button type="button" onClick={copy}><Copy size={16}/> Copy Link</button>
            <WhatsAppManualShareButton targetType="customer" targetId={customerId} label="Send via WhatsApp" />
          </div>
        </> : !needsRegeneration && <p role="status">Tracking access is currently disabled.</p>}
        {canManage && <div className="customer-tracking-actions">
          {enabled && <button type="button" disabled={busy} onClick={() => change('revoke')}>
            <ShieldOff size={16}/> Revoke Link
          </button>}
          <button type="button" disabled={busy} onClick={() => change(needsRegeneration || enabled ? 'rotate' : 'enable')}>
            <RefreshCw size={16}/> {needsRegeneration ? 'Regenerate Secure Link' : enabled ? 'Regenerate Link' : 'Enable Tracking Link'}
          </button>
        </div>}
      </>}
      {notice && <p role="status" className="customer-tracking-success">{notice}</p>}
      {error && <p role="alert" className="customer-tracking-error">{error} <button type="button" onClick={load}>Retry</button></p>}
    </section>
  );
}
