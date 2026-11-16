import { useEffect, useId, useState } from "react";
import { Label } from './Label';
import '../../styles/phone-input-layout.css';

const DEFAULT_COUNTRIES = [
  { code: '+91', label: 'IN', flag: '🇮🇳' }, { code: '+971', label: 'AE', flag: '🇦🇪' },
  { code: '+966', label: 'SA', flag: '🇸🇦' }, { code: '+974', label: 'QA', flag: '🇶🇦' },
  { code: '+965', label: 'KW', flag: '🇰🇼' }, { code: '+968', label: 'OM', flag: '🇴🇲' },
  { code: '+973', label: 'BH', flag: '🇧🇭' }
];

export const PhoneInput = ({
  label, error, helper, success, required = false, disabled = false,
  countryCode = '+91', onCountryCodeChange, countries = DEFAULT_COUNTRIES,
  labelPosition = 'floating',
  containerStyle, className = '', id, placeholder, ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [selectedCode, setSelectedCode] = useState(countryCode);
  useEffect(() => setSelectedCode(countryCode), [countryCode]);
  const message = error || success || helper;
  const labelAbove = labelPosition === 'above';
  return (
    <div className={'ui-field form-field cubegears-field-group ' +
      (label && !labelAbove ? 'cg-floating-field cg-floating-phone ' : '') + className}
      style={containerStyle}>
      {label && labelAbove && <Label htmlFor={inputId} required={required} className="ui-phone__label">{label}</Label>}
      <div data-cg-input-shell="true"
        className={'cg-field-shell ui-input-shell ui-phone form-control' +
          (error ? ' ui-input-shell--error has-error' : '') +
          (success ? ' ui-input-shell--success' : '') +
          (disabled ? ' ui-input-shell--disabled is-disabled' : '')}>
        <select className="ui-phone__country" value={selectedCode} disabled={disabled}
          onChange={(event) => {
            setSelectedCode(event.target.value);
            onCountryCodeChange?.(event.target.value);
          }}
          aria-label="Country calling code">
          {countries.map((country) =>
            <option key={country.code} value={country.code} title={country.label}>
              {country.flag} {country.code}
            </option>)}
        </select>
        {label && !labelAbove && <Label htmlFor={inputId} required={required} className="cg-floating-label">{label}</Label>}
        <input id={inputId} className="cg-floating-control ui-input"
          type="tel" inputMode="tel" autoComplete="tel-national"
          required={required} disabled={disabled} aria-invalid={Boolean(error)}
          aria-describedby={message ? inputId + '-message' : undefined}
          placeholder={label && !labelAbove ? (placeholder || ' ') : placeholder} {...props} />
      </div>
      {message && <span id={inputId + '-message'}
        className={'ui-field__message' +
          (error ? ' ui-field__message--error' : success ? ' ui-field__message--success' : '')}>
        {message}
      </span>}
    </div>
  );
};
