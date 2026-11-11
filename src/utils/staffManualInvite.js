/**
 * One-use staff setup URLs are bearer credentials. Never persist them in
 * sessionStorage, localStorage, route query params or app-wide state.
 * Share only on an explicit authorized administrator gesture.
 */
export const buildStaffWhatsAppUrl = ({ phone, workshopName, staffName, setupLink, purpose = 'setup' }) => {
  const raw = String(phone || '').trim();
  const compact = raw.replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
    throw new Error('A valid international staff mobile number is required.');
  }
  let link;
  try {
    link = new URL(String(setupLink || ''));
  } catch {
    throw new Error('A valid password setup link is not available.');
  }
  if (!['https:', 'http:'].includes(link.protocol)
      || (link.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(link.hostname))
      || !/^\/set-password\/[^/]+$/.test(link.pathname)) {
    throw new Error('A secure password setup link is required.');
  }
  const resetting = purpose === 'reset';
  const message = [
    resetting ? 'cubixgear · Staff Password Reset' : 'Welcome to cubixgear!',
    '',
    resetting
      ? 'Your workshop administrator has prepared a password reset link.'
      : 'Your workshop administrator has prepared your account setup link.',
    '',
    `Workshop: ${String(workshopName || 'Your workshop').trim()}`,
    `Name: ${String(staffName || 'Staff member').trim()}`,
    `Login Mobile: ${compact}`,
    '',
    resetting ? 'Reset your password using this secure link:' : 'Set your password using this secure link:',
    link.toString(),
    '',
    'This link is valid for up to 24 hours and works only once.',
    'Do not forward the link. If you did not request it, contact your workshop administrator.',
  ].join('\n');
  return `https://wa.me/${compact.slice(1)}?text=${encodeURIComponent(message)}`;
};

/**
 * Preopen a tab in the actual click event before awaiting the backend; this
 * avoids popup blocking. Returns the invitation metadata, not the raw URL.
 * Opening WhatsApp is NOT a delivery confirmation.
 */
export const shareManualStaffInvite = async (getInvitation, details) => {
  const popup = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
  try {
    const invitation = await getInvitation();
    // Cloud API delivery is automatic: never open a redundant manual URL.
    // Django owns the one-use invitation and its provider delivery state.
    const status = invitation?.whatsappInviteStatus;
    if (['queued', 'sending', 'sent'].includes(status)) {
      if (popup && !popup.closed) popup.close();
      return { status, expiresAt: invitation.expiresAt, localOnlyLink: false };
    }
    if (!invitation || status !== 'manual') {
      throw new Error('WhatsApp reset is not ready. Check staff role and consent.');
    }
    const url = buildStaffWhatsAppUrl({ ...details, setupLink: invitation.setupLink, purpose: invitation.purpose });
    // A localhost setup URL works on the developer's PC but cannot be opened
    // by a staff member on another device. Surface this configuration issue.
    const setupHost = new URL(invitation.setupLink).hostname.toLowerCase();
    const localOnlyLink = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(setupHost);
    if (popup && !popup.closed) {
      popup.opener = null;
      popup.location.replace(url);
    } else if (typeof window !== 'undefined') {
      window.location.assign(url);
    }
    return { expiresAt: invitation.expiresAt, status: 'manual_prepared', localOnlyLink };
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
};

/** Explicit admin-only fallback when opening WhatsApp is blocked.
 * Keep the one-use capability exclusively in a synchronous clipboard gesture
 * after authorization; never add the message/link to React state or URLs.
 */
export const copyManualStaffInvite = async (getInvitation, details) => {
  const invitation = await getInvitation();
  if (!invitation || invitation.whatsappInviteStatus !== 'manual') {
    throw new Error('Manual invitation is not ready. Try again.');
  }
  const whatsappUrl = buildStaffWhatsAppUrl({ ...details, setupLink: invitation.setupLink, purpose: invitation.purpose });
  const text = new URL(whatsappUrl).searchParams.get('text');
  if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard is unavailable. Use Share on WhatsApp instead.');
  }
  await navigator.clipboard.writeText(text);
  return { status: 'copied', expiresAt: invitation.expiresAt };
};
