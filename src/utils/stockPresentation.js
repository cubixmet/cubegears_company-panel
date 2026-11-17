// A 0% rate alone does not distinguish legal categories. Preserve that
// distinction with the item; jurisdiction is determined at invoice time.
export const ZERO_GST_CLASSIFICATIONS = [
  ['exempt', 'Exempt'],
  ['nil_rated', 'Nil-rated'],
  ['zero_rated', 'Zero-rated'],
  ['non_gst', 'Non-GST'],
];

export function stockState(item) {
  const onHand = Number(item.onHand) || 0;
  const reserved = Number(item.reserved) || 0;
  const available = Number(item.available ?? (onHand - reserved)) || 0;
  if (available <= 0) return { label: 'Out of stock', tone: 'out' };
  if (available <= (Number(item.minimumStock) || 0)) return { label: 'Low stock', tone: 'low' };
  return { label: 'Available', tone: 'ok' };
}
