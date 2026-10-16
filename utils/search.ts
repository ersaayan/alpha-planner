/**
 * Normalizes text for case-insensitive search in Turkish and English alike.
 *
 * Plain toLowerCase() turns "İ" into "i" + U+0307 (combining dot), so "İstanbul"
 * never matches "istanbul", and "ı" never matches "I"/"i". Folding every i-variant
 * (I, İ, ı, i) to "i" makes search work whatever the keyboard or UI language.
 */
export function foldForSearch(text: string): string {
  return text.toLowerCase().replace(/̇/g, '').replace(/ı/g, 'i');
}
