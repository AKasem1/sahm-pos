import { Product, ProductCategory } from '../../app/core/models/product.model';

/**
 * Deterministic large product catalog generator (§9.4).
 *
 * We synthesise ~2,400 items from a set of bases × variants so the search
 * feature has a genuinely large dataset to prove virtualization + indexing,
 * while staying reproducible (no randomness) for stable tests/demos.
 */

interface Base {
  readonly name: string;
  readonly category: ProductCategory;
  readonly price: number;
  readonly allergens?: string[];
}

const BASES: readonly Base[] = [
  { name: 'Classic Cheeseburger', category: 'burgers', price: 8.5, allergens: ['gluten', 'dairy'] },
  { name: 'Double Bacon Burger', category: 'burgers', price: 11.0, allergens: ['gluten', 'dairy'] },
  { name: 'Veggie Burger', category: 'burgers', price: 9.0, allergens: ['gluten', 'soy'] },
  { name: 'Spicy Chicken Burger', category: 'burgers', price: 9.5, allergens: ['gluten'] },
  { name: 'Margherita Pizza', category: 'pizza', price: 12.0, allergens: ['gluten', 'dairy'] },
  { name: 'Pepperoni Pizza', category: 'pizza', price: 13.5, allergens: ['gluten', 'dairy'] },
  { name: 'Four Cheese Pizza', category: 'pizza', price: 14.0, allergens: ['gluten', 'dairy'] },
  { name: 'BBQ Chicken Pizza', category: 'pizza', price: 14.5, allergens: ['gluten', 'dairy'] },
  { name: 'French Fries', category: 'sides', price: 3.5 },
  { name: 'Onion Rings', category: 'sides', price: 4.0, allergens: ['gluten'] },
  { name: 'Mozzarella Sticks', category: 'sides', price: 5.5, allergens: ['gluten', 'dairy'] },
  { name: 'Garlic Bread', category: 'sides', price: 4.5, allergens: ['gluten'] },
  { name: 'Cola', category: 'drinks', price: 2.5 },
  { name: 'Fresh Orange Juice', category: 'drinks', price: 3.5 },
  { name: 'Iced Latte', category: 'drinks', price: 4.0, allergens: ['dairy'] },
  { name: 'Mineral Water', category: 'drinks', price: 1.5 },
  { name: 'Chocolate Brownie', category: 'desserts', price: 5.0, allergens: ['gluten', 'dairy', 'nuts'] },
  { name: 'Cheesecake', category: 'desserts', price: 5.5, allergens: ['gluten', 'dairy'] },
  { name: 'Ice Cream Sundae', category: 'desserts', price: 4.5, allergens: ['dairy', 'nuts'] },
  { name: 'Caesar Salad', category: 'salads', price: 7.5, allergens: ['dairy', 'gluten', 'fish'] },
  { name: 'Greek Salad', category: 'salads', price: 7.0, allergens: ['dairy'] },
  { name: 'Garden Salad', category: 'salads', price: 6.0 },
  { name: 'Pancakes Stack', category: 'breakfast', price: 6.5, allergens: ['gluten', 'dairy', 'egg'] },
  { name: 'Eggs Benedict', category: 'breakfast', price: 8.0, allergens: ['gluten', 'dairy', 'egg'] },
  { name: 'Avocado Toast', category: 'breakfast', price: 7.0, allergens: ['gluten'] },
  { name: 'Family Combo', category: 'combos', price: 24.0, allergens: ['gluten', 'dairy'] },
  { name: 'Lunch Combo', category: 'combos', price: 12.5, allergens: ['gluten'] },
  { name: 'Kids Combo', category: 'combos', price: 8.0, allergens: ['gluten'] },
];

const VARIANTS: readonly string[] = [
  'Regular',
  'Large',
  'Small',
  'Family Size',
  'Spicy',
  'Extra Cheese',
  'No Onion',
  'Gluten-Free',
  'Deluxe',
  'Meal Deal',
  'Combo',
  'Sharing',
];

const REGIONS: readonly string[] = ['Downtown', 'Riverside', 'Airport', 'Mall', 'Uptown', 'Harbor'];

function buildCatalog(): Product[] {
  const products: Product[] = [];
  let seq = 1000;

  for (const base of BASES) {
    for (const variant of VARIANTS) {
      for (const region of REGIONS) {
        seq += 1;
        const name = `${base.name} — ${variant} (${region})`;
        const priceBump = VARIANTS.indexOf(variant) * 0.75 + REGIONS.indexOf(region) * 0.1;
        const product: Product = {
          id: `p_${seq}`,
          name,
          category: base.category,
          price: Math.round((base.price + priceBump) * 100) / 100,
          available: seq % 17 !== 0, // ~6% unavailable, deterministic
          searchTokens: name.toLowerCase(),
          ...(base.allergens ? { allergens: base.allergens } : {}),
        };
        products.push(product);
      }
    }
  }
  return products;
}

/** Memoised so we build the catalog once per process. */
let cached: Product[] | null = null;

export function getProductCatalog(): Product[] {
  cached ??= buildCatalog();
  return cached;
}
