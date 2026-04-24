import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

// User Model
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'manager', 'user'), defaultValue: 'user' },
  avatar: { type: DataTypes.STRING },
  lastLogin: { type: DataTypes.DATE }
}, { tableName: 'users', timestamps: true });

// Product Model
const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sku: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  category: { type: DataTypes.STRING },
  basePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currentPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  cost: { type: DataTypes.DECIMAL(10, 2) },
  imageUrl: { type: DataTypes.STRING },
  images: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  status: { type: DataTypes.ENUM('active', 'inactive', 'draft'), defaultValue: 'active' },
  tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  aiOptimized: { type: DataTypes.BOOLEAN, defaultValue: false },
  seoScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  hasVariants: { type: DataTypes.BOOLEAN, defaultValue: false },
  weight: { type: DataTypes.DECIMAL(8, 2) },
  dimensions: { type: DataTypes.JSONB }
}, { tableName: 'products', timestamps: true });

// Dynamic Pricing Model
const Pricing = sequelize.define('Pricing', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  originalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  suggestedPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  competitorPrice: { type: DataTypes.DECIMAL(10, 2) },
  demandScore: { type: DataTypes.INTEGER, defaultValue: 50 },
  profitMargin: { type: DataTypes.DECIMAL(5, 2) },
  priceChangeReason: { type: DataTypes.TEXT },
  aiConfidence: { type: DataTypes.DECIMAL(5, 2) },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'applied'), defaultValue: 'pending' }
}, { tableName: 'pricing', timestamps: true });

// Ad Campaign Model
const AdCampaign = sequelize.define('AdCampaign', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  platform: { type: DataTypes.ENUM('google', 'facebook', 'instagram', 'tiktok', 'amazon'), allowNull: false },
  budget: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  spent: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  impressions: { type: DataTypes.INTEGER, defaultValue: 0 },
  clicks: { type: DataTypes.INTEGER, defaultValue: 0 },
  conversions: { type: DataTypes.INTEGER, defaultValue: 0 },
  ctr: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  roas: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  targetAudience: { type: DataTypes.TEXT },
  adCopy: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'paused', 'draft', 'completed'), defaultValue: 'draft' },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  aiGenerated: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'ad_campaigns', timestamps: true });

// Inventory Model
const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  reservedQuantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  reorderPoint: { type: DataTypes.INTEGER, defaultValue: 10 },
  reorderQuantity: { type: DataTypes.INTEGER, defaultValue: 50 },
  warehouse: { type: DataTypes.STRING },
  lastRestocked: { type: DataTypes.DATE },
  predictedStockout: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('in_stock', 'low_stock', 'out_of_stock', 'overstocked'), defaultValue: 'in_stock' }
}, { tableName: 'inventory', timestamps: true });

// Customer Model
const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  totalOrders: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalSpent: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  averageOrderValue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  lifetimeValue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  segment: { type: DataTypes.STRING },
  churnRisk: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  lastPurchase: { type: DataTypes.DATE },
  preferredCategories: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  status: { type: DataTypes.ENUM('active', 'inactive', 'churned'), defaultValue: 'active' }
}, { tableName: 'customers', timestamps: true });

// Order Model
const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderNumber: { type: DataTypes.STRING, unique: true, allowNull: false },
  customerId: { type: DataTypes.INTEGER },
  items: { type: DataTypes.JSONB, defaultValue: [] },
  subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tax: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  shipping: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'), defaultValue: 'pending' },
  paymentStatus: { type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'), defaultValue: 'pending' },
  shippingAddress: { type: DataTypes.JSONB },
  trackingNumber: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
  paymentIntentId: { type: DataTypes.STRING },
  stripeCustomerId: { type: DataTypes.STRING },
  refundId: { type: DataTypes.STRING },
  refundAmount: { type: DataTypes.DECIMAL(10, 2) }
}, { tableName: 'orders', timestamps: true });

// Review Model
const Review = sequelize.define('Review', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  customerId: { type: DataTypes.INTEGER },
  customerName: { type: DataTypes.STRING },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING },
  content: { type: DataTypes.TEXT },
  sentiment: { type: DataTypes.ENUM('positive', 'neutral', 'negative') },
  sentimentScore: { type: DataTypes.DECIMAL(5, 2) },
  keywords: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  aiResponse: { type: DataTypes.TEXT },
  responded: { type: DataTypes.BOOLEAN, defaultValue: false },
  helpful: { type: DataTypes.INTEGER, defaultValue: 0 },
  verified: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'reviews', timestamps: true });

