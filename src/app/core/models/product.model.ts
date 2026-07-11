/**
 * Product catalog domain types (§7.4). The catalog is deliberately large
 * (thousands of items) to prove search performance.
 */

export type ProductCategory =
  | 'burgers'
  | 'pizza'
  | 'sides'
  | 'drinks'
  | 'desserts'
  | 'salads'
  | 'breakfast'
  | 'combos';

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly price: number;
  readonly allergens?: string[];
  readonly available: boolean;
  /** Lower-cased name kept alongside for a cheap search index. */
  readonly searchTokens: string;
}

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'burgers',
  'pizza',
  'sides',
  'drinks',
  'desserts',
  'salads',
  'breakfast',
  'combos',
] as const;
