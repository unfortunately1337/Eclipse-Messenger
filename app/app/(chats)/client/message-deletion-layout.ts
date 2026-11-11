export type MessageDeletionShift = {
  afterIndex: number;
  shiftY: number;
  rows?: { id: string; index: number; height: number }[];
};

export function messageDeletionOffset(shift: MessageDeletionShift | null, index: number) {
  if (!shift) return 0;
  if (!shift.rows) return index > shift.afterIndex ? shift.shiftY : 0;
  if (shift.rows.some(row => row.index === index)) return 0;
  return shift.rows.reduce((offset, row) => offset + (row.index < index ? row.height : 0), 0);
}
