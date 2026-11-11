import { appConfirm } from '../../components/common/appDialogs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Link2, RefreshCw, Send, ShieldCheck, Unplug, AlertTriangle } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { WhatsAppManualShareButton } from '../../components/common/WhatsAppManualShareButton';
import '../../styles/whatsapp-settings.css';

const FACEBOOK_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com']);

export function WhatsAppSettingsPage() {
  const [info, setInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [events, setEvents] = useState({});
  const [estimateReminderHours, setEstimateReminderHours] = useState(24);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState('manual');
  const [templateEvent, setTemplateEvent] = useState('job_created');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en_US');
  const [testCustomerId, setTestCustomerId] = useState('');
  const oauthCodeRef = useRef('');
  const signupInfoRef = useRef(null);
  const connectingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settings, recent] = await Promise.all([
        apiClient.get('/whatsapp/settings'),
        apiClient.get('/whatsapp/logs'),
      ]);
      setInfo(settings);
      setEvents(Object.fromEntries(
        Object.entries(settings.events || {}).filter(([key]) => key !== 'estimate_reminder_hours')
      ));
      setEstimateReminderHours(settings.events?.estimate_reminder_hours === 48 ? 48 : 24);
      setEnabled(Boolean(settings.notificationsEnabled));
      setMode(settings.messagingMode || 'manual');
      setLogs(Array.isArray(recent) ? recent : []);
    } catch (cause) {
      setError(cause?.message || 'Unable to load WhatsApp settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const completeOnboarding = useCallback(async () => {
    const code = oauthCodeRef.current;
    const session = signupInfoRef.current;
    if (!code || !session?.waba_id || !session?.phone_number_id || connectingRef.current) return;
    connectingRef.current = true;
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/whatsapp/connect', {
        code,
        wabaId: session.waba_id,
        phoneNumberId: session.phone_number_id,
      });
      oauthCodeRef.current = '';
      signupInfoRef.current = null;
      setSuccess('Workshop WhatsApp Business account connected. Enable notifications after configuring approved templates.');
      await load();
    } catch (cause) {
      setError(cause?.message || 'WhatsApp onboarding was not completed.');
    } finally {
      connectingRef.current = false;
      setBusy(false);
    }
  }, [load]);

  useEffect(() => {
    if (!info?.configured) return undefined;
    const handleMetaEvent = (event) => {
      if (!FACEBOOK_ORIGINS.has(event.origin)) return;
      let value;
      try { value = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
      catch { return; }
      if (value?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (value.event === 'FINISH' && value.data) {
        signupInfoRef.current = value.data;
        completeOnboarding();
      }
    };
    window.addEventListener('message', handleMetaEvent);
    return () => window.removeEventListener('message', handleMetaEvent);
  }, [info?.configured, info?.connected, completeOnboarding]);

  const connect = () => {
    if (!info?.configured || busy) return;
    setError('');
    setSuccess('');
    const launch = () => {
      window.FB.init({ appId: info.appId, autoLogAppEvents: false, xfbml: false, version: 'v25.0' });
      window.FB.login((result) => {
        const code = result?.authResponse?.code;
        if (!code) { setError('Meta Embedded Signup was cancelled or did not return an authorization code.'); return; }
        oauthCodeRef.current = code;
        completeOnboarding();
      }, {
        config_id: info.configId,
        response_type: 'code',
        override_default_response_type: true,
        auth_type: 'rerequest',
      });
    };
    if (window.FB) { launch(); return; }
    window.fbAsyncInit = launch;
    const existing = document.getElementById('cubegears-meta-sdk');
    if (existing) { setError('Meta SDK is still loading. Retry Connect.'); return; }
    const script = document.createElement('script');
    script.id = 'cubegears-meta-sdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.onerror = () => { setError('Meta signup could not load. Check network and popup blockers.'); };
    document.body.appendChild(script);
  };

  const action = async (fn) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try { await fn(); await load(); }
    catch (cause) { setError(cause?.message || 'WhatsApp action failed.'); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!await appConfirm('Disconnect this workshop WhatsApp Business account? Automated notifications will stop.')) return;
    action(() => apiClient.post('/whatsapp/disconnect'));
  };

  const save = () => action(async () => {
    const reminderEvents = { ...events, estimate_reminder_hours: estimateReminderHours };
    await apiClient.patch('/whatsapp/settings', {
      messagingMode: mode, notificationsEnabled: enabled, events: reminderEvents,
    });
    setSuccess(mode === 'manual' ? 'Manual mode saved. Staff will send WhatsApp drafts themselves.' : 'Automatic mode preferences saved. Sending requires a connected approved Meta account.');
  });
  const configureTemplate = () => action(async () => {
    await apiClient.post('/whatsapp/templates', {
      event: templateEvent, name: templateName.trim(), language: templateLanguage.trim(),
    });
    setSuccess('Approved Meta message template saved.');
    setTemplateName('');
  });
  const sendTest = () => action(async () => {
    const result = await apiClient.post('/whatsapp/test', { customerId: testCustomerId });
    setSuccess(result.sendingEnabled
      ? 'Test message queued for the configured Celery worker.'
      : 'Test notification recorded. Live sending is disabled on this server.');
  });

  const names = info?.eventNames || [];

  return (
    <main className="wa-settings">
      <div className="wa-header"><div>
        <Link to="/settings">Settings</Link><span> / WhatsApp Business</span>
        <h1>WhatsApp Integration</h1>
        <p>Choose Manual sharing or official automatic notifications separately for each workshop.</p>
      </div><button type="button" onClick={load} disabled={busy}><RefreshCw size={16}/> Refresh</button></div>
      {loading && <p role="status">Loading WhatsApp account details…</p>}
      {error && <div className="wa-error" role="alert"><AlertTriangle size={17}/>{error}</div>}
      {success && <div className="wa-success" role="status"><CheckCircle2 size={17}/>{success}</div>}
      {info && <>
        <section className="wa-card">
          <h2>Workshop Messaging Mode</h2>
          <div className="wa-mode-grid" role="radiogroup" aria-label="WhatsApp messaging mode">
            <label className={'wa-mode-option' + (mode === 'manual' ? ' is-selected' : '')}>
              <input type="radio" name="wa-mode" value="manual" checked={mode === 'manual'} disabled={busy}
                onChange={() => setMode('manual')} />
              <strong>Manual — No API needed</strong>
              <span>Staff opens WhatsApp with a prepared message and personally presses Send.</span>
            </label>
            <label className={'wa-mode-option' + (mode === 'automatic' ? ' is-selected' : '')}>
              <input type="radio" name="wa-mode" value="automatic" checked={mode === 'automatic'} disabled={busy}
                onChange={() => setMode('automatic')} />
              <strong>Automatic — Official Cloud API</strong>
              <span>Send approved, consent-based messages through the connected workshop account and Celery worker.</span>
            </label>
          </div>
          {mode === 'automatic' && !info.connected && (
            <p className="wa-warning" role="alert">
              Automatic mode is selected but the Cloud API is disconnected. No messages will be sent automatically.
              Use Send via WhatsApp from customer, job or invoice records until connected.
            </p>
          )}
          <button type="button" className="wa-primary" disabled={busy} onClick={save}>Save Messaging Mode</button>
        </section>
        <section className="wa-card">
          <h2><Link2 size={20}/> Business Connection</h2>
          <p><strong>Status:</strong> {info.connected ? 'Connected' : 'Not connected'}</p>
          {info.connected ? <>
            <p><strong>Business phone:</strong> {info.phone || 'Connected number'}</p>
            <p><strong>WhatsApp Business ID:</strong> {info.wabaId}</p>
            <button type="button" onClick={disconnect} disabled={busy}><Unplug size={16}/> Disconnect Account</button>
            <button type="button" onClick={connect} disabled={busy || !info.configured}>Reconnect Account</button>
          </> : <>
            <p>{info.configured
              ? 'Connect through Meta Embedded Signup v4. CubeGears never asks for your WhatsApp password.'
              : 'Meta app and Embedded Signup v4 are not configured. Add Meta credentials and encryption keys to the Django environment.'}</p>
            <button type="button" className="wa-primary" onClick={connect} disabled={busy || !info.configured}>
              Connect WhatsApp Business
            </button>
          </>}
          {mode === "automatic" && !info.sendEnabled && <p className="wa-warning"><ShieldCheck size={16}/> Automated sending is OFF until the backend Celery broker and WHATSAPP_SEND_ENABLED are configured.</p>}
        </section>

        <section className="wa-card">
          <h2>Automated Notifications {mode === "manual" && "(inactive in Manual Mode)"}</h2>
          <label className="wa-toggle"><input type="checkbox" checked={enabled} disabled={!info.connected || busy || mode !== "automatic"}
            onChange={(e) => setEnabled(e.target.checked)}/> Enable automatic notifications</label>
          <div className="wa-event-grid">{names.filter((name) => name !== 'test').map((event) => (
            <label className="wa-toggle" key={event}><input type="checkbox" checked={Boolean(events[event])}
              disabled={!info.connected || busy || mode !== "automatic"}
              onChange={(e) => setEvents((prev) => ({ ...prev, [event]:e.target.checked }))}/>
              {event.replaceAll('_', ' ')}
            </label>
          ))}</div>
          <div className="wa-reminder-settings">
            <label htmlFor="wa-estimate-reminder-hours">
              Estimate reminder interval
              <select id="wa-estimate-reminder-hours"
                value={estimateReminderHours}
                disabled={!info.connected || busy || mode !== 'automatic' || !events.estimate_reminder}
                onChange={e => setEstimateReminderHours(Number(e.target.value))}>
                <option value={24}>Every 24 hours</option>
                <option value={48}>Every 48 hours</option>
              </select>
            </label>
            <p>Only for the latest shared estimate awaiting a customer decision. Requires customer WhatsApp opt-in, an approved estimate_reminder template and the backend reminder scheduler. Stops after acceptance, rejection or withdrawal.</p>
          </div>
          <button type="button" className="wa-primary" disabled={busy} onClick={save}>Save Notification Settings</button>
          <p className="wa-info">Messages require an approved Meta template, explicit customer opt-in, and an enabled worker. New consent defaults to OFF.</p>
        </section>

        <section className="wa-card">
          <h2>Approved Meta Message Templates</h2>
          <div className="wa-fields">
            <label>Notification Type<select value={templateEvent} onChange={(e) => setTemplateEvent(e.target.value)}>{names.map((event) => <option key={event} value={event}>{event.replaceAll('_', ' ')}</option>)}</select></label>
            <label>Approved Template Name<input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. cubegears_job_update"/></label>
            <label>Language Code<input value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} placeholder="en_US or ml"/></label>
          </div>
          <p className="wa-info">Template must already be approved in this workshop's Meta WABA. The template body must include 3 parameters: vehicle, job number, tracking URL.</p>
          <button type="button" disabled={!info.connected || busy || !templateName.trim()} onClick={configureTemplate}>Verify & Save Template</button>
          {info.templates?.length ? <div className="wa-template-list">{info.templates.map((template) => (
            <p key={template.event}><b>{template.event}</b> · {template.name} ({template.language}) · {template.status}</p>
          ))}</div> : <p>No approved notification templates configured yet.</p>}
        </section>

        <section className="wa-card">
          <h2>Manual Message Preview</h2>
          <p>Preview only. Live customer links are generated securely from the selected Customer, Job or Invoice details.</p>
          <div className="wa-manual-example">
            Hello [Customer], track your vehicle service at [Workshop] using your private link: [Secure Tracking URL]
          </div>
          <p>Use <strong>Send via WhatsApp</strong> on a record to open the draft. Press Send inside WhatsApp to deliver.</p>
        </section>

        <section className="wa-card">
          <h2>Send Test Message</h2>
          <p>Only an opted-in customer with a valid number can receive a test template.</p>
          <label>Customer Record ID<input value={testCustomerId} onChange={(e) => setTestCustomerId(e.target.value)} placeholder="Customer UUID"/></label>
          <button type="button" disabled={!info.connected || mode !== "automatic" || busy || !testCustomerId} onClick={sendTest}><Send size={16}/> Send Test Template</button>
        </section>

        <section className="wa-card">
          <h2>Notification History / Failed Logs</h2>
          <div className="wa-log-table">{logs.length ? logs.map((row) => (
            <div className="wa-log" key={row.id}>
              <b>{row.event.replaceAll('_', ' ')}</b><span>{row.status}</span>
              <small>{row.phone} · {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</small>
              {row.error && <small className="wa-error-text">{row.error}</small>}
              {['failed', 'skipped'].includes(row.status) && (
                <WhatsAppManualShareButton targetType="log" targetId={row.id} label="Manual WhatsApp Share" />
              )}
            </div>
          )) : <p>No WhatsApp notifications recorded.</p>}</div>
        </section>
      </>}
    </main>
  );
}
export default WhatsAppSettingsPage;