// AI Generated Content Model
const Content = sequelize.define('Content', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.ENUM('product_description', 'ad_copy', 'email', 'social_post', 'blog', 'seo_meta'), allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  productId: { type: DataTypes.INTEGER },
  platform: { type: DataTypes.STRING },
  tone: { type: DataTypes.STRING },
  wordCount: { type: DataTypes.INTEGER },
  seoScore: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('draft', 'approved', 'published', 'archived'), defaultValue: 'draft' },
  aiModel: { type: DataTypes.STRING },
  generationPrompt: { type: DataTypes.TEXT }
}, { tableName: 'content', timestamps: true });

// Market Trend Model
const MarketTrend = sequelize.define('MarketTrend', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category: { type: DataTypes.STRING, allowNull: false },
  trendName: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  growthRate: { type: DataTypes.DECIMAL(5, 2) },
  searchVolume: { type: DataTypes.INTEGER },
  competitionLevel: { type: DataTypes.ENUM('low', 'medium', 'high'), defaultValue: 'medium' },
  opportunity: { type: DataTypes.ENUM('high', 'medium', 'low'), defaultValue: 'medium' },
  relatedKeywords: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  aiInsights: { type: DataTypes.TEXT },
  dataSource: { type: DataTypes.STRING },
  trendStartDate: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('rising', 'stable', 'declining'), defaultValue: 'stable' }
}, { tableName: 'market_trends', timestamps: true });

// Competitor Model
const Competitor = sequelize.define('Competitor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  website: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
  priceRange: { type: DataTypes.STRING },
  marketShare: { type: DataTypes.DECIMAL(5, 2) },
  strengthScore: { type: DataTypes.INTEGER, defaultValue: 50 },
  weaknesses: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  strengths: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  products: { type: DataTypes.INTEGER, defaultValue: 0 },
  avgRating: { type: DataTypes.DECIMAL(3, 2) },
  aiAnalysis: { type: DataTypes.TEXT },
  lastAnalyzed: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('active', 'inactive', 'monitoring'), defaultValue: 'active' }
}, { tableName: 'competitors', timestamps: true });

// A/B Test Model
const ABTest = sequelize.define('ABTest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('pricing', 'content', 'layout', 'ad_copy', 'email'), allowNull: false },
  variantA: { type: DataTypes.JSONB, allowNull: false },
  variantB: { type: DataTypes.JSONB, allowNull: false },
  variantAViews: { type: DataTypes.INTEGER, defaultValue: 0 },
  variantBViews: { type: DataTypes.INTEGER, defaultValue: 0 },
  variantAConversions: { type: DataTypes.INTEGER, defaultValue: 0 },
  variantBConversions: { type: DataTypes.INTEGER, defaultValue: 0 },
  winner: { type: DataTypes.ENUM('A', 'B', 'none') },
  confidenceLevel: { type: DataTypes.DECIMAL(5, 2) },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('draft', 'running', 'paused', 'completed'), defaultValue: 'draft' },
  aiRecommendation: { type: DataTypes.TEXT }
}, { tableName: 'ab_tests', timestamps: true });

// Sales Forecast Model
const SalesForecast = sequelize.define('SalesForecast', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER },
  category: { type: DataTypes.STRING },
  forecastDate: { type: DataTypes.DATE, allowNull: false },
  predictedSales: { type: DataTypes.INTEGER, allowNull: false },
  predictedRevenue: { type: DataTypes.DECIMAL(10, 2) },
  actualSales: { type: DataTypes.INTEGER },
  actualRevenue: { type: DataTypes.DECIMAL(10, 2) },
  accuracy: { type: DataTypes.DECIMAL(5, 2) },
  confidenceInterval: { type: DataTypes.JSONB },
  factors: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  aiModel: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT }
}, { tableName: 'sales_forecasts', timestamps: true });

// Customer Segment Model
const CustomerSegment = sequelize.define('CustomerSegment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  criteria: { type: DataTypes.JSONB, allowNull: false },
  customerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  averageValue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  totalRevenue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  growthRate: { type: DataTypes.DECIMAL(5, 2) },
  churnRate: { type: DataTypes.DECIMAL(5, 2) },
  recommendedActions: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  aiInsights: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, { tableName: 'customer_segments', timestamps: true });

