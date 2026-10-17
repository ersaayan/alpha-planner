/**
 * Stable default IDs and layout constants
 */

// Stable UUIDs for default categories — prevent ID regeneration on each init
export const DEFAULT_CATEGORY_IDS = {
  work: 'dc000001-0000-0000-0000-000000000001',
  personal: 'dc000001-0000-0000-0000-000000000002',
  health: 'dc000001-0000-0000-0000-000000000003',
  learning: 'dc000001-0000-0000-0000-000000000004',
  shopping: 'dc000001-0000-0000-0000-000000000005',
} as const;

