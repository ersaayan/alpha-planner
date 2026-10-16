import { foldForSearch } from '@/utils/search';

describe('foldForSearch', () => {
  it('matches every Turkish and English i-variant', () => {
    const variants = ['İstanbul', 'istanbul', 'ISTANBUL', 'ıstanbul'];
    for (const a of variants) {
      for (const b of variants) {
        expect(foldForSearch(a)).toBe(foldForSearch(b));
      }
    }
  });

  it('finds Turkish words typed in either case', () => {
    expect(foldForSearch('Işık ödevi').includes(foldForSearch('IŞIK'))).toBe(true);
    expect(foldForSearch('ÇALIŞMA PLANI').includes(foldForSearch('çalışma'))).toBe(true);
    expect(foldForSearch('Write the INBOX report').includes(foldForSearch('inbox'))).toBe(true);
  });
});