// Recommendation Model
const Recommendation = sequelize.define('Recommendation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.ENUM('product', 'upsell', 'cross_sell', 'bundle'), allowNull: false },
  sourceProductId: { type: DataTypes.INTEGER },
  targetProductId: { type: DataTypes.INTEGER },
  customerId: { type: DataTypes.INTEGER },
  score: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  reason: { type: DataTypes.TEXT },
  clicks: { type: DataTypes.INTEGER, defaultValue: 0 },
  conversions: { type: DataTypes.INTEGER, defaultValue: 0 },
  revenue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  aiModel: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('active', 'inactive', 'expired'), defaultValue: 'active' }
}, { tableName: 'recommendations', timestamps: true });

// ProductVariant Model
const ProductVariant = sequelize.define('ProductVariant', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  sku: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  options: { type: DataTypes.JSONB, defaultValue: {} },
  priceOverride: { type: DataTypes.DECIMAL(10, 2) },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  imageUrl: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  weight: { type: DataTypes.DECIMAL(8, 2) },
  dimensions: { type: DataTypes.JSONB }
}, { tableName: 'product_variants', timestamps: true });

// ShippingMethod Model
const ShippingMethod = sequelize.define('ShippingMethod', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  baseRate: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  perPoundRate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  perItemRate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  estimatedDays: { type: DataTypes.STRING },
  maxWeight: { type: DataTypes.DECIMAL(8, 2) },
  freeShippingThreshold: { type: DataTypes.DECIMAL(10, 2) },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, { tableName: 'shipping_methods', timestamps: true });

// ShippingZone Model
const ShippingZone = sequelize.define('ShippingZone', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  states: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  zipPrefixes: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  multiplier: { type: DataTypes.DECIMAL(5, 2), defaultValue: 1.00 },
  additionalFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, { tableName: 'shipping_zones', timestamps: true });

// InventoryAlert Model
const InventoryAlert = sequelize.define('InventoryAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  variantId: { type: DataTypes.INTEGER },
  type: { type: DataTypes.ENUM('low_stock', 'out_of_stock', 'overstock', 'reorder_needed'), allowNull: false },
  message: { type: DataTypes.TEXT },
  currentQuantity: { type: DataTypes.INTEGER },
  threshold: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('active', 'acknowledged', 'resolved'), defaultValue: 'active' },
  acknowledgedAt: { type: DataTypes.DATE },
  resolvedAt: { type: DataTypes.DATE }
}, { tableName: 'inventory_alerts', timestamps: true });

// PaymentMethod Model (for saved cards)
const PaymentMethod = sequelize.define('PaymentMethod', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  stripePaymentMethodId: { type: DataTypes.STRING, allowNull: false },
  brand: { type: DataTypes.STRING },
  last4: { type: DataTypes.STRING },
  expMonth: { type: DataTypes.INTEGER },
  expYear: { type: DataTypes.INTEGER },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  nickname: { type: DataTypes.STRING }
}, { tableName: 'payment_methods', timestamps: true });

// Association for PaymentMethod
User.hasMany(PaymentMethod, { foreignKey: 'userId' });
PaymentMethod.belongsTo(User, { foreignKey: 'userId' });

// Coupon Model
const Coupon = sequelize.define('Coupon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  discountType: { type: DataTypes.ENUM('percentage', 'fixed'), allowNull: false },
  discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  minOrderAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  maxDiscount: { type: DataTypes.DECIMAL(10, 2) },
  usageLimit: { type: DataTypes.INTEGER },
  usedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('active', 'inactive', 'expired'), defaultValue: 'active' },
  applicableProducts: { type: DataTypes.ARRAY(DataTypes.INTEGER), defaultValue: [] },
  applicableCategories: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] }
}, { tableName: 'coupons', timestamps: true });

// AuditLog Model
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER },
  userName: { type: DataTypes.STRING },
  action: { type: DataTypes.ENUM('create', 'update', 'delete'), allowNull: false },
  entityType: { type: DataTypes.STRING, allowNull: false },
  entityId: { type: DataTypes.INTEGER },
  entityName: { type: DataTypes.STRING },
  changes: { type: DataTypes.JSONB },
  ipAddress: { type: DataTypes.STRING },
  userAgent: { type: DataTypes.STRING }
}, { tableName: 'audit_logs', timestamps: true });

// AuditLog associations
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

// Define Associations
Product.hasMany(Pricing, { foreignKey: 'productId' });
Pricing.belongsTo(Product, { foreignKey: 'productId' });

Product.hasOne(Inventory, { foreignKey: 'productId' });
Inventory.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(Review, { foreignKey: 'productId' });
Review.belongsTo(Product, { foreignKey: 'productId' });

Customer.hasMany(Order, { foreignKey: 'customerId' });
Order.belongsTo(Customer, { foreignKey: 'customerId' });

