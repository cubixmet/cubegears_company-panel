/** Read-only customer responses attached to immutable estimate versions.
 *  Audit data comes from authenticated Django JobActivity records, not browser storage.
 */
export const DECLINE_REASON_LABELS = Object.freeze({
  price: 'Price is too high',
  items: 'Incorrect / unnecessary items',
  timing: 'Timing is not suitable',
  explanation: 'Customer needs more details',
  other: 'Other reason',
  unspecified: 'Reason not provided',
});

export function customerEstimateDeclines(activities = []) {
  const byEstimate = new Map();
  for (const event of Array.isArray(activities) ? activities : []) {
    if (event?.event !== 'Customer Estimate Declined') continue;
    const metadata = event?.metadata;
    const id = String(metadata?.estimateId || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    const reason = String(metadata?.declineReason || 'unspecified');
    const rawNote = metadata?.declineNote;
    byEstimate.set(id, {
      reason: Object.hasOwn(DECLINE_REASON_LABELS, reason) ? reason : 'unspecified',
      reasonLabel: DECLINE_REASON_LABELS[reason] || DECLINE_REASON_LABELS.unspecified,
      note: typeof rawNote === 'string' && rawNote.length <= 500 ? rawNote : '',
      receiptId: String(event?.id || ''),
      version: Number(metadata?.version) || null,
      createdAt: event?.created_at || '',
    });
  }
  return byEstimate;
}
