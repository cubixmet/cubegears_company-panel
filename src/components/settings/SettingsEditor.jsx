
import { RotateCcw, Save } from 'lucide-react';
import { SettingsCompanyLogo } from './SettingsCompanyLogo';
import GstRateDropdown from '../common/GstRateDropdown';
import { CountryPhoneField } from '../common/CountryPhoneField';

const COMPANY_INPUT_LIMITS = { name: 180, email: 254, gstNo: 15, address: 2000 };

export const SettingsEditor = ({
  active, sections, schema, data, themeMode, setThemeMode,
  onUpdate, onReset, onSave, saving, dirty, canManageLogo, fieldErrors
}) => {
  const current = sections.find((item) => item.id === active);
  const trimGstinPaste = (event) => {
    const pasted = event.clipboardData.getData('text');
    const trimmed = pasted.trim();
    if (trimmed === pasted) return;
    event.preventDefault();
    const { value, selectionStart, selectionEnd, maxLength } = event.currentTarget;
    const remaining = maxLength - value.length + selectionEnd - selectionStart;
    if (trimmed && remaining > 0) {
      onUpdate('gstNo', value.slice(0, selectionStart) + trimmed.slice(0, remaining) + value.slice(selectionEnd));
    }
  };
  return (
    <section className="settings-dashboard-card" aria-labelledby="settings-current-title">
      <header className="settings-dashboard-card-head">
        <div>
          <span>Configuration</span>
          <h2 id="settings-current-title">{current?.label}</h2>
          <p>Update the defaults used for this workshop. Changes are saved for this section only.</p>
        </div>
        {dirty && <span className="settings-section-unsaved">Not saved</span>}
      </header>
      {active === 'company' && (
        <div className="settings-theme">
          <span>
            <b>Appearance</b>
            <small>Select the display theme for this browser. Changes apply immediately.</small>
          </span>
          <select
            aria-label="Appearance"
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      )}
      {active === 'company' && <SettingsCompanyLogo canManage={canManageLogo} />}
      <div className="settings-form-grid">
        {(schema || []).map(([key, label, type, options]) => {
          const value = data?.[key] ?? (type === 'checkbox' ? false : '');
          const inputId = `settings-${active}-${key}`;
          const error = fieldErrors?.[key];
          const errorProps = {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? inputId + '-error' : undefined,
          };
          if (active === 'company' && key === 'phone') return (
            <CountryPhoneField key={key} id={inputId} name={key} label={label} value={value}
              className="settings-phone-field" disabled={saving} error={error}
              onChange={(next) => onUpdate(key, next)}/>
          );
          if (type === 'checkbox') return (
            <label className="settings-toggle" key={key} htmlFor={inputId}>
              <span>
                <b>{label}</b>
                <small>{value ? 'Enabled' : 'Disabled'}</small>
              </span>
              <input
                id={inputId}
                type="checkbox"
                checked={Boolean(value)}
                disabled={saving}
                onChange={(e) => onUpdate(key, e.target.checked)}
              />
            </label>
          );
          return (
            <label className={type === 'textarea' ? 'crud-field full' : 'crud-field'} key={key} htmlFor={inputId}>
              <span>{label}</span>
              {key === 'defaultTaxRate' ? (
                <GstRateDropdown id={inputId} value={value}
                  selectLabel="Default GST Rate (%)" disabled={saving} showTotal={false}
                  onChange={rate => onUpdate(key, rate === '' ? '' : Number(rate))}/>
              ) : type === 'select' ? (
                <select id={inputId} value={value} disabled={saving} {...errorProps} onChange={(e) => onUpdate(key, e.target.value)}>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : type === 'textarea' ? (
                <textarea id={inputId} rows={3} value={value} disabled={saving}
                  maxLength={active === 'company' ? COMPANY_INPUT_LIMITS[key] : undefined}
                  {...errorProps} onChange={(e) => onUpdate(key, e.target.value)}/>
              ) : (
                <input
                  id={inputId}
                  type={type}
                  value={value}
                  disabled={saving}
                  required={active === 'company' && key === 'name'}
                  maxLength={active === 'company' ? COMPANY_INPUT_LIMITS[key] : undefined}
                  autoCapitalize={key === 'gstNo' ? 'characters' : undefined}
                  spellCheck={key === 'gstNo' ? false : undefined}
                  onPaste={key === 'gstNo' ? trimGstinPaste : undefined}
                  {...errorProps}
                  step={type === 'number' ? 'any' : undefined}
                  onChange={(e) => onUpdate(key, type === 'number'
                    ? e.target.value === '' ? '' : Number(e.target.value)
                    : e.target.value)}
                />
              )}
              {error && <small id={inputId + '-error'} className="settings-field-error" role="alert">{error}</small>}
            </label>
          );
        })}
      </div>
      <footer className="settings-footer">
        <span className="settings-footer-hint">{dirty ? 'You have unsaved changes in this section.' : 'All changes saved for this section.'}</span>
        <div className="settings-footer-actions">
          <button type="button" className="settings-secondary-button" onClick={onReset} disabled={saving || !dirty}>
            <RotateCcw size={15} aria-hidden="true"/> Discard Changes
          </button>
          <button type="button" className="settings-primary-button" onClick={onSave} disabled={saving || !dirty}>
            <Save size={15} aria-hidden="true"/>{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </footer>
    </section>
  );
};
