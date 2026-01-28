import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, generateToken, requireAdmin, requireManager, requireRole } from '../middleware/auth.js';
import openRouterService from '../services/openrouter.js';
import searchService from '../services/search.js';
import shippingService from '../services/shipping.js';
import inventoryAlertService from '../services/inventoryAlerts.js';
import recommendationEngine from '../services/recommendations.js';
import stripeService from '../services/stripe.js';
import emailService from '../services/email.js';
import {
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
  Notification
} from '../models/index.js';
import websocketService from '../services/websocket.js';
import { uploadSingle, uploadMultiple, getImageUrl } from '../services/upload.js';

const router = Router();

// ============================================
// AUTH ROUTES
// ============================================

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await user.update({ lastLogin: new Date() });
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'name', 'role', 'avatar', 'lastLogin']
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/demo-credentials', (req, res) => {
  res.json({
    email: process.env.DEMO_EMAIL || 'admin@ecommerce.ai',
    password: process.env.DEMO_PASSWORD || 'admin123'
  });
});

// ============================================
// DASHBOARD ROUTES
// ============================================

router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [
      productCount,
      orderCount,
      customerCount,
      totalRevenue,
      activeAds,
      pendingPricing,
      lowStockCount,
      pendingReviews,
      activeAlerts
    ] = await Promise.all([
      Product.count(),
      Order.count(),
      Customer.count(),
      Order.sum('total', { where: { paymentStatus: 'paid' } }),
      AdCampaign.count({ where: { status: 'active' } }),
      Pricing.count({ where: { status: 'pending' } }),
      Inventory.count({ where: { status: 'low_stock' } }),
      Review.count({ where: { responded: false } }),
      InventoryAlert.count({ where: { status: 'active' } })
    ]);

    res.json({
      products: productCount,
      orders: orderCount,
      customers: customerCount,
      revenue: totalRevenue || 0,
      activeAds,
      pendingPricing,
      lowStock: lowStockCount,
      pendingReviews,
      activeAlerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRODUCTS ROUTES
// ============================================

router.get('/products', authenticateToken, async (req, res) => {
  try {
    const products = await Product.findAll({
      include: [{ model: Inventory }],
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search routes (must be before :id routes)
router.get('/products/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit, offset } = req.query;
    const result = await searchService.search(q, parseInt(limit) || 20, parseInt(offset) || 0);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/search/suggest', authenticateToken, async (req, res) => {
  try {
    const suggestions = await searchService.suggest(req.query.q);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Inventory },
        { model: Pricing },
        { model: Review },
        { model: Content },
        { model: ProductVariant, as: 'variants' }
      ]
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products', authenticateToken, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    await Inventory.create({
      productId: product.id,
      quantity: req.body.quantity || 0,
      reorderPoint: req.body.reorderPoint || 10,
      reorderQuantity: req.body.reorderQuantity || 50,
      warehouse: req.body.warehouse || 'US-East'
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await product.update(req.body);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products/:id/ai-optimize', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const aiDescription = await openRouterService.generateProductDescription(product);
    await product.update({ description: aiDescription, aiOptimized: true, seoScore: 85 });
    res.json({ product, aiDescription });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRICING ROUTES
// ============================================

router.get('/pricing', authenticateToken, async (req, res) => {
  try {
    const pricing = await Pricing.findAll({
      include: [{ model: Product }],
      order: [['createdAt', 'DESC']]
    });
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const pricing = await Pricing.findByPk(req.params.id, {
      include: [{ model: Product }]
    });
    if (!pricing) {
      return res.status(404).json({ error: 'Pricing not found' });
    }
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pricing', authenticateToken, async (req, res) => {
  try {
    const pricing = await Pricing.create(req.body);
    res.status(201).json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const pricing = await Pricing.findByPk(req.params.id);
    if (!pricing) {
      return res.status(404).json({ error: 'Pricing not found' });
    }
    await pricing.update(req.body);
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pricing/:id/apply', authenticateToken, async (req, res) => {
  try {
    const pricing = await Pricing.findByPk(req.params.id, {
      include: [{ model: Product }]
    });
    if (!pricing) {
      return res.status(404).json({ error: 'Pricing not found' });
    }

    await pricing.Product.update({ currentPrice: pricing.suggestedPrice });
    await pricing.update({ status: 'applied' });
    res.json({ pricing, message: 'Price updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pricing/ai-suggest', authenticateToken, async (req, res) => {
  try {
    const { productId, competitorPrice, demandScore } = req.body;
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const suggestion = await openRouterService.generatePricingRecommendation(
      product, competitorPrice || product.currentPrice, demandScore || 50
    );
    res.json(JSON.parse(suggestion));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const pricing = await Pricing.findByPk(req.params.id);
    if (!pricing) {
      return res.status(404).json({ error: 'Pricing not found' });
    }
    await pricing.destroy();
    res.json({ message: 'Pricing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AD CAMPAIGNS ROUTES
// ============================================

router.get('/campaigns', authenticateToken, async (req, res) => {
  try {
    const campaigns = await AdCampaign.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await AdCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', authenticateToken, async (req, res) => {
  try {
    const campaign = await AdCampaign.create(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await AdCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    await campaign.update(req.body);
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await AdCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    await campaign.destroy();
    res.json({ message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns/:id/ai-generate-copy', authenticateToken, async (req, res) => {
  try {
    const campaign = await AdCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const adCopy = await openRouterService.generateAdCopy(campaign);
    const parsed = JSON.parse(adCopy);
    await campaign.update({ adCopy: `${parsed.headline}\n\n${parsed.body}`, aiGenerated: true });
    res.json({ campaign, adCopy: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INVENTORY ROUTES
// ============================================

router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.findAll({
      include: [{ model: Product }],
      order: [['updatedAt', 'DESC']]
    });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id, {
      include: [{ model: Product }]
    });
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    const newQuantity = req.body.quantity !== undefined ? req.body.quantity : inventory.quantity;
    let status = 'in_stock';
    if (newQuantity === 0) status = 'out_of_stock';
    else if (newQuantity <= inventory.reorderPoint) status = 'low_stock';
    else if (newQuantity > inventory.reorderQuantity * 2) status = 'overstocked';

    await inventory.update({ ...req.body, status });

    // Trigger inventory alert checks
    await inventoryAlertService.checkAndCreateAlerts(
      inventory.productId, newQuantity, inventory.reorderPoint
    );

    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const inventory = await Inventory.findByPk(req.params.id);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }
    await inventory.destroy();
    res.json({ message: 'Inventory deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMERS ROUTES
// ============================================

router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await Customer.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [{ model: Order }, { model: Review }]
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    await customer.update(req.body);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    await customer.destroy();
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ORDERS ROUTES
// ============================================

router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [{ model: Customer }],
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: Customer }]
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const orderNumber = `ORD-${Date.now()}`;
    const order = await Order.create({ ...req.body, orderNumber });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: Customer }]
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousStatus = order.status;
    await order.update(req.body);

    // Send shipping update email when status changes to shipped
    if (req.body.status === 'shipped' && previousStatus !== 'shipped' && order.Customer?.email) {
      emailService.sendShippingUpdate(order, order.Customer.email).catch(console.error);
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    await order.destroy();
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REVIEWS ROUTES
// ============================================

router.get('/reviews', authenticateToken, async (req, res) => {
  try {
    const reviews = await Review.findAll({
      include: [{ model: Product }],
      order: [['createdAt', 'DESC']]
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id, {
      include: [{ model: Product }, { model: Customer }]
    });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reviews/:id/ai-respond', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const analysis = await openRouterService.analyzeReviewSentiment(review);
    const parsed = JSON.parse(analysis);

    await review.update({
      sentiment: parsed.sentiment,
      sentimentScore: parsed.score,
      keywords: parsed.keywords,
      aiResponse: parsed.suggestedResponse,
      responded: true
    });

    res.json({ review, analysis: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    await review.destroy();
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI CONTENT ROUTES
// ============================================

router.get('/content', authenticateToken, async (req, res) => {
  try {
    const content = await Content.findAll({
      include: [{ model: Product }],
      order: [['createdAt', 'DESC']]
    });
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/content/:id', authenticateToken, async (req, res) => {
  try {
    const content = await Content.findByPk(req.params.id, {
      include: [{ model: Product }]
    });
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/content', authenticateToken, async (req, res) => {
  try {
    const content = await Content.create(req.body);
    res.status(201).json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/content/:id', authenticateToken, async (req, res) => {
  try {
    const content = await Content.findByPk(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    await content.update(req.body);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/content/:id', authenticateToken, async (req, res) => {
  try {
    const content = await Content.findByPk(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    await content.destroy();
    res.json({ message: 'Content deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/content/ai-generate', authenticateToken, async (req, res) => {
  try {
    const { type, context, title } = req.body;
    const generatedContent = await openRouterService.generateContent(type, context);

    const content = await Content.create({
      type,
      title: title || `AI Generated ${type}`,
      content: generatedContent,
      productId: context.productId,
      platform: context.platform,
      tone: context.tone || 'professional',
      wordCount: generatedContent.split(' ').length,
      seoScore: 80,
      status: 'draft',
      aiModel: 'gpt-4',
      generationPrompt: JSON.stringify(context)
    });

    res.status(201).json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MARKET TRENDS ROUTES
// ============================================

router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const trends = await MarketTrend.findAll({
      order: [['growthRate', 'DESC']]
    });
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trends/:id', authenticateToken, async (req, res) => {
  try {
    const trend = await MarketTrend.findByPk(req.params.id);
    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }
    res.json(trend);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/trends', authenticateToken, async (req, res) => {
  try {
    const trend = await MarketTrend.create(req.body);
    res.status(201).json(trend);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/trends/:id/ai-analyze', authenticateToken, async (req, res) => {
  try {
    const trend = await MarketTrend.findByPk(req.params.id);
    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    const insights = await openRouterService.generateTrendInsights(trend);
    await trend.update({ aiInsights: insights });
    res.json({ trend, insights });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/trends/:id', authenticateToken, async (req, res) => {
  try {
    const trend = await MarketTrend.findByPk(req.params.id);
    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }
    await trend.destroy();
    res.json({ message: 'Trend deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COMPETITORS ROUTES
// ============================================

router.get('/competitors', authenticateToken, async (req, res) => {
  try {
    const competitors = await Competitor.findAll({
      order: [['marketShare', 'DESC']]
    });
    res.json(competitors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const competitor = await Competitor.findByPk(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json(competitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/competitors', authenticateToken, async (req, res) => {
  try {
    const competitor = await Competitor.create(req.body);
    res.status(201).json(competitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const competitor = await Competitor.findByPk(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    await competitor.update(req.body);
    res.json(competitor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/competitors/:id/ai-analyze', authenticateToken, async (req, res) => {
  try {
    const competitor = await Competitor.findByPk(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    const analysis = await openRouterService.analyzeCompetitor(competitor);
    await competitor.update({ aiAnalysis: analysis, lastAnalyzed: new Date() });
    res.json({ competitor, analysis: JSON.parse(analysis) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const competitor = await Competitor.findByPk(req.params.id);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    await competitor.destroy();
    res.json({ message: 'Competitor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// A/B TESTS ROUTES
// ============================================

router.get('/ab-tests', authenticateToken, async (req, res) => {
  try {
    const tests = await ABTest.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ab-tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await ABTest.findByPk(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B Test not found' });
    }
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ab-tests', authenticateToken, async (req, res) => {
  try {
    const test = await ABTest.create(req.body);
    res.status(201).json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/ab-tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await ABTest.findByPk(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B Test not found' });
    }
    await test.update(req.body);
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ab-tests/:id/ai-analyze', authenticateToken, async (req, res) => {
  try {
    const test = await ABTest.findByPk(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B Test not found' });
    }

    const recommendation = await openRouterService.generateABTestRecommendation(test);
    await test.update({ aiRecommendation: recommendation });
    res.json({ test, recommendation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/ab-tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await ABTest.findByPk(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'A/B Test not found' });
    }
    await test.destroy();
    res.json({ message: 'A/B Test deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SALES FORECASTS ROUTES
// ============================================

router.get('/forecasts', authenticateToken, async (req, res) => {
  try {
    const forecasts = await SalesForecast.findAll({
      include: [{ model: Product }],
      order: [['forecastDate', 'DESC']]
    });
    res.json(forecasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/forecasts/:id', authenticateToken, async (req, res) => {
  try {
    const forecast = await SalesForecast.findByPk(req.params.id, {
      include: [{ model: Product }]
    });
    if (!forecast) {
      return res.status(404).json({ error: 'Forecast not found' });
    }
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forecasts', authenticateToken, async (req, res) => {
  try {
    const forecast = await SalesForecast.create(req.body);
    res.status(201).json(forecast);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forecasts/ai-generate', authenticateToken, async (req, res) => {
  try {
    const { productId, historicalData } = req.body;
    let product = null;
    if (productId) {
      product = await Product.findByPk(productId);
    }

    const forecastData = await openRouterService.generateSalesForecast(
      product,
      historicalData || { avgSales: 100, growthRate: 10, seasonality: 'normal' }
    );

    res.json(JSON.parse(forecastData));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/forecasts/:id', authenticateToken, async (req, res) => {
  try {
    const forecast = await SalesForecast.findByPk(req.params.id);
    if (!forecast) {
      return res.status(404).json({ error: 'Forecast not found' });
    }
    await forecast.destroy();
    res.json({ message: 'Forecast deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMER SEGMENTS ROUTES
// ============================================

router.get('/segments', authenticateToken, async (req, res) => {
  try {
    const segments = await CustomerSegment.findAll({
      order: [['totalRevenue', 'DESC']]
    });
    res.json(segments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/segments/:id', authenticateToken, async (req, res) => {
  try {
    const segment = await CustomerSegment.findByPk(req.params.id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    res.json(segment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/segments', authenticateToken, async (req, res) => {
  try {
    const segment = await CustomerSegment.create(req.body);
    res.status(201).json(segment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/segments/:id', authenticateToken, async (req, res) => {
  try {
    const segment = await CustomerSegment.findByPk(req.params.id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    await segment.update(req.body);
    res.json(segment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/segments/:id/ai-analyze', authenticateToken, async (req, res) => {
  try {
    const segment = await CustomerSegment.findByPk(req.params.id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    const insights = await openRouterService.generateSegmentInsights(segment);
    await segment.update({ aiInsights: insights });
    res.json({ segment, insights: JSON.parse(insights) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/segments/:id', authenticateToken, async (req, res) => {
  try {
    const segment = await CustomerSegment.findByPk(req.params.id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    await segment.destroy();
    res.json({ message: 'Segment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RECOMMENDATIONS ROUTES
// ============================================

router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const recommendations = await Recommendation.findAll({
      order: [['score', 'DESC']]
    });
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations/for-product/:productId', authenticateToken, async (req, res) => {
  try {
    const recommendations = await recommendationEngine.getRecommendationsForProduct(
      parseInt(req.params.productId)
    );
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations/for-customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const recommendations = await recommendationEngine.getRecommendationsForCustomer(
      parseInt(req.params.customerId)
    );
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recommendations/recalculate', authenticateToken, async (req, res) => {
  try {
    const count = await recommendationEngine.generateRecommendations();
    res.json({ message: `Generated ${count} recommendations`, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByPk(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    res.json(recommendation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recommendations', authenticateToken, async (req, res) => {
  try {
    const recommendation = await Recommendation.create(req.body);
    res.status(201).json(recommendation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByPk(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    await recommendation.update(req.body);
    res.json(recommendation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    const recommendation = await Recommendation.findByPk(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    await recommendation.destroy();
    res.json({ message: 'Recommendation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRODUCT VARIANTS ROUTES
// ============================================

router.get('/products/:productId/variants', authenticateToken, async (req, res) => {
  try {
    const variants = await ProductVariant.findAll({
      where: { productId: req.params.productId },
      order: [['createdAt', 'ASC']]
    });
    res.json(variants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products/:productId/variants', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const variant = await ProductVariant.create({
      ...req.body,
      productId: parseInt(req.params.productId)
    });

    if (!product.hasVariants) {
      await product.update({ hasVariants: true });
    }

    res.status(201).json(variant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products/:productId/variants/bulk', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const variants = await ProductVariant.bulkCreate(
      req.body.variants.map(v => ({ ...v, productId: parseInt(req.params.productId) }))
    );

    await product.update({ hasVariants: true });
    res.status(201).json(variants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/products/:productId/variants/:id', authenticateToken, async (req, res) => {
  try {
    const variant = await ProductVariant.findOne({
      where: { id: req.params.id, productId: req.params.productId }
    });
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    await variant.update(req.body);
    res.json(variant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:productId/variants/:id', authenticateToken, async (req, res) => {
  try {
    const variant = await ProductVariant.findOne({
      where: { id: req.params.id, productId: req.params.productId }
    });
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    await variant.destroy();

    const remainingCount = await ProductVariant.count({
      where: { productId: req.params.productId }
    });
    if (remainingCount === 0) {
      await Product.update({ hasVariants: false }, { where: { id: req.params.productId } });
    }

    res.json({ message: 'Variant deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHIPPING ROUTES
// ============================================

router.get('/shipping/methods', authenticateToken, async (req, res) => {
  try {
    const methods = await ShippingMethod.findAll({ order: [['baseRate', 'ASC']] });
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shipping/methods', authenticateToken, async (req, res) => {
  try {
    const method = await ShippingMethod.create(req.body);
    res.status(201).json(method);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/shipping/methods/:id', authenticateToken, async (req, res) => {
  try {
    const method = await ShippingMethod.findByPk(req.params.id);
    if (!method) return res.status(404).json({ error: 'Shipping method not found' });
    await method.update(req.body);
    res.json(method);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/shipping/methods/:id', authenticateToken, async (req, res) => {
  try {
    const method = await ShippingMethod.findByPk(req.params.id);
    if (!method) return res.status(404).json({ error: 'Shipping method not found' });
    await method.destroy();
    res.json({ message: 'Shipping method deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/shipping/zones', authenticateToken, async (req, res) => {
  try {
    const zones = await ShippingZone.findAll();
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shipping/zones', authenticateToken, async (req, res) => {
  try {
    const zone = await ShippingZone.create(req.body);
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/shipping/zones/:id', authenticateToken, async (req, res) => {
  try {
    const zone = await ShippingZone.findByPk(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Shipping zone not found' });
    await zone.update(req.body);
    res.json(zone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/shipping/zones/:id', authenticateToken, async (req, res) => {
  try {
    const zone = await ShippingZone.findByPk(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Shipping zone not found' });
    await zone.destroy();
    res.json({ message: 'Shipping zone deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shipping/calculate', authenticateToken, async (req, res) => {
  try {
    const { items, address } = req.body;
    const rates = await shippingService.calculateRates(items || [], address || {});
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INVENTORY ALERTS ROUTES
// ============================================

router.get('/inventory-alerts', authenticateToken, async (req, res) => {
  try {
    const alerts = await InventoryAlert.findAll({
      include: [{ model: Product }],
      order: [['createdAt', 'DESC']]
    });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory-alerts/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await inventoryAlertService.getAlertStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/inventory-alerts/:id/acknowledge', authenticateToken, async (req, res) => {
  try {
    const alert = await inventoryAlertService.acknowledgeAlert(req.params.id);
    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/inventory-alerts/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const alert = await inventoryAlertService.resolveAlert(req.params.id);
    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/inventory-alerts/check-all', authenticateToken, async (req, res) => {
  try {
    const alerts = await inventoryAlertService.checkAllInventory();
    res.json({ created: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYMENT ROUTES (STRIPE)
// ============================================

router.post('/payments/create-intent', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const result = await stripeService.createPaymentIntent(order);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payments/webhook', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = stripeService.verifyWebhookSignature(req.body, signature);
    const result = await stripeService.handleWebhookEvent(event);

    // Send order confirmation email on successful payment
    if (event.type === 'payment_intent.succeeded' && result.orderId) {
      const order = await Order.findByPk(result.orderId, {
        include: [{ model: Customer }]
      });
      if (order?.Customer?.email) {
        emailService.sendOrderConfirmation(order, order.Customer.email).catch(console.error);
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/payments/refund', authenticateToken, async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.paymentIntentId) return res.status(400).json({ error: 'No payment intent found' });

    // Handle demo/fake payments (for testing without real Stripe)
    if (order.paymentIntentId.startsWith('pi_test_demo')) {
      await order.update({
        refundId: `re_demo_${Date.now()}`,
        refundAmount: amount || order.total,
        paymentStatus: 'refunded',
        status: 'refunded'
      });
      return res.json({ refund: { id: order.refundId, status: 'succeeded' }, order });
    }

    // Real Stripe refund
    const refund = await stripeService.createRefund(order.paymentIntentId, amount);
    await order.update({
      refundId: refund.id,
      refundAmount: amount || order.total,
      paymentStatus: 'refunded',
      status: 'refunded'
    });

    res.json({ refund, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payments/pay-with-saved-card', authenticateToken, async (req, res) => {
  try {
    const { orderId, paymentMethodId } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const savedCard = await PaymentMethod.findOne({
      where: { id: paymentMethodId, userId: req.user.id }
    });
    if (!savedCard) return res.status(404).json({ error: 'Payment method not found' });

    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(req.user.id, stripe);

    // Create and confirm payment intent with saved card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(order.total) * 100),
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: savedCard.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      metadata: {
        orderId: order.id.toString(),
        orderNumber: order.orderNumber
      }
    });

    if (paymentIntent.status === 'succeeded') {
      await order.update({
        paymentIntentId: paymentIntent.id,
        stripeCustomerId,
        paymentStatus: 'paid',
        status: 'processing'
      });

      // Send order confirmation email
      const orderWithCustomer = await Order.findByPk(orderId, {
        include: [{ model: Customer }]
      });
      if (orderWithCustomer?.Customer?.email) {
        emailService.sendOrderConfirmation(orderWithCustomer, orderWithCustomer.Customer.email).catch(console.error);
      }

      res.json({ success: true, paymentIntentId: paymentIntent.id });
    } else {
      res.json({ success: false, error: 'Payment requires additional action', status: paymentIntent.status });
    }
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMAIL ROUTES
// ============================================

router.post('/email/test', authenticateToken, async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    const result = await emailService.sendEmail(
      to || 'test@example.com',
      subject || 'Test Email',
      `<p>${message || 'This is a test email from AI Commerce.'}</p>`
    );
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYMENT METHODS ROUTES (SAVED CARDS)
// ============================================

router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const methods = await PaymentMethod.findAll({
      where: { userId: req.user.id },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    // Get payment method details from Stripe
    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const stripeMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Attach to customer if needed
    let stripeCustomerId = await getOrCreateStripeCustomer(req.user.id, stripe);

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId
    });

    // Check if this is the first card (make it default)
    const existingCards = await PaymentMethod.count({ where: { userId: req.user.id } });
    const isDefault = existingCards === 0;

    const paymentMethod = await PaymentMethod.create({
      userId: req.user.id,
      stripePaymentMethodId: paymentMethodId,
      brand: stripeMethod.card?.brand,
      last4: stripeMethod.card?.last4,
      expMonth: stripeMethod.card?.exp_month,
      expYear: stripeMethod.card?.exp_year,
      isDefault
    });

    res.status(201).json(paymentMethod);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/payment-methods/:id', authenticateToken, async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Detach from Stripe
    const stripe = stripeService.getStripe();
    if (stripe) {
      try {
        await stripe.paymentMethods.detach(method.stripePaymentMethodId);
      } catch (e) {
        console.error('Failed to detach from Stripe:', e.message);
      }
    }

    const wasDefault = method.isDefault;
    await method.destroy();

    // If deleted was default, set another as default
    if (wasDefault) {
      const nextMethod = await PaymentMethod.findOne({
        where: { userId: req.user.id },
        order: [['createdAt', 'ASC']]
      });
      if (nextMethod) {
        await nextMethod.update({ isDefault: true });
      }
    }

    res.json({ message: 'Payment method removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/payment-methods/:id/default', authenticateToken, async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Remove default from all other methods
    await PaymentMethod.update(
      { isDefault: false },
      { where: { userId: req.user.id } }
    );

    // Set this one as default
    await method.update({ isDefault: true });

    res.json(method);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get or create Stripe customer
async function getOrCreateStripeCustomer(userId, stripe) {
  const user = await User.findByPk(userId);

  // Check if user already has a stripeCustomerId stored somewhere
  // For now, we'll create a new customer or find by email
  const customers = await stripe.customers.list({
    email: user.email,
    limit: 1
  });

  if (customers.data.length > 0) {
    return customers.data[0].id;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: userId.toString() }
  });

  return customer.id;
}

// ============================================
// GENERIC AI ANALYSIS ROUTE
// ============================================

router.post('/ai/analyze', authenticateToken, async (req, res) => {
  try {
    const { type, data } = req.body;

    const messages = [
      {
        role: 'system',
        content: 'You are an AI assistant for an e-commerce platform. Provide brief, actionable insights based on the data provided. Keep responses under 100 words and focus on practical recommendations.'
      },
      {
        role: 'user',
        content: `Analyze this ${type} data and provide insights: ${JSON.stringify(data)}`
      }
    ];

    const insight = await openRouterService.chat(messages);
    res.json({ insight, type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COUPON/DISCOUNT ROUTES
// ============================================

// Get all coupons
router.get('/coupons', authenticateToken, async (req, res) => {
  try {
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single coupon
router.get('/coupons/:id', authenticateToken, async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create coupon
router.post('/coupons', authenticateToken, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'create',
      entityType: 'Coupon',
      entityId: coupon.id,
      entityName: coupon.code,
      changes: { new: req.body },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update coupon
router.put('/coupons/:id', authenticateToken, async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    const oldData = coupon.toJSON();
    await coupon.update(req.body);
    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'update',
      entityType: 'Coupon',
      entityId: coupon.id,
      entityName: coupon.code,
      changes: { old: oldData, new: req.body },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete coupon
router.delete('/coupons/:id', authenticateToken, async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    const couponData = coupon.toJSON();
    await coupon.destroy();
    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'delete',
      entityType: 'Coupon',
      entityId: couponData.id,
      entityName: couponData.code,
      changes: { deleted: couponData },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate/Apply coupon to cart
router.post('/coupons/validate', authenticateToken, async (req, res) => {
  try {
    const { code, cartTotal, items } = req.body;
    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });

    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Coupon not found' });
    }

    // Check if active
    if (coupon.status !== 'active') {
      return res.status(400).json({ valid: false, error: 'Coupon is not active' });
    }

    // Check dates
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res.status(400).json({ valid: false, error: 'Coupon is not yet valid' });
    }
    if (coupon.endDate && new Date(coupon.endDate) < now) {
      return res.status(400).json({ valid: false, error: 'Coupon has expired' });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ valid: false, error: 'Coupon usage limit reached' });
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && cartTotal < parseFloat(coupon.minOrderAmount)) {
      return res.status(400).json({
        valid: false,
        error: `Minimum order amount is $${coupon.minOrderAmount}`
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = cartTotal * (parseFloat(coupon.discountValue) / 100);
      if (coupon.maxDiscount) {
        discount = Math.min(discount, parseFloat(coupon.maxDiscount));
      }
    } else {
      discount = parseFloat(coupon.discountValue);
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description
      },
      discount: discount.toFixed(2),
      newTotal: (cartTotal - discount).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use coupon (increment usage count)
router.post('/coupons/:id/use', authenticateToken, async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    await coupon.increment('usedCount');
    res.json({ success: true, usedCount: coupon.usedCount + 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUDIT LOG ROUTES
// ============================================

// Get audit logs with filtering
router.get('/audit-logs', authenticateToken, async (req, res) => {
  try {
    const { entityType, action, userId, startDate, endDate, limit = 100, offset = 0 } = req.query;

    const where = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      const { Op } = await import('sequelize');
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ total: count, logs: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get audit log stats
router.get('/audit-logs/stats', authenticateToken, async (req, res) => {
  try {
    const { Op, fn, col, literal } = await import('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, byAction, byEntity] = await Promise.all([
      AuditLog.count(),
      AuditLog.count({ where: { createdAt: { [Op.gte]: today } } }),
      AuditLog.findAll({
        attributes: ['action', [fn('COUNT', col('id')), 'count']],
        group: ['action']
      }),
      AuditLog.findAll({
        attributes: ['entityType', [fn('COUNT', col('id')), 'count']],
        group: ['entityType'],
        order: [[literal('count'), 'DESC']],
        limit: 10
      })
    ]);

    res.json({
      total: totalLogs,
      today: todayLogs,
      byAction: byAction.reduce((acc, item) => {
        acc[item.action] = parseInt(item.get('count'));
        return acc;
      }, {}),
      byEntity: byEntity.map(item => ({
        entityType: item.entityType,
        count: parseInt(item.get('count'))
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXPORT/REPORTS ROUTES
// ============================================

// Export orders to CSV
router.get('/export/orders', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const { Op } = await import('sequelize');

    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const orders = await Order.findAll({
      where,
      include: [{ model: Customer, attributes: ['name', 'email'] }],
      order: [['createdAt', 'DESC']]
    });

    // Build CSV
    const headers = ['Order ID', 'Customer', 'Email', 'Status', 'Total', 'Payment Status', 'Items', 'Created At'];
    const rows = orders.map(o => [
      o.orderId,
      o.Customer?.name || 'N/A',
      o.Customer?.email || 'N/A',
      o.status,
      o.total,
      o.paymentStatus,
      o.items?.length || 0,
      new Date(o.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=orders-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export products to CSV
router.get('/export/products', authenticateToken, async (req, res) => {
  try {
    const { category, status } = req.query;

    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const products = await Product.findAll({ where, order: [['name', 'ASC']] });

    const headers = ['ID', 'SKU', 'Name', 'Category', 'Price', 'Cost', 'Stock', 'Status', 'Created At'];
    const rows = products.map(p => [
      p.id,
      p.sku,
      p.name,
      p.category,
      p.currentPrice,
      p.cost,
      p.stockQuantity,
      p.status,
      new Date(p.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=products-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export customers to CSV
router.get('/export/customers', authenticateToken, async (req, res) => {
  try {
    const { segment, status } = req.query;

    const where = {};
    if (segment) where.segment = segment;
    if (status) where.status = status;

    const customers = await Customer.findAll({ where, order: [['name', 'ASC']] });

    const headers = ['ID', 'Name', 'Email', 'Phone', 'Segment', 'Total Orders', 'Lifetime Value', 'Status', 'Created At'];
    const rows = customers.map(c => [
      c.id,
      c.name,
      c.email,
      c.phone || 'N/A',
      c.segment,
      c.totalOrders,
      c.lifetimeValue,
      c.status,
      new Date(c.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=customers-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export inventory alerts to CSV
router.get('/export/inventory-alerts', authenticateToken, async (req, res) => {
  try {
    const { status, type } = req.query;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const alerts = await InventoryAlert.findAll({
      where,
      include: [{ model: Product, attributes: ['name', 'sku'] }],
      order: [['createdAt', 'DESC']]
    });

    const headers = ['ID', 'Product', 'SKU', 'Type', 'Status', 'Current Qty', 'Threshold', 'Message', 'Created At'];
    const rows = alerts.map(a => [
      a.id,
      a.Product?.name || 'N/A',
      a.Product?.sku || 'N/A',
      a.type,
      a.status,
      a.currentQuantity,
      a.threshold,
      a.message,
      new Date(a.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-alerts-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BULK ACTIONS ROUTES
// ============================================

// Bulk update products
router.post('/bulk/products', authenticateToken, async (req, res) => {
  try {
    const { ids, action, data } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No product IDs provided' });
    }

    let updated = 0;
    const { Op } = await import('sequelize');

    switch (action) {
      case 'update_status':
        [updated] = await Product.update({ status: data.status }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'update_category':
        [updated] = await Product.update({ category: data.category }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'adjust_price':
        const products = await Product.findAll({ where: { id: { [Op.in]: ids } } });
        for (const product of products) {
          let newPrice = parseFloat(product.currentPrice);
          if (data.adjustType === 'percentage') {
            newPrice = newPrice * (1 + data.adjustValue / 100);
          } else {
            newPrice = newPrice + data.adjustValue;
          }
          await product.update({ currentPrice: Math.max(0, newPrice).toFixed(2) });
          updated++;
        }
        break;
      case 'delete':
        updated = await Product.destroy({ where: { id: { [Op.in]: ids } } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: action === 'delete' ? 'delete' : 'update',
      entityType: 'Product',
      entityName: `Bulk action on ${ids.length} products`,
      changes: { action, ids, data },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, updated, message: `${updated} products updated` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update orders
router.post('/bulk/orders', authenticateToken, async (req, res) => {
  try {
    const { ids, action, data } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No order IDs provided' });
    }

    let updated = 0;
    const { Op } = await import('sequelize');

    switch (action) {
      case 'update_status':
        [updated] = await Order.update({ status: data.status }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'mark_shipped':
        [updated] = await Order.update({
          status: 'shipped',
          shippedAt: new Date()
        }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'mark_delivered':
        [updated] = await Order.update({
          status: 'delivered',
          deliveredAt: new Date()
        }, { where: { id: { [Op.in]: ids } } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'update',
      entityType: 'Order',
      entityName: `Bulk action on ${ids.length} orders`,
      changes: { action, ids, data },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, updated, message: `${updated} orders updated` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update customers
router.post('/bulk/customers', authenticateToken, async (req, res) => {
  try {
    const { ids, action, data } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No customer IDs provided' });
    }

    let updated = 0;
    const { Op } = await import('sequelize');

    switch (action) {
      case 'update_segment':
        [updated] = await Customer.update({ segment: data.segment }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'update_status':
        [updated] = await Customer.update({ status: data.status }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'delete':
        updated = await Customer.destroy({ where: { id: { [Op.in]: ids } } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: action === 'delete' ? 'delete' : 'update',
      entityType: 'Customer',
      entityName: `Bulk action on ${ids.length} customers`,
      changes: { action, ids, data },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, updated, message: `${updated} customers updated` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk resolve inventory alerts
router.post('/bulk/inventory-alerts', authenticateToken, async (req, res) => {
  try {
    const { ids, action } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No alert IDs provided' });
    }

    let updated = 0;
    const { Op } = await import('sequelize');

    switch (action) {
      case 'acknowledge':
        [updated] = await InventoryAlert.update({
          status: 'acknowledged',
          acknowledgedAt: new Date()
        }, { where: { id: { [Op.in]: ids } } });
        break;
      case 'resolve':
        [updated] = await InventoryAlert.update({
          status: 'resolved',
          resolvedAt: new Date()
        }, { where: { id: { [Op.in]: ids } } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true, updated, message: `${updated} alerts updated` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CUSTOMER ORDER HISTORY ROUTES
// ============================================

// Get order history for a customer
router.get('/customers/:id/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerId: req.params.id },
      order: [['createdAt', 'DESC']]
    });

    // Calculate stats
    const stats = {
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0),
      averageOrder: orders.length > 0
        ? orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) / orders.length
        : 0,
      ordersByStatus: orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ orders, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get purchase patterns for a customer
router.get('/customers/:id/purchase-patterns', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerId: req.params.id },
      order: [['createdAt', 'ASC']]
    });

    // Analyze purchase patterns
    const productFrequency = {};
    const categoryFrequency = {};
    let totalItems = 0;

    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          productFrequency[item.productId] = (productFrequency[item.productId] || 0) + item.quantity;
          if (item.category) {
            categoryFrequency[item.category] = (categoryFrequency[item.category] || 0) + item.quantity;
          }
          totalItems += item.quantity;
        });
      }
    });

    // Calculate average days between orders
    let avgDaysBetweenOrders = 0;
    if (orders.length > 1) {
      const daysDiffs = [];
      for (let i = 1; i < orders.length; i++) {
        const diff = (new Date(orders[i].createdAt) - new Date(orders[i-1].createdAt)) / (1000 * 60 * 60 * 24);
        daysDiffs.push(diff);
      }
      avgDaysBetweenOrders = daysDiffs.reduce((a, b) => a + b, 0) / daysDiffs.length;
    }

    res.json({
      totalOrders: orders.length,
      totalItems,
      avgDaysBetweenOrders: Math.round(avgDaysBetweenOrders),
      topProducts: Object.entries(productFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([productId, count]) => ({ productId: parseInt(productId), count })),
      topCategories: Object.entries(categoryFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOTIFICATIONS ROUTES
// ============================================

// Get all notifications for current user
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { unreadOnly, category, limit = 50, offset = 0 } = req.query;
    const { Op } = await import('sequelize');

    const where = {};
    // Show notifications for this user or broadcast notifications (userId = null)
    where[Op.or] = [{ userId: req.user.id }, { userId: null }];
    if (unreadOnly === 'true') where.read = false;
    if (category) where.category = category;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ total: count, notifications: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const { Op } = await import('sequelize');
    const count = await Notification.count({
      where: {
        [Op.or]: [{ userId: req.user.id }, { userId: null }],
        read: false
      }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    await notification.update({ read: true, readAt: new Date() });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const { Op } = await import('sequelize');
    const [updated] = await Notification.update(
      { read: true, readAt: new Date() },
      {
        where: {
          [Op.or]: [{ userId: req.user.id }, { userId: null }],
          read: false
        }
      }
    );
    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    await notification.destroy();
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a test notification (for testing)
router.post('/notifications/test', authenticateToken, async (req, res) => {
  try {
    const { category = 'system', title = 'Test Notification', message = 'This is a test notification', severity = 'info' } = req.body;

    // Create in database
    const notification = await Notification.create({
      userId: null, // broadcast to all
      category,
      title,
      message,
      severity,
      data: { test: true }
    });

    // Send via WebSocket
    websocketService.broadcast({
      category,
      title,
      message,
      severity,
      data: { notificationId: notification.id, test: true }
    });

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get WebSocket connection status
router.get('/notifications/ws-status', authenticateToken, async (req, res) => {
  try {
    res.json({
      connected: true,
      clients: websocketService.getConnectedClients()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// IMAGE UPLOAD ROUTES
// ============================================

// Upload single product image
router.post('/upload/product/:productId', authenticateToken, (req, res, next) => {
  req.params.type = 'products';
  next();
}, uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = getImageUrl(req.file.filename, 'products');

    // Update product with image URL
    const product = await Product.findByPk(req.params.productId);
    if (product) {
      // Store in images array or main image field
      const images = product.images || [];
      images.push(imageUrl);
      await product.update({ images, imageUrl: imageUrl });
    }

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: imageUrl
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple product images
router.post('/upload/products/:productId/multiple', authenticateToken, (req, res, next) => {
  req.params.type = 'products';
  next();
}, uploadMultiple, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: getImageUrl(file.filename, 'products')
    }));

    // Update product with image URLs
    const product = await Product.findByPk(req.params.productId);
    if (product) {
      const images = product.images || [];
      files.forEach(f => images.push(f.url));
      await product.update({ images, imageUrl: images[0] });
    }

    res.json({
      success: true,
      files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic file upload (for other purposes)
router.post('/upload/:type', authenticateToken, uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: getImageUrl(req.file.filename, req.params.type)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER MANAGEMENT ROUTES (Admin Only)
// ============================================

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'role', 'avatar', 'lastLogin', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID (admin only)
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'email', 'name', 'role', 'avatar', 'lastLogin', 'createdAt']
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user (admin only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      role: role || 'user'
    });

    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'create',
      entityType: 'User',
      entityId: user.id,
      entityName: user.email,
      changes: { email, name, role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { email, name, role, password } = req.body;
    const oldData = { email: user.email, name: user.name, role: user.role };

    const updateData = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);

    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'update',
      entityType: 'User',
      entityId: user.id,
      entityName: user.email,
      changes: { old: oldData, new: updateData },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const userData = { email: user.email, name: user.name, role: user.role };
    await user.destroy();

    // Log audit
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'delete',
      entityType: 'User',
      entityId: req.params.id,
      entityName: userData.email,
      changes: { deleted: userData },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats (admin only)
router.get('/users/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fn, col } = await import('sequelize');

    const [total, byRole, recentLogins] = await Promise.all([
      User.count(),
      User.findAll({
        attributes: ['role', [fn('COUNT', col('id')), 'count']],
        group: ['role']
      }),
      User.count({
        where: {
          lastLogin: {
            [await import('sequelize').then(m => m.Op.gte)]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      total,
      byRole: byRole.reduce((acc, item) => {
        acc[item.role] = parseInt(item.get('count'));
        return acc;
      }, {}),
      activeLastWeek: recentLogins
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update current user's profile
router.put('/users/me/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, avatar } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;

    await user.update(updateData);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change current user's password
router.put('/users/me/password', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
