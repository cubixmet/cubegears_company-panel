/**
 * Only construct contact links from valid phone numbers.
 * Workshop default: a 10-digit mobile number without country code is Indian (+91).
 * Never construct a wa.me link from untrusted non-numeric text.
 */
export const cleanPhone = (raw) => {
  if (raw === null || raw === undefined) return '';
  const rawText = String(raw).trim();
  const cleaned = rawText.replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleaned)) return '';
  return cleaned;
};

export const customerContactLinks = (job = {}) => {
  const telephone = cleanPhone(job.customerPhone || job.customer_phone);
  // One saved customer contact is authoritative for calls and optional manual
  // WhatsApp links. Older records without a phone may still use their legacy
  // WhatsApp value; a different historical WhatsApp number never overrides
  // the current phone number.
  const whatsappRaw = telephone || cleanPhone(job.customerWhatsapp || job.customer_whatsapp);
  let whatsapp = whatsappRaw.replace(/^\+/, '');

  if (/^0\d{10}$/.test(whatsapp)) whatsapp = '91' + whatsapp.slice(1);
  else if (/^\d{10}$/.test(whatsapp)) whatsapp = '91' + whatsapp;

  // WhatsApp phone numbers require an international number with country code.
  const validWhatsApp = /^\d{11,15}$/.test(whatsapp);
  return {
    callUrl: telephone ? 'tel:' + telephone : null,
    whatsappUrl: validWhatsApp ? 'https://wa.me/' + whatsapp : null,
  };
};
