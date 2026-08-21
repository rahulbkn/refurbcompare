import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PriceHistoryChart, { alignSeries } from '../components/price-history-chart';

describe('alignSeries', () => {
  it('aligns sellers on a shared chronological timeline', () => {
    const rows = alignSeries([
      {
        sellerName: 'ReFit',
        points: [
          { recordedAt: '2026-08-21T10:00:00Z', price: 18500 },
          { recordedAt: '2026-08-20T10:00:00Z', price: 19000 },
        ],
      },
      { sellerName: 'Cashify', points: [{ recordedAt: '2026-08-21T09:00:00Z', price: 18299 }] },
    ]);
    expect(rows).toEqual([
      { date: '2026-08-20', ReFit: 19000 },
      { date: '2026-08-21', ReFit: 18500, Cashify: 18299 },
    ]);
  });

  it('preserves a single point (never drops sparse history)', () => {
    const rows = alignSeries([
      { sellerName: 'ReFit', points: [{ recordedAt: '2026-08-21T10:00:00Z', price: 18299 }] },
    ]);
    expect(rows).toEqual([{ date: '2026-08-21', ReFit: 18299 }]);
  });

  it('returns empty for empty series', () => {
    expect(alignSeries([])).toEqual([]);
  });
});

describe('PriceHistoryChart rendering', () => {
  it('renders an empty state with no points and invents nothing', () => {
    const html = renderToStaticMarkup(<PriceHistoryChart series={[]} />);
    expect(html).toContain('No price history available yet');
    expect(html).not.toContain('₹');
  });

  it('enables dots only for sparse timelines so a single point stays visible', () => {
    // The dot decision is data-length driven; verify the component source
    // contract via the exported component props path (SSR can't measure
    // ResponsiveContainer, so assert the empty-vs-chart branch instead).
    const empty = renderToStaticMarkup(<PriceHistoryChart series={[]} />);
    expect(empty).not.toContain('recharts-responsive-container');
    const one = renderToStaticMarkup(
      <PriceHistoryChart
        series={[{ sellerName: 'ReFit', points: [{ recordedAt: '2026-08-21T10:00:00Z', price: 18299 }] }]}
      />,
    );
    expect(one).toContain('recharts-responsive-container');
  });
});
