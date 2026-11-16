/** Product grid (PDF: 2 columns, 16 pt gap; 3 columns on tablets like the web's md breakpoint). */
export const GRID_GAP = 16;

/**
 * Card width for a row of `contentWidth` points. Rounded down to whole points: an exact
 * fractional fit (e.g. 177.714 × 2 + 16 on a 411.43-wide phone) can overflow by a rounding error
 * and make the second card wrap onto its own line.
 */
export function productGrid(contentWidth: number): { columns: number; cardWidth: number; gap: number } {
  const columns = contentWidth >= 560 ? 3 : 2;
  const cardWidth = Math.floor((contentWidth - GRID_GAP * (columns - 1)) / columns);
  return { columns, cardWidth, gap: GRID_GAP };
}
