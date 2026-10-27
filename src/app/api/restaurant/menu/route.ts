import { NextResponse } from 'next/server';
import type { MenuItem } from '@/lib/analytics/types';

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'item_ribeye',
    name: 'Prime Tomahawk Ribeye (32oz)',
    category: 'grill',
    description: 'Dry-aged 45 days, char-grilled over white oak embers, served with rosemary bone marrow butter and sea salt.',
    price: 68.0,
    image: '/restaurant-hero.jpg',
    badge: "Chef's Signature",
    calories: 1250,
    isGlutenFree: true,
  },
  {
    id: 'item_smashburger',
    name: 'Artisan Truffle Bacon Burger',
    category: 'burger',
    description: 'Double custom beef blend, smoked gouda, black truffle aioli, crisp pancetta, and brioche bun with garlic parmesan fries.',
    price: 24.5,
    image: '/restaurant-hero.jpg',
    badge: 'Popular',
    calories: 980,
  },
  {
    id: 'item_margherita',
    name: 'Wood-Fired Margherita D.O.P.',
    category: 'pizza',
    description: 'San Marzano tomatoes, buffalo mozzarella, fresh basil, cold-pressed olive oil, 72-hour fermented sourdough.',
    price: 22.0,
    image: '/artisan-pizza.jpg',
    badge: 'Wood-Fired',
    calories: 820,
    isVegetarian: true,
  },
  {
    id: 'item_truffle_pizza',
    name: 'Wild Mushroom & Black Truffle Pizza',
    category: 'pizza',
    description: 'Roasted cremini & chanterelle mushrooms, taleggio cheese, thyme, white truffle drizzle, blistered crust.',
    price: 26.0,
    image: '/artisan-pizza.jpg',
    badge: 'Staff Pick',
    calories: 890,
    isVegetarian: true,
  },
  {
    id: 'item_burrata',
    name: 'Heirloom Burrata Crostini',
    category: 'starter',
    description: 'Creamy pugliese burrata, roasted mission figs, pistachio pesto, aged balsamic reduction on toasted sourdough.',
    price: 17.5,
    image: '/artisan-pizza.jpg',
    badge: 'Appetizer',
    calories: 450,
    isVegetarian: true,
  },
  {
    id: 'item_oldfashioned',
    name: 'Smoked Bourbon Old Fashioned',
    category: 'drinks',
    description: 'Small-batch Kentucky bourbon, smoked cherrywood, aromatic bitters, clear ice sphere, flamed orange peel.',
    price: 18.0,
    image: '/cocktail-dessert.jpg',
    badge: 'Craft Bar',
    calories: 190,
  },
  {
    id: 'item_lavacake',
    name: 'Valrhona Dark Chocolate Lava Cake',
    category: 'dessert',
    description: 'Molten Grand Cru chocolate center, Madagascar vanilla bean gelato, dusted with gold sugar and fresh raspberries.',
    price: 14.5,
    image: '/cocktail-dessert.jpg',
    badge: 'House Dessert',
    calories: 620,
    isVegetarian: true,
  },
];

export async function GET() {
  return NextResponse.json({ items: MENU_ITEMS });
}
