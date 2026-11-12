import { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';

export function CustomerWhatsAppConsent({ customerId, canManage }) {
  const [optIn, setOptIn] = useState(false);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!canManage || !customerId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    apiClient.get(`/whatsapp/customers/${customerId}/consent`)
      .then((data) => {
        if (!alive) return;
        setOptIn(Boolean(data.optIn));
        setSource(data.source || '');
      })
      .catch((cause) => { if (alive) setError(cause?.message || 'Could not load WhatsApp consent.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId, canManage]);

  const change = async (value) => {
    if (saving) return;
    if (value && source.trim().length < 3) {
      setError('Record where and how this customer explicitly agreed before enabling WhatsApp.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiClient.post(`/whatsapp/customers/${customerId}/consent`, {
        optIn: value, source: value ? source.trim() : '',
      });
      setOptIn(value);
      setMessage(value
        ? 'Customer sharing preference saved. Messages are only prepared when a staff member explicitly shares.'
        : 'WhatsApp opt-out saved. No automatic messages are sent.');
    } catch (cause) {
      setError(cause?.message || 'Could not save WhatsApp consent.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;
  return (
    <section className="customer-tracking-panel" aria-label="Customer WhatsApp notification consent">
      <div className="customer-tracking-heading">
        <h2>WhatsApp Contact Preference</h2>
        <p>Messages are never sent automatically. Record customer permission before sharing manually.</p>
      </div>
      {loading ? <p role="status">Loading customer notification consent…</p> : <>
        <label>Consent Source / Reference
          <input
            value={source}
            maxLength={120}
            onChange={(event) => setSource(event.target.value)}
            placeholder="e.g. Signed service intake form, 04 Nov 2026"
            disabled={saving}
          />
        </label>
        <div className="customer-tracking-actions">
          <button type="button" onClick={() => change(!optIn)} disabled={saving}>
            {optIn ? 'Opt Out — Stop Notifications' : 'Record Explicit WhatsApp Opt In'}
          </button>
          <strong role="status">{optIn ? 'Consented' : 'Not Consented'}</strong>
        </div>
      </>}
      {message && <p role="status" className="customer-tracking-success">{message}</p>}
      {error && <p role="alert" className="customer-tracking-error">{error}</p>}
    </section>
  );
}
