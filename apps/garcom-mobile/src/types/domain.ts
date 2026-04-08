export type TableStatus = 'free' | 'occupied' | 'serving' | 'payment_pending';
export type SessionStatus = 'open' | 'serving' | 'payment_pending' | 'closed';
export type AccountStatus = 'open' | 'paid';
export type OrderItemStatus = 'draft' | 'sent' | 'cancelled';
export type PaymentMethod = 'cash' | 'pix' | 'card';

export type OperatorProfile = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: string;
};

export type RestaurantTable = {
  id: string;
  number: number;
  capacity: number;
  location?: string | null;
  status: TableStatus;
  total: number;
  openMinutes: number;
  sessionId?: string | null;
};

export type TableSession = {
  id: string;
  tableId: string;
  tableNumber: number;
  openedAt: string;
  closedAt?: string | null;
  guestCount: number;
  status: SessionStatus;
  accounts: TableAccount[];
  history: SessionHistoryEntry[];
};

export type TableAccount = {
  id: string;
  sessionId: string;
  name: string;
  total: number;
  status: AccountStatus;
  itemCount: number;
  items: OrderItem[];
};

export type OrderItemOption = {
  id: string;
  orderItemId?: string;
  optionName: string;
  price: number;
  quantity: number;
};

export type ProductOption = {
  id: string;
  name: string;
  price: number;
};

export type ProductVariationGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelections: number;
  options: ProductOption[];
};

export type Product = {
  id: string;
  categoryId: string | null;
  name: string;
  description?: string | null;
  price: number;
  featured: boolean;
  sendToKds: boolean;
  variations: ProductVariationGroup[];
};

export type ProductCategory = {
  id: string;
  name: string;
  products: Product[];
};

export type OrderItem = {
  id: string;
  sessionId: string;
  accountId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  status: OrderItemStatus;
  createdAt: string;
  sentAt?: string | null;
  options: OrderItemOption[];
};

export type SessionHistoryEntry = {
  id: string;
  type: 'item' | 'payment' | 'status';
  label: string;
  timestamp: string;
  amount?: number;
};

export type PaymentRecord = {
  id: string;
  sessionId: string;
  accountId: string | null;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
};

export type SessionOpenInput = {
  tableId: string;
  tableNumber: number;
  guestCount: number;
  operator: OperatorProfile;
};

export type AddItemInput = {
  sessionId: string;
  accountId: string;
  product: Product;
  quantity: number;
  notes: string;
  selectedOptions: ProductOption[];
};
