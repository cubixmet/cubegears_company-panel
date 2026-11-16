import { useEffect, useState } from 'react';
import { PhoneInput } from './PhoneInput';
import {
  JOB_PHONE_COUNTRIES, joinInternationalPhone, jobPhoneHint, jobPhoneLength,
  pasteJobNationalPhone, sanitizeJobNationalPhone, splitInternationalPhone,
} from '../../utils/jobCreateAdapters';

/** Controlled E.164 phone number for customers, suppliers and Job Cards.
 * National lengths follow the currently supported calling-code selectors.
 * Use one Phone field; WhatsApp may reuse this saved number.
 */
export function CountryPhoneField({
  value = '', onChange, label = 'Phone', required = false,
  disabled = false, error = '', className = '', id, ...rest
}) {
  const [pendingCountry, setPendingCountry] = useState('+91');
  const parsed = splitInternationalPhone(value, pendingCountry);
  const { national } = parsed;
  const country = value ? parsed.country : pendingCountry;
  useEffect(() => {
    if (value && parsed.country !== pendingCountry) setPendingCountry(parsed.country);
  }, [value, parsed.country, pendingCountry]);
  const update = next => onChange(joinInternationalPhone(country, next));
  return <PhoneInput
    label={label} labelPosition="above" id={id}
    required={required} disabled={disabled} error={error}
    className={className} countries={JOB_PHONE_COUNTRIES}
    countryCode={country} value={national} maxLength={jobPhoneLength(country)}
    inputMode="numeric" autoComplete="tel-national"
    helper={jobPhoneHint(country, national)}
    placeholder={`${jobPhoneLength(country)}-digit phone number`}
    onCountryCodeChange={next => {
      setPendingCountry(next);
      // Do not shorten a phone silently when switching its country code.
      const current = national.length <= jobPhoneLength(next) ? national : '';
      onChange(joinInternationalPhone(next, current));
    }}
    onChange={event => update(sanitizeJobNationalPhone(country, event.target.value))}
    onPaste={event => {
      const pasted = event.clipboardData?.getData('text');
      if (!pasted) return;
      event.preventDefault();
      update(pasteJobNationalPhone(
        country, national, pasted,
        event.currentTarget.selectionStart, event.currentTarget.selectionEnd,
      ));
    }}
    {...rest}
  />;
}

export default CountryPhoneField;
