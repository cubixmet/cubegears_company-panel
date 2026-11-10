import { useContext, useEffect, useMemo, useState } from "react";
import { Bell, Boxes, Building2, Clock3, CreditCard, Plug, ShieldCheck, WalletCards } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { settingsService } from '../../services/settings.service';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import {
  SettingsEditor,
  SettingsHeader,
  SettingsSectionNav,
} from '../../components/settings';
import '../../styles/settings.css';
import '../../styles/settings-ui-polish.css';

const sections = [
  { id: 'company', label: 'Company & Locale', icon: Building2 },
  { id: 'operations', label: 'Workshop Operations', icon: Clock3 },
  { id: 'billing', label: 'Billing & Tax', icon: CreditCard },
  { id: 'inventory', label: 'Inventory Defaults', icon: Boxes },
  { id: 'attendance', label: 'Attendance Rules', icon: Clock3 },
  { id: 'payroll', label: 'Payroll', icon: WalletCards },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Roles & Security', icon: ShieldCheck },
  { id: 'integrations', label: 'Integrations', icon: Plug }
];

const SETTINGS_SECTION_PERMISSIONS = { operations: 'jobs.view', billing: 'invoices.view', inventory: 'stock.view', attendance: 'attendance.manage', payroll: 'payroll.view' };

const schemas = {
  company: [
    ['name', 'Workshop / Company Name', 'text'], ['phone', 'Phone', 'tel'], ['email', 'Official Email', 'email'], ['gstNo', 'GSTIN / Tax Number', 'text'], ['address', 'Registered Address', 'textarea'],
    ['currency', 'Currency', 'select', ['INR', 'USD', 'AED', 'SAR']], ['timezone', 'Timezone', 'select', ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'UTC']], ['dateFormat', 'Date Format', 'select', ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']]
  ],
  operations: [
    ['workingStart', 'Working Day Starts', 'time'], ['workingEnd', 'Working Day Ends', 'time'], ['bookingSlotMinutes', 'Booking Slot Minutes', 'number'], ['bookingCapacity', 'Vehicles per Slot', 'number'], ['jobPrefix', 'Job Number Prefix', 'text'], ['deliveryCreditAllowed', 'Allow Delivery With Balance', 'checkbox']
  ],
  billing: [
    ['invoicePrefix', 'Invoice Prefix', 'text'], ['defaultTaxRate', 'Default Tax %', 'number'], ['paymentTermsDays', 'Default Payment Terms (Days)', 'number'], ['rounding', 'Enable Invoice Rounding', 'checkbox']
  ],
  inventory: [
    ['defaultMinimumStock', 'Default Minimum Stock', 'number'], ['defaultReorderQty', 'Default Reorder Quantity', 'number'], ['lowStockAlerts', 'Enable Low Stock Alerts', 'checkbox'], ['negativeStock', 'Allow Negative Stock', 'checkbox']
  ],
  attendance: [
    ['graceMinutes', 'Late Grace Minutes', 'number'], ['overtimeAfterMinutes', 'Overtime After Worked Minutes', 'number'], ['locationRequired', 'Require Location for Punch', 'checkbox'], ['correctionApproval', 'Correction Requires Approval', 'checkbox']
  ],
  payroll: [
    ['payrollDay', 'Payroll Day', 'number'], ['overtimeMultiplier', 'Overtime Multiplier', 'number'], ['managerApproval', 'Manager Approval Required', 'checkbox']
  ],
  notifications: [
    ['jobCreated', 'New Vehicle / Job Card — Notify Workshop Staff', 'checkbox'],
    ['jobAssigned', 'Staff Assignment — Notify Assigned Technician', 'checkbox'],
    ['jobStatus', 'Job Status Changes — Notify Workshop Staff', 'checkbox'],
    ['jobReady', 'Ready for Delivery Alerts', 'checkbox'],
    ['lowStock', 'Low Stock Alerts', 'checkbox'],
    ['overdueInvoice', 'Overdue Invoice Alerts', 'checkbox'],
    ['leaveDecision', 'Leave Decision Alerts', 'checkbox'],
    ['email', 'Email Channel', 'checkbox'],
    ['whatsapp', 'WhatsApp Channel', 'checkbox'],
    ['browserPush', 'Browser Push', 'checkbox']
  ],
  security: [
    ['sessionHours', 'Session Lifetime (Hours)', 'number'], ['requireStrongPassword', 'Strong Password Required', 'checkbox'], ['auditExports', 'Audit Data Exports', 'checkbox'], ['twoFactor', 'Two-factor Authentication', 'checkbox']
  ],
  integrations: [
    ['razorpayEnabled', 'Razorpay Enabled', 'checkbox'], ['whatsappEnabled', 'WhatsApp Integration Enabled', 'checkbox'], ['emailEnabled', 'Email Integration Enabled', 'checkbox'], ['webhookUrl', 'Webhook URL', 'url']
  ]
};

