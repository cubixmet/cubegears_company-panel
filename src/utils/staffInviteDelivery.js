/** Staff login state comes from Django; it is not inferred from invitation delivery. */
export const staffLoginStatusLabel = (status) => ({
  Active: 'Login Active',
  Disabled: 'Login Disabled',
  'Pending Password Setup': 'Pending Password Setup',
  'Not Invited': 'Not Invited',
}[status] || 'Not Invited');

export const staffInviteStatusLabel = (status) => ({
  queued: 'Invitation Queued',
  sending: 'Invitation Sending',
  sent: 'Legacy Invite Status (Unverified)',
  delivered: 'Invitation Delivered',
  read: 'Invitation Read',
  failed: 'Invitation Failed',
  manual: 'Ready for Manual Share',
  pending: 'Invitation Pending',
  consumed: 'Password Setup Completed',
  superseded: 'Invitation Replaced',
  not_requested: 'Not Invited',
}[status] || 'Not Invited');

/** Status describes the Django/provider handoff, never inbox receipt. */
export const staffInviteDeliveryMessage = (status) => {
  switch (status) {
    case 'manual':
      return 'Secure link is available for an authorized administrator to share manually. Opening WhatsApp never confirms delivery.';
    case 'queued':
    case 'sending':
    case 'sent':
    case 'delivered':
    case 'read':
      return 'Legacy automatic-delivery status only. No new messages are sent automatically.';
    case 'failed':
      return 'No setup link was delivered. Generate a fresh manual setup link instead of recreating the staff record.';
    case 'pending':
      return 'Staff login setup is pending. Prepare a manual invitation.';
    case 'consumed':
      return 'Password setup completed. Mobile login is active.';
    case 'not_requested':
      return 'No invitation has been prepared.';
    case 'superseded':
      return 'The invitation was replaced with a new link.';
    default:
      return '';
  }
};

/** Read DRF validation errors from normalized or raw Axios responses. */
export const staffInviteErrorMessage = (error) => {
  const payload = error?.data || error?.response?.data;
  const messages = (value) => {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map(messages).filter(Boolean).join(' ');
    if (value && typeof value === 'object') return Object.values(value).map(messages).filter(Boolean).join(' ');
    return '';
  };
  return messages(payload) || error?.message || 'Unable to send invite. Please try again.';
};