Customer.hasMany(Review, { foreignKey: 'customerId' });
Review.belongsTo(Customer, { foreignKey: 'customerId' });

Product.hasMany(Content, { foreignKey: 'productId' });
Content.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(SalesForecast, { foreignKey: 'productId' });
SalesForecast.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(InventoryAlert, { foreignKey: 'productId' });
InventoryAlert.belongsTo(Product, { foreignKey: 'productId' });

// FraudAlert Model
const FraudAlert = sequelize.define('FraudAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER },
  customerId: { type: DataTypes.INTEGER },
  transactionId: { type: DataTypes.STRING },
  alertType: { type: DataTypes.ENUM('suspicious_order', 'velocity_check', 'address_mismatch', 'card_testing', 'account_takeover', 'refund_abuse'), allowNull: false },
  riskScore: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0-100
  riskLevel: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), defaultValue: 'low' },
  indicators: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  orderAmount: { type: DataTypes.DECIMAL(10, 2) },
  customerEmail: { type: DataTypes.STRING },
  ipAddress: { type: DataTypes.STRING },
  shippingAddress: { type: DataTypes.JSONB },
  billingAddress: { type: DataTypes.JSONB },
  aiAnalysis: { type: DataTypes.TEXT },
  aiRecommendation: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('pending', 'investigating', 'confirmed_fraud', 'false_positive', 'resolved'), defaultValue: 'pending' },
  reviewedBy: { type: DataTypes.INTEGER },
  reviewedAt: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT }
}, { tableName: 'fraud_alerts', timestamps: true });

// FraudAlert associations
Order.hasMany(FraudAlert, { foreignKey: 'orderId' });
FraudAlert.belongsTo(Order, { foreignKey: 'orderId' });
Customer.hasMany(FraudAlert, { foreignKey: 'customerId' });
FraudAlert.belongsTo(Customer, { foreignKey: 'customerId' });

// AbandonedCart Model
const AbandonedCart = sequelize.define('AbandonedCart', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  customerId: { type: DataTypes.INTEGER },
  customerEmail: { type: DataTypes.STRING, allowNull: false },
  customerName: { type: DataTypes.STRING },
  cartItems: { type: DataTypes.JSONB, defaultValue: [] }, // [{productId, name, price, quantity, imageUrl}]
  cartTotal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  cartItemCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  abandonedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  recoveryStage: { type: DataTypes.ENUM('identified', 'email_1_sent', 'email_2_sent', 'email_3_sent', 'recovered', 'expired'), defaultValue: 'identified' },
  recoveryEmailsSent: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastEmailSentAt: { type: DataTypes.DATE },
  aiPersonalizedMessage: { type: DataTypes.TEXT },
  aiRecommendedDiscount: { type: DataTypes.DECIMAL(5, 2) },
  aiRecoveryStrategy: { type: DataTypes.TEXT },
  discountCodeOffered: { type: DataTypes.STRING },
  discountAmount: { type: DataTypes.DECIMAL(10, 2) },
  deviceType: { type: DataTypes.STRING },
  exitPage: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('active', 'recovered', 'expired', 'unsubscribed'), defaultValue: 'active' },
  recoveredOrderId: { type: DataTypes.INTEGER },
  recoveredAt: { type: DataTypes.DATE },
  revenue: { type: DataTypes.DECIMAL(10, 2) }
}, { tableName: 'abandoned_carts', timestamps: true });

// AbandonedCart associations
Customer.hasMany(AbandonedCart, { foreignKey: 'customerId' });
AbandonedCart.belongsTo(Customer, { foreignKey: 'customerId' });

// Notification Model - for persistent notification history
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER },
  category: { type: DataTypes.STRING, allowNull: false }, // order, inventory, payment, review, system
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT },
  severity: { type: DataTypes.ENUM('info', 'warning', 'critical', 'success'), defaultValue: 'info' },
  data: { type: DataTypes.JSONB }, // Additional data like orderId, productId, etc.
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: { type: DataTypes.DATE }
}, { tableName: 'notifications', timestamps: true });

// Notification associations
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

export {
  sequelize,
  User,
  Product,
  Pricing,
  AdCampaign,
  Inventory,
  Customer,
  Order,
  Review,
  Content,
  MarketTrend,
  Competitor,
  ABTest,
  SalesForecast,
  CustomerSegment,
  Recommendation,
  ProductVariant,
  ShippingMethod,
  ShippingZone,
  InventoryAlert,
  PaymentMethod,
  Coupon,
  AuditLog,
  Notification,
  FraudAlert,
  AbandonedCart
};