export const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useFeatureAccess();
  const visibleSections = useMemo(() => sections.filter(section => !SETTINGS_SECTION_PERMISSIONS[section.id] || can(SETTINGS_SECTION_PERMISSIONS[section.id])), [can]);
  const [active, setActive] = useState(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    return sections.some((item) => item.id === section) ? section : 'company';
  });
  const [data, setData] = useState({});
  const [savedData, setSavedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const { themeMode, setThemeMode } = useContext(ThemeContext);

  const loadSettings = async () => {
    setLoading(true);
    setLoadError('');
    setMessage('');
    try {
      const incoming = await settingsService.getAllSettings();
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        throw new Error('Invalid settings response.');
      }
      setData(incoming);
      setSavedData(incoming);
    } catch (error) {
      setLoadError(error?.message || 'Could not load company settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    settingsService.getAllSettings()
      .then((incoming) => {
        if (!mounted) return;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
          throw new Error('Invalid settings response.');
        }
        setData(incoming);
        setSavedData(incoming);
      })
      .catch((error) => { if (mounted) setLoadError(error?.message || 'Could not load company settings.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section');
    if (visibleSections.some((item) => item.id === section)) setActive(section);
  }, [location.search, visibleSections]);

  useEffect(() => {
    if (!visibleSections.some(section => section.id === active)) setActive('company');
  }, [active, visibleSections]);

  const dirtySections = useMemo(
    () => visibleSections.filter(({ id }) => {
      const fields = schemas[id] || [];
      return fields.some(([key, , type]) =>
        (data[id]?.[key] ?? (type === 'checkbox' ? false : '')) !==
        (savedData[id]?.[key] ?? (type === 'checkbox' ? false : ''))
      );
    }).map(({ id }) => id),
    [data, savedData, visibleSections]
  );
  const dirty = dirtySections.includes(active);

  const update = (key, value) => {
    setMessage('');
    setData((prev) => ({ ...prev, [active]: { ...(prev[active] || {}), [key]: value } }));
  };

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = data[active] || {};
      const result = await settingsService.updateSettings(active, payload);
      const saved = result && typeof result === 'object' && !Array.isArray(result) ? { ...payload, ...result } : payload;
      setSavedData((prev) => ({ ...prev, [active]: saved }));
      setData((prev) => ({ ...prev, [active]: saved }));
      setMessage('Changes saved successfully.');
      setMessageType('success');
    } catch (error) {
      setMessage(error?.message || 'Unable to save settings. Please try again.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setData((prev) => ({ ...prev, [active]: { ...(savedData[active] || {}) } }));
    setMessage('Changes for this section were discarded.');
    setMessageType('info');
  };

  if (loading) return (
    <div className="settings-page" role="status" aria-live="polite">
      <div className="settings-loading">Loading company settings…</div>
    </div>
  );

  if (loadError) return (
    <div className="settings-page">
      <div className="settings-load-error" role="alert">
        <h2>Unable to load Settings</h2>
        <p>{loadError}</p>
        <button type="button" className="settings-primary-button" onClick={loadSettings}>Retry loading settings</button>
      </div>
    </div>
  );

  return (
    <div className="settings-page">
      {(can('settings.manage') || can('company.manage')) && (
        <button type="button" className="settings-primary-button"
          style={{ alignSelf: 'flex-start', minHeight: '44px', marginBottom: '12px' }}
          onClick={() => navigate('/settings/whatsapp')}>
          <Plug size={16} aria-hidden="true"/> Connect WhatsApp Business
        </button>
      )}
      <SettingsHeader
        saving={saving}
        disabled={!dirty}
        hasUnsaved={dirtySections.length > 0}
        onSave={save}
        onTemplates={() => navigate('/account/templates')}
      />

      {message && (
        <div className={`settings-message is-${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>
          {message}
        </div>
      )}

      <div className="settings-dashboard-layout">
        <SettingsSectionNav
          sections={visibleSections}
          active={active}
          dirtySections={dirtySections}
          onChange={(id) => {
            if (saving) return;
            setActive(id);
            setMessage('');
          }}
        />
        <SettingsEditor
          active={active}
          sections={visibleSections}
          schema={schemas[active] || []}
          data={data[active] || {}}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          onUpdate={update}
          onReset={reset}
          onSave={save}
          saving={saving}
          dirty={dirty}
          canManageLogo={can('company.manage')}
        />
      </div>
    </div>
  );
};

export default Settings;
