import { useEffect, useState } from "react";
import { appConfirm } from '../../components/common/appDialogs';
import {
  CalendarDays,
  Clock3,
  BellRing,
  MapPin,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { AttendanceModeSelector } from '../../components/attendance-manager/AttendanceModeSelector';
import { attendanceManagerService } from '../../services/attendanceManager.service';

const defaults = {
  attendanceMode: 'single',
  startTime: '09:00',
  endTime: '18:00',
  lateGraceMinutes: 15,
  overtimeAfterMinutes: 540,
  maxSessionsPerDay: 0,
  autoCheckoutGraceMinutes: 0,
  missingPunchPolicy: 'request_correction',
  locationRequired: false,
  locationTrackingEnabled: false,
  punchLocationMode: 'anywhere',
  workshopLocationName: '',
  workshopLatitude: null,
  workshopLongitude: null,
  punchRadiusMeters: 100,
  missingPunchReminderEnabled: false,
  missingPunchReminderMinutes: 15,
  leaveRequestNotifications: true,
  overtimeRequestNotifications: true,
  correctionApproval: true,
  allowSelfApproval: false,
  weekendDays: ['Sunday'],
  alternateSaturdayEnabled: false,
  alternateSaturdayPattern: '2nd & 4th Saturday',
  weekendAttendancePolicy: 'weekly_off',
  weekendEffectiveFrom: '',
};

const normalizeRules = (data = {}) => ({
  ...defaults,
  ...data,
  startTime: String(data.startTime || defaults.startTime).slice(0, 5),
  endTime: String(data.endTime || defaults.endTime).slice(0, 5),
  weekendDays: Array.isArray(data.weekendDays) ? data.weekendDays : defaults.weekendDays,
});

export const RulesSettings = () => {
  const [initialRules, setInitialRules] = useState(null);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [holidayError, setHolidayError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [holidays, setHolidays] = useState([]);
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    name: '',
    holiday_type: 'Company',
    is_optional: false,
  });

  const loadRules = async () => {
    setLoading(true);
    setLoadError('');
    setHolidayError('');
    try {
      // Holidays are optional to the rules editor: do not block editing when
      // only the holidays API is unavailable.
      const [ruleResult, holidayResult] = await Promise.allSettled([
        attendanceManagerService.getRules(),
        attendanceManagerService.getHolidays(),
      ]);
      if (ruleResult.status === 'fulfilled' && ruleResult.value &&
          typeof ruleResult.value === 'object' && !Array.isArray(ruleResult.value)) {
        const data = normalizeRules(ruleResult.value);
        setRules(data);
        setInitialRules(data);
      } else {
        setRules(null);
        setLoadError(
          ruleResult.status === 'rejected'
            ? ruleResult.reason?.message || 'Attendance rules could not be loaded.'
            : 'The attendance rules response was invalid.',
        );
      }

      if (holidayResult.status === 'fulfilled') {
        setHolidays(Array.isArray(holidayResult.value) ? holidayResult.value : []);
      } else {
        setHolidays([]);
        setHolidayError(holidayResult.reason?.message || 'Holidays could not be loaded.');
      }
    } catch (error) {
      setRules(null);
      setLoadError(error?.message || 'Unable to load attendance rules.');
    } finally {
      setLoading(false);
    }
  };

  const retryHolidays = async () => {
    setHolidayError('');
    try {
      const rows = await attendanceManagerService.getHolidays();
      setHolidays(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setHolidayError(error?.message || 'Unable to load holidays.');
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const dirty = JSON.stringify(rules) !== JSON.stringify(initialRules);

  const change = (field, value) => {
    setRules((current) => ({ ...current, [field]: value }));
  };

  const toggleWeekend = (day) => {
    const values = new Set(rules.weekendDays || []);
    if (values.has(day)) values.delete(day);
    else values.add(day);
    change('weekendDays', Array.from(values));
  };

  const save = async () => {
    if (!dirty || saving) return;
    setMessage('');
    setMessageType('');
    setSaving(true);

    try {
      const saved = normalizeRules(await attendanceManagerService.saveRules(rules));
      setRules(saved);
      setInitialRules(saved);
      setMessageType('success');
      setMessage('Attendance rules saved.');
    } catch (error) {
      setMessageType('error');
      setMessage(error?.message || 'Unable to save attendance rules.');
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async (event) => {
    event.preventDefault();
    if (!holidayForm.date || !holidayForm.name.trim()) return;
    setHolidayError('');
    try {
      await attendanceManagerService.createHoliday({
        ...holidayForm,
        name: holidayForm.name.trim(),
      });
      setHolidayForm({
        date: '',
        name: '',
        holiday_type: 'Company',
        is_optional: false,
      });
      await retryHolidays();
    } catch (error) {
      setHolidayError(error?.message || 'Unable to create holiday.');
    }
  };

  const removeHoliday = async (id) => {
    const confirmed = await appConfirm('Delete this company holiday?', { title: 'Delete Holiday', confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    setHolidayError('');
    try {
      await attendanceManagerService.deleteHoliday(id);
      setHolidays((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setHolidayError(error?.message || 'Unable to delete holiday.');
    }
  };

  if (loading) {
    return <div className="attendance-rules-loading" role="status">Loading attendance rules…</div>;
  }
  if (!rules) {
    return (
      <section className="attendance-rules-page">
        <div className="attendance-rules-message is-error" role="alert">
          {loadError || 'Unable to load attendance rules. Check the backend connection and retry.'}
        </div>
        <button type="button" className="attendance-rules-save" onClick={loadRules}>Retry Loading Rules</button>
      </section>
    );
  }

  const autoMode = ['auto_checkout', 'hybrid'].includes(rules.attendanceMode);
  const multiMode = rules.attendanceMode === 'multi';

  return (
    <div className="attendance-rules-page">
      <header className="attendance-rules-header">
        <div>
          <h2>Attendance Rules</h2>
        </div>

        <button
          type="button"
          className="attendance-rules-save"
          disabled={!dirty || saving}
          onClick={save}
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Rules'}
        </button>
      </header>

      {message && <div className={`attendance-rules-message is-${messageType || 'error'}`} role={messageType === 'success' ? 'status' : 'alert'}>{message}</div>}
      {holidayError && (
        <div className="attendance-rules-message is-error" role="alert">
          Holiday data could not load: {holidayError}
          <button type="button" className="attendance-rules-feedback-retry" onClick={retryHolidays}>Retry Holidays</button>
        </div>
      )}

      <section className="attendance-rule-section">
        <div className="attendance-rule-title">
          <Clock3 size={16} />
          <div>
            <h3>Punch Mode</h3>
          </div>
        </div>

        <AttendanceModeSelector
          value={rules.attendanceMode}
          onChange={(value) => change('attendanceMode', value)}
        />

        {multiMode && (
          <label className="attendance-rule-field">
            <span>Maximum Sessions Per Day</span>
            <small>0 = unlimited</small>
            <input
              type="number"
              min="0"
              value={rules.maxSessionsPerDay}
              onChange={(event) => change('maxSessionsPerDay', Math.max(0, Number(event.target.value)))}
            />
          </label>
        )}
      </section>

      <div className="attendance-rules-columns">
        <section className="attendance-rule-section">
          <div className="attendance-rule-title">
            <Clock3 size={16} />
            <div>
              <h3>Shift Timing</h3>
            </div>
          </div>

          <div className="attendance-rule-form-grid">
            <label className="attendance-rule-field">
              <span>Shift Start</span>
              <input type="time" value={rules.startTime} onChange={(e) => change('startTime', e.target.value)} />
            </label>
            <label className="attendance-rule-field">
              <span>Shift End</span>
              <input type="time" value={rules.endTime} onChange={(e) => change('endTime', e.target.value)} />
            </label>
            <label className="attendance-rule-field">
              <span>Late Grace Minutes</span>
              <input type="number" min="0" value={rules.lateGraceMinutes} onChange={(e) => change('lateGraceMinutes', Number(e.target.value))} />
            </label>
            <label className="attendance-rule-field">
              <span>Overtime After Minutes</span>
              <input type="number" min="0" value={rules.overtimeAfterMinutes} onChange={(e) => change('overtimeAfterMinutes', Number(e.target.value))} />
            </label>
            {autoMode && (
              <label className="attendance-rule-field attendance-rule-field-wide">
                <span>Auto Checkout Grace (minutes)</span>
                
                <input
                  type="number"
                  min="0"
                  value={rules.autoCheckoutGraceMinutes}
                  onChange={(e) => change('autoCheckoutGraceMinutes', Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </section>

        <section className="attendance-rule-section">
          <div className="attendance-rule-title">
            <TriangleAlert size={16} />
            <div>
              <h3>Missing Punch Policy</h3>
            </div>
          </div>

          <label className="attendance-rule-field">
            <span>Policy</span>
            <select
              value={rules.missingPunchPolicy}
              onChange={(e) => change('missingPunchPolicy', e.target.value)}
            >
              <option value="request_correction">Request Punch Correction</option>
              <option value="auto_close">Auto Close at Shift End</option>
              <option value="mark_missing">Keep as Missing Clock Out</option>
            </select>
          </label>

          <label className="attendance-rule-toggle">
            <span>
              <strong>Send Missing Punch Reminder</strong>
              
            </span>
            <input
              type="checkbox"
              checked={Boolean(rules.missingPunchReminderEnabled)}
              onChange={(e) => change('missingPunchReminderEnabled', e.target.checked)}
            />
          </label>

          {rules.missingPunchReminderEnabled && (
            <label className="attendance-rule-field">
              <span>Reminder Delay (minutes)</span>
              
              <input
                type="number"
                min="0"
                value={rules.missingPunchReminderMinutes}
                onChange={(e) => change('missingPunchReminderMinutes', Math.max(0, Number(e.target.value)))}
              />
            </label>
          )}

          <label className="attendance-rule-toggle">
            <span>
              <strong>Correction Requires Approval</strong>
              
            </span>
            <input
              type="checkbox"
              checked={Boolean(rules.correctionApproval)}
              onChange={(e) => change('correctionApproval', e.target.checked)}
            />
          </label>

          <label className="attendance-rule-toggle">
            <span>
              <strong>Prevent Manager Self-Approval</strong>
              
            </span>
            <input
              type="checkbox"
              checked={!rules.allowSelfApproval}
              onChange={(e) => change('allowSelfApproval', !e.target.checked)}
            />
          </label>
        </section>

        <section className="attendance-rule-section">
          <div className="attendance-rule-title">
            <MapPin size={16} />
            <div><h3>Punch Location</h3></div>
          </div>
          <div className="attendance-punch-location-settings attendance-location-from-onboarding">
            <p className="attendance-location-owner-note">
              Punch location is taken from your saved workshop location in
              <strong> Onboarding → Main branch &amp; location</strong>.
              Latitude, longitude and radius are not entered again here.
            </p>
            {rules.punchLocationMode === 'workshop' &&
              rules.workshopLatitude != null && rules.workshopLongitude != null ? (
                <div className="attendance-location-readonly" role="status">
                  <strong>Workshop radius active</strong>
                  <span>Latitude: {rules.workshopLatitude}</span>
                  <span>Longitude: {rules.workshopLongitude}</span>
                  <span>Allowed radius: {rules.punchRadiusMeters} metres</span>
                  <small>Staff need precise device GPS within the configured radius to punch in or out.</small>
                </div>
              ) : (
                <div className="attendance-location-readonly" role="status">
                  <strong>Workshop GPS not configured</strong>
                  <small>Ask the workshop owner to capture and save the workshop location in Onboarding. Existing legacy attendance rules remain unchanged until it is saved.</small>
                </div>
              )}
            <a href="/onboarding" className="attendance-location-setup-link">
              Open Workshop Setup (owner)
            </a>
          </div>
        </section>

        <section className="attendance-rule-section">
          <div className="attendance-rule-title">
            <CalendarDays size={16} />
            <div>
              <h3>Weekly Off</h3>
            </div>
          </div>

          <div className="attendance-weekdays">
            {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day) => (
              <button
                key={day}
                type="button"
                className={(rules.weekendDays || []).includes(day) ? 'is-selected' : ''}
                onClick={() => toggleWeekend(day)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>

          <label className="attendance-rule-field">
            <span>Attendance Policy</span>
            <select value={rules.weekendAttendancePolicy} onChange={(e) => change('weekendAttendancePolicy', e.target.value)}>
              <option value="weekly_off">Block Attendance / Weekly Off</option>
              <option value="allow">Allow Attendance</option>
              <option value="allow_overtime">Allow Attendance + Overtime</option>
            </select>
          </label>

          <label className="attendance-rule-toggle">
            <span>
              <strong>Alternate Saturday</strong>
              
            </span>
            <input
              type="checkbox"
              checked={Boolean(rules.alternateSaturdayEnabled)}
              onChange={(e) => change('alternateSaturdayEnabled', e.target.checked)}
            />
          </label>

          {rules.alternateSaturdayEnabled && (
            <label className="attendance-rule-field">
              <span>Saturday Pattern</span>
              <select value={rules.alternateSaturdayPattern} onChange={(e) => change('alternateSaturdayPattern', e.target.value)}>
                <option>1st & 3rd Saturday</option>
                <option>2nd & 4th Saturday</option>
                <option>1st, 3rd & 5th Saturday</option>
                <option>All Saturdays</option>
              </select>
            </label>
          )}

          <label className="attendance-rule-field">
            <span>Effective From</span>
            <input
              type="date"
              value={rules.weekendEffectiveFrom || ''}
              onChange={(e) => change('weekendEffectiveFrom', e.target.value)}
            />
          </label>
        </section>
      </div>

      <details className="attendance-rule-section attendance-rule-disclosure">
        <summary className="attendance-rule-title">
          <BellRing size={16} />
          <div>
            <h3>Attendance Notifications</h3>
          </div>
        </summary>

        <label className="attendance-rule-toggle">
          <span>
            <strong>Leave Request Notifications</strong>
            
          </span>
          <input
            type="checkbox"
            checked={Boolean(rules.leaveRequestNotifications)}
            onChange={(e) => change('leaveRequestNotifications', e.target.checked)}
          />
        </label>

        <label className="attendance-rule-toggle">
          <span>
            <strong>Overtime Request Notifications</strong>
            
          </span>
          <input
            type="checkbox"
            checked={Boolean(rules.overtimeRequestNotifications)}
            onChange={(e) => change('overtimeRequestNotifications', e.target.checked)}
          />
        </label>
      </details>

      <section className="attendance-rule-section attendance-holiday-manager">
        <div className="attendance-rule-title">
          <CalendarDays size={16} />
          <div>
            <h3>Company Holidays</h3>
          </div>
        </div>

        <form className="attendance-holiday-form" onSubmit={addHoliday}>
          <input
            aria-label="Holiday date"
            type="date"
            value={holidayForm.date}
            onChange={(e) => setHolidayForm((old) => ({ ...old, date: e.target.value }))}
            required
          />
          <input
            aria-label="Holiday name"
            value={holidayForm.name}
            onChange={(e) => setHolidayForm((old) => ({ ...old, name: e.target.value }))}
            placeholder="Onam / Christmas / Company Holiday"
            required
          />
          <select
            aria-label="Holiday type"
            value={holidayForm.holiday_type}
            onChange={(e) => setHolidayForm((old) => ({ ...old, holiday_type: e.target.value }))}
          >
            <option value="Company">Company Holiday</option>
            <option value="Festival">Festival</option>
            <option value="Public">Public Holiday</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={holidayForm.is_optional}
              onChange={(e) => setHolidayForm((old) => ({ ...old, is_optional: e.target.checked }))}
            />
            Optional
          </label>
          <button type="submit"><Plus size={13}/>Add Holiday</button>
        </form>

        <div className="attendance-holiday-list">
          {holidays.map((holiday) => (
            <div key={holiday.id}>
              <span>
                <strong>{holiday.name}</strong>
                <small>{holiday.date} · {holiday.holiday_type || holiday.holidayType || 'Company'}</small>
              </span>
              <button type="button" onClick={() => removeHoliday(holiday.id)} aria-label="Delete holiday">
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
          {!holidays.length && <div className="attendance-holiday-empty">No company holidays added yet.</div>}
        </div>
      </section>

    </div>
  );
};
