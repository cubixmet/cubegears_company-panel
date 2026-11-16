/** Job Card field adapters; preserve old backend payload shapes. */
export const JOB_COUNTRY_CODES = [
  ['+91', 'India (+91)'], ['+971', 'UAE (+971)'], ['+966', 'Saudi Arabia (+966)'],
  ['+974', 'Qatar (+974)'], ['+965', 'Kuwait (+965)'], ['+968', 'Oman (+968)'],
  ['+973', 'Bahrain (+973)'], ['+1', 'USA/Canada (+1)'], ['+44', 'UK (+44)'],
  ['+61', 'Australia (+61)'],
];

// Shared country choices for both the new job phone field and Add Customer.
// Keep the calling codes consistent with the existing E.164 adapters.
const JOB_COUNTRY_FLAGS = {
  '+91': '🇮🇳', '+971': '🇦🇪', '+966': '🇸🇦', '+974': '🇶🇦',
  '+965': '🇰🇼', '+968': '🇴🇲', '+973': '🇧🇭', '+1': '🇺🇸',
  '+44': '🇬🇧', '+61': '🇦🇺',
};
export const JOB_PHONE_COUNTRIES = JOB_COUNTRY_CODES.map(([code, label]) => ({
  code,
  label: label.replace(/\s*\(\+\d+\)$/, ''),
  flag: JOB_COUNTRY_FLAGS[code] || '🌐',
}));

// Local mobile-number lengths (without calling code). India must be exactly
// 10 digits; Gulf and other supported country codes use their national lengths.
// Keep these rules scoped to Job Card creation/customer quick-add.
export const JOB_PHONE_LENGTHS = Object.freeze({
  '+91': 10,  // India
  '+971': 9,  // UAE
  '+966': 9,  // Saudi Arabia
  '+974': 8,  // Qatar
  '+965': 8,  // Kuwait
  '+968': 8,  // Oman
  '+973': 8,  // Bahrain
  '+1': 10,   // USA / Canada
  '+44': 10,  // UK (without domestic 0)
  '+61': 9,   // Australia (without domestic 0)
});

export const jobPhoneLength = (country) => JOB_PHONE_LENGTHS[country] || 15;

export const jobPhoneHint = (country, national = '') =>
  `${String(national || '').replace(/\D/g, '').length}/${jobPhoneLength(country)} digits · ${country || '+91'}`;

const TRUNK_ZERO_COUNTRIES = new Set(['+971', '+966', '+44', '+61']);

// Keep the national number numeric, and enforce the length even on paste.
// Accept full international numbers pasted into the national-number box.
export const sanitizeJobNationalPhone = (country, raw) => {
  const code = JOB_PHONE_LENGTHS[country] ? country : '+91';
  const maxDigits = jobPhoneLength(code);
  let digits = String(raw || '').replace(/\D/g, '');
  const prefix = code.slice(1);

  if (digits.startsWith(`00${prefix}`) && digits.length > maxDigits) {
    digits = digits.slice(prefix.length + 2);
  } else if (digits.startsWith(prefix) && digits.length > maxDigits) {
    digits = digits.slice(prefix.length);
  }
  // +971 5xxxxxxxx / UAE 05xxxxxxxx, +44 7xxxxxxxxx / UK 07xxxxxxxxx,
  // etc: remove the domestic trunk zero only when the length fits exactly.
  if (TRUNK_ZERO_COUNTRIES.has(code) && digits.length === maxDigits + 1
      && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, maxDigits);
};

// Paste is handled before the browser's maxLength truncates a complete
// +country-number string. Respect cursor selection for partial pastes.
export const pasteJobNationalPhone = (country, current, pasted, start, end) => {
  const existing = String(current || '');
  const from = Math.max(0, Math.min(existing.length, Number.isInteger(start) ? start : existing.length));
  const to = Math.max(from, Math.min(existing.length, Number.isInteger(end) ? end : from));
  const combined = existing.slice(0, from) + String(pasted || '') + existing.slice(to);
  return sanitizeJobNationalPhone(country, combined);
};

export const splitInternationalPhone = (raw, fallback = '+91') => {
  const value = String(raw || '').trim().replace(/[\s().-]/g, '');
  if (!value) return { country: fallback, national: '' };
  const international = value.startsWith('00') ? '+' + value.slice(2) : value;
  if (!international.startsWith('+')) {
    return { country: fallback, national: international.replace(/\D/g, '') };
  }
  const country = JOB_COUNTRY_CODES.map(([code]) => code)
    .sort((a, b) => b.length - a.length).find((code) => international.startsWith(code));
  if (!country) return { country: fallback, national: international.replace(/\D/g, '') };
  return { country, national: international.slice(country.length).replace(/\D/g, '') };
};

export const joinInternationalPhone = (country, national) => {
  const code = JOB_COUNTRY_CODES.some(([item]) => item === country) ? country : '+91';
  const digits = String(national || '').replace(/\D/g, '');
  // Paste a whole number into the national part without repeating the prefix.
  const normalized = digits.startsWith(code.slice(1)) && digits.length > 10
    ? digits.slice(code.length - 1) : digits;
  return normalized ? code + normalized : '';
};

export const validInternationalPhone = (value) => {
  const phone = String(value || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return false;
  const country = JOB_COUNTRY_CODES.map(([code]) => code)
    .sort((a, b) => b.length - a.length)
    .find(code => phone.startsWith(code));
  if (!country) return false;
  const national = phone.slice(country.length);
  return /^\d+$/.test(national) && national.length === jobPhoneLength(country);
};

const knownMakes = ['Maruti Suzuki', 'Land Rover', 'Mercedes-Benz', 'Tata', 'Toyota', 'Hyundai',
  'Honda', 'Mahindra', 'Kia', 'Ford', 'Renault', 'Volkswagen', 'BMW', 'Audi', 'Nissan', 'Suzuki'];

export const splitVehicleMakeModel = (data) => {
  if (data?.make || data?.model) return { make: String(data.make || ''), model: String(data.model || '') };
  const combined = String(data?.makeModel || data?.vehicleInfo || '').trim();
  if (!combined) return { make: '', model: '' };
  const maker = [...knownMakes].sort((a, b) => b.length - a.length)
    .find((name) => combined.toLowerCase() === name.toLowerCase()
      || combined.toLowerCase().startsWith(name.toLowerCase() + ' '));
  if (maker) return { make: maker, model: combined.slice(maker.length).trim() };
  const [make, ...model] = combined.split(/\s+/);
  return { make: make || '', model: model.join(' ') };
};

export const newComplaint = () => ({
  id: typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `CMP-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  category: '', priority: 'Medium', description: '', inspectionNotes: '',
});

export const buildJobComplaints = (entries) => (entries || [])
  .map((entry) => ({
    id: entry.id, category: entry.category || '', priority: entry.priority || 'Medium',
    description: String(entry.description || '').trim(), wording: String(entry.description || '').trim(),
    inspectionNotes: entry.inspectionNotes || '', status: 'Open',
  })).filter((entry) => entry.description);
