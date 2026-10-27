'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  ShoppingBag,
  Plus,
  Minus,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  CreditCard,
  MapPin,
  Search,
  ChevronRight,
  Info,
} from 'lucide-react';
import { analytics } from '@/lib/analytics/browser-sdk';
import type { MenuItem, CartItem, OrderRecord } from '@/lib/analytics/types';

interface RestaurantStoreProps {
  onGoToDashboard: () => void;
}

export const RestaurantStore: React.FC<RestaurantStoreProps> = ({ onGoToDashboard }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [diningOption, setDiningOption] = useState<'dine-in' | 'takeout' | 'delivery'>('dine-in');
  const [tableNumber, setTableNumber] = useState('Table 12');
  const [deliveryAddress, setDeliveryAddress] = useState('124 Fifth Avenue, New York, NY');
  const [customerName, setCustomerName] = useState('Alexander Reed');
  const [customerEmail, setCustomerEmail] = useState('alexander.reed@example.com');
  const [paymentMethod, setPaymentMethod] = useState('apple_pay');
  const [tipPercent, setTipPercent] = useState<number>(18);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  // Initialize Browser SDK on mount
  useEffect(() => {
    analytics.init({
      debug: true,
      flushIntervalMs: 2000,
      batchSize: 4,
    });
    // Track home page visit
    analytics.page('Kitchen Spurs - Artisanal Menu');
  }, []);

  // Fetch menu
  useEffect(() => {
    async function loadMenu() {
      try {
        const res = await fetch('/api/restaurant/menu');
        const data = await res.json();
        if (data.items) {
          setMenuItems(data.items);
        }
      } catch (err) {
        console.error('Failed to load menu:', err);
      }
    }
    loadMenu();
  }, []);

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Cart calculations
  const subtotal = cart.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);
  const tax = Number((subtotal * 0.08875).toFixed(2));
  const tip = Number(((subtotal * tipPercent) / 100).toFixed(2));
  const total = Number((subtotal + tax + tip).toFixed(2));
  const totalCartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  // Add to cart handler
  const handleAddToCart = (item: MenuItem, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci
        );
      }
      return [...prev, { item, quantity }];
    });

    // Track event via Browser SDK
    analytics.track('add_to_cart', {
      itemId: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      quantity,
      newCartTotal: Number((subtotal + item.price * quantity).toFixed(2)),
    });
  };

  // Remove / Decrement from cart handler
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === itemId);
      if (!existing) return prev;

      if (existing.quantity + delta <= 0) {
        // Track removal
        analytics.track('remove_from_cart', {
          itemId: existing.item.id,
          name: existing.item.name,
          price: existing.item.price,
        });
        return prev.filter((ci) => ci.item.id !== itemId);
      }

      return prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: ci.quantity + delta } : ci
      );
    });
  };

  // Open item detail modal
  const handleViewItem = (item: MenuItem) => {
    setSelectedItem(item);
    analytics.track('view_item', {
      itemId: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      badge: item.badge,
    });
  };

  // Search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length >= 3) {
      analytics.track('search', {
        query: val,
      });
    }
  };

  // Start checkout flow
  const handleOpenCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);

    // Identify user profile traits
    analytics.identify(customerEmail, {
      name: customerName,
      email: customerEmail,
      preferredDining: diningOption,
    });

    // Track checkout initiation
    analytics.track('begin_checkout', {
      cartItemCount: totalCartCount,
      subtotal,
      tax,
      tip,
      total,
      diningOption,
    });
  };

  // Submit order to restaurant backend
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsSubmittingOrder(true);

    try {
      // Send order to backend API
      const res = await fetch('/api/restaurant/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          diningOption,
          tableNumber: diningOption === 'dine-in' ? tableNumber : undefined,
          deliveryAddress: diningOption === 'delivery' ? deliveryAddress : undefined,
          items: cart.map((ci) => ({
            id: ci.item.id,
            name: ci.item.name,
            price: ci.item.price,
            quantity: ci.quantity,
          })),
          subtotal,
          tax,
          tip,
          total,
          paymentMethod,
          anonymousId: analytics.getAnonymousId(),
          sessionId: analytics.getSessionId(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      setConfirmedOrder(data.order);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (err) {
      console.error('Order submission error:', err);
      alert('Order could not be submitted. Please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-24">
      {/* Hero Banner */}
      <section className="relative h-96 w-full overflow-hidden border-b border-stone-800">
        <Image
          src="/restaurant-hero.jpg"
          alt="Kitchen Spurs Grill"
          fill
          priority
          className="object-cover object-center filter brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3 w-fit backdrop-blur-sm">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Wood-Fired Ember Kitchen
          </div>
          <h1 className="text-4xl sm:text-6xl font-serif font-extrabold tracking-tight text-white mb-2">
            KITCHEN SPURS
          </h1>
          <p className="text-stone-300 max-w-2xl text-base sm:text-lg mb-6 leading-relaxed">
            Artisanal steaks, 72-hour fermented wood-fired pizzas, and craft smokehouse cocktails.
            Every guest interaction and backend transaction tracked in real-time.
          </p>

          {/* Quick Info Badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-stone-300">
            <span className="flex items-center gap-1.5 bg-stone-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-800">
              <Clock className="w-4 h-4 text-amber-400" />
              Kitchen Open: 11:30 AM – 11:00 PM
            </span>
            <span className="flex items-center gap-1.5 bg-stone-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-800">
              <MapPin className="w-4 h-4 text-amber-400" />
              SoHo / Manhattan, NY
            </span>
            <span className="flex items-center gap-1.5 bg-stone-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-800">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Michelin Guide Recommended
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Controls Bar: Category Filters & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'all', label: 'All Dishes' },
              { id: 'grill', label: 'Steaks & Grill' },
              { id: 'pizza', label: 'Wood-Fired Pizza' },
              { id: 'burger', label: 'Gourmet Burgers' },
              { id: 'starter', label: 'Starters' },
              { id: 'drinks', label: 'Craft Bar' },
              { id: 'dessert', label: 'Desserts' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  analytics.track('category_filter_selected', { category: cat.id });
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                    : 'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search dishes, ingredients..."
              className="w-full bg-stone-900/90 border border-stone-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-stone-900/80 rounded-2xl border border-stone-800/80 overflow-hidden hover:border-stone-700 hover:shadow-xl hover:shadow-black/50 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Item Image */}
                <div
                  onClick={() => handleViewItem(item)}
                  className="relative h-48 w-full overflow-hidden cursor-pointer"
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent opacity-80" />
                  {item.badge && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-stone-950/80 backdrop-blur-md border border-amber-500/30 text-amber-300 text-[11px] font-semibold tracking-wide">
                      {item.badge}
                    </span>
                  )}
                  {item.calories && (
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-stone-950/70 text-stone-400 text-[10px]">
                      {item.calories} kcal
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3
                      onClick={() => handleViewItem(item)}
                      className="font-serif font-bold text-lg text-white hover:text-amber-400 cursor-pointer transition-colors"
                    >
                      {item.name}
                    </h3>
                    <span className="font-mono text-base font-bold text-amber-400">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed mb-4">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 pb-5 pt-0 flex items-center gap-2">
                <button
                  onClick={() => handleViewItem(item)}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition-colors text-center"
                >
                  Quick View
                </button>
                <button
                  onClick={() => handleAddToCart(item)}
                  className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Cart Trigger Pill */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 px-5 py-3 rounded-full shadow-2xl shadow-amber-500/40 font-bold hover:scale-105 active:scale-95 transition-all"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-stone-950" />
              <span className="absolute -top-2 -right-2 bg-stone-950 text-amber-400 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCartCount}
              </span>
            </div>
            <span className="text-sm">View Cart</span>
            <span className="text-sm font-mono border-l border-stone-950/20 pl-2">
              ${total.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* Item Quick View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-stone-950/70 text-stone-400 hover:text-white flex items-center justify-center border border-stone-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative h-60 w-full">
              <Image
                src={selectedItem.image}
                alt={selectedItem.name}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent" />
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    {selectedItem.category}
                  </span>
                  <h2 className="font-serif font-bold text-2xl text-white">
                    {selectedItem.name}
                  </h2>
                </div>
                <span className="font-mono text-xl font-bold text-amber-400">
                  ${selectedItem.price.toFixed(2)}
                </span>
              </div>

              <p className="text-stone-300 text-sm leading-relaxed mb-6">
                {selectedItem.description}
              </p>

              <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 mb-6 flex items-center justify-between text-xs text-stone-400">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Prepared to order in 15-20 min
                </span>
                {selectedItem.calories && <span>{selectedItem.calories} Calories</span>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleAddToCart(selectedItem);
                    setSelectedItem(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Add to Cart (${selectedItem.price.toFixed(2)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Slide-over Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-stone-900 border-l border-stone-800 shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="p-6 border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                  <h2 className="font-serif font-bold text-lg text-white">Your Order</h2>
                  <span className="text-xs bg-stone-800 px-2 py-0.5 rounded-full text-stone-300">
                    {totalCartCount}
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-stone-500">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Your cart is empty.</p>
                    <p className="text-xs text-stone-600 mt-1">
                      Explore our artisanal menu and add your favorite dishes!
                    </p>
                  </div>
                ) : (
                  cart.map((ci) => (
                    <div
                      key={ci.item.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80"
                    >
                      <div className="flex-1 pr-3">
                        <h4 className="text-sm font-semibold text-white">{ci.item.name}</h4>
                        <span className="text-xs text-stone-400 font-mono">
                          ${ci.item.price.toFixed(2)} each
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(ci.item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm font-bold text-white">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(ci.item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Calculations & Checkout Button */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-stone-800 bg-stone-950/60 space-y-4">
                  {/* Tip Selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2">
                      Add Kitchen & Service Tip
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 18, 20, 25].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => setTipPercent(pct)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            tipPercent === pct
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Rows */}
                  <div className="space-y-1.5 text-xs text-stone-400 pt-2 border-t border-stone-800/80">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-mono text-stone-200">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sales Tax (8.875%)</span>
                      <span className="font-mono text-stone-200">${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hospitality Tip ({tipPercent}%)</span>
                      <span className="font-mono text-stone-200">${tip.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-stone-800">
                      <span>Total Amount</span>
                      <span className="font-mono text-amber-400">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenCheckout}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-98"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-xl text-white">Complete Your Order</h3>
                <p className="text-xs text-stone-400">
                  Total: <span className="text-amber-400 font-mono font-bold">${total.toFixed(2)}</span> ({totalCartCount} items)
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
              {/* Dining Option Toggle */}
              <div>
                <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2">
                  Dining Preference
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dine-in', 'takeout', 'delivery'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDiningOption(opt)}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        diningOption === opt
                          ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-sm'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Location Field */}
              {diningOption === 'dine-in' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                    Table Number
                  </label>
                  <input
                    type="text"
                    required
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {diningOption === 'delivery' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                    Delivery Address
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Customer Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                    Email (for Receipt)
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'apple_pay', label: 'Apple Pay' },
                    { id: 'card', label: 'Credit Card' },
                    { id: 'cash', label: 'Cash / Terminal' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === pm.id
                          ? 'bg-stone-800 border-amber-500/80 text-amber-300'
                          : 'bg-stone-950 border-stone-800 text-stone-400'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Architecture Highlight Notice */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Submitting this order will invoke the <strong className="text-white">Server Tracking SDK</strong> on the backend to emit an <code className="bg-stone-950 px-1 py-0.5 rounded text-amber-300">order_created</code> event with full transactional metadata.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingOrder}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 disabled:opacity-50"
              >
                {isSubmittingOrder ? (
                  <span>Processing Transaction & Emitting Server Event...</span>
                ) : (
                  <>
                    <span>Place Order (${total.toFixed(2)})</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Confirmation Screen */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
              Order Confirmed & Tracked
            </span>
            <h3 className="font-serif font-bold text-2xl text-white mt-1 mb-2">
              Bon Appétit, {confirmedOrder.customer_name}!
            </h3>
            <p className="text-xs text-stone-400 mb-6">
              Order <code className="bg-stone-950 px-2 py-0.5 rounded text-amber-400 font-mono">{confirmedOrder.id}</code> has been transmitted to our kitchen line.
            </p>

            {/* Architecture Proof Box */}
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 text-left text-xs mb-6 space-y-2">
              <div className="flex items-center justify-between text-stone-400 pb-2 border-b border-stone-800">
                <span>Total Amount Charged</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  ${confirmedOrder.total.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-stone-400">
                <span>Attributed Customer</span>
                <span className="text-stone-300">{confirmedOrder.customer_email}</span>
              </div>
              <div className="flex items-center justify-between text-stone-400">
                <span>Event Tracking Source</span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-semibold border border-purple-500/30">
                  server (Backend API)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setConfirmedOrder(null);
                  onGoToDashboard();
                }}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <span>View Event in Analytics Dashboard</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmedOrder(null)}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
              >
                Order Another Dish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
