import { Order, Recommendation, Product } from '../models/index.js';
import { Op } from 'sequelize';

class RecommendationEngine {
  constructor() {
    this.scheduler = null;
  }

  async computeCoOccurrenceMatrix() {
    const orders = await Order.findAll({
      where: { status: { [Op.ne]: 'cancelled' } },
      attributes: ['items']
    });

    const coOccurrence = {};
    const productCounts = {};

    for (const order of orders) {
      const items = order.items || [];
      const productIds = items.map(i => i.productId).filter(Boolean);

      for (const id of productIds) {
        productCounts[id] = (productCounts[id] || 0) + 1;
      }

      for (let i = 0; i < productIds.length; i++) {
        for (let j = i + 1; j < productIds.length; j++) {
          const key = [productIds[i], productIds[j]].sort().join('-');
          coOccurrence[key] = (coOccurrence[key] || 0) + 1;
        }
      }
    }

    return { coOccurrence, productCounts };
  }

  computeScores(coOccurrence, productCounts) {
    const scores = [];

    for (const [key, count] of Object.entries(coOccurrence)) {
      const [idA, idB] = key.split('-').map(Number);
      const countA = productCounts[idA] || 1;
      const countB = productCounts[idB] || 1;

      // Jaccard-like similarity
      const union = countA + countB - count;
      const score = union > 0 ? count / union : 0;

      if (score > 0.05) {
        scores.push({ sourceProductId: idA, targetProductId: idB, score });
        scores.push({ sourceProductId: idB, targetProductId: idA, score });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  async generateRecommendations() {
    const { coOccurrence, productCounts } = await this.computeCoOccurrenceMatrix();
    const scores = this.computeScores(coOccurrence, productCounts);

    // Clear old computed recommendations
    await Recommendation.destroy({
      where: { aiModel: 'collaborative-filtering-auto' }
    });

    const recommendations = [];
    const seen = new Set();

    for (const { sourceProductId, targetProductId, score } of scores) {
      const key = `${sourceProductId}-${targetProductId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (recommendations.length >= 50) break;

      recommendations.push({
        type: 'cross_sell',
        sourceProductId,
        targetProductId,
        score: Math.min(score * 2, 0.99).toFixed(2),
        reason: `Frequently purchased together (co-occurrence score: ${(score * 100).toFixed(1)}%)`,
        aiModel: 'collaborative-filtering-auto',
        status: 'active'
      });
    }

    if (recommendations.length > 0) {
      await Recommendation.bulkCreate(recommendations);
    }

    return recommendations.length;
  }

  async getRecommendationsForProduct(productId) {
    return Recommendation.findAll({
      where: {
        sourceProductId: productId,
        status: 'active'
      },
      order: [['score', 'DESC']],
      limit: 10
    });
  }

  async getRecommendationsForCustomer(customerId) {
    const orders = await Order.findAll({
      where: { customerId, status: { [Op.ne]: 'cancelled' } },
      attributes: ['items'],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const purchasedProductIds = new Set();
    for (const order of orders) {
      for (const item of (order.items || [])) {
        if (item.productId) purchasedProductIds.add(item.productId);
      }
    }

    if (purchasedProductIds.size === 0) return [];

    const recommendations = await Recommendation.findAll({
      where: {
        sourceProductId: { [Op.in]: [...purchasedProductIds] },
        targetProductId: { [Op.notIn]: [...purchasedProductIds] },
        status: 'active'
      },
      order: [['score', 'DESC']],
      limit: 10
    });

    return recommendations;
  }

  scheduleRecalculation() {
    // Recalculate every 6 hours
    this.scheduler = setInterval(async () => {
      try {
        const count = await this.generateRecommendations();
        console.log(`Recommendations recalculated: ${count} generated`);
      } catch (error) {
        console.error('Recommendation recalculation failed:', error.message);
      }
    }, 6 * 60 * 60 * 1000);

    console.log('Recommendation scheduler started (every 6 hours)');
  }

  stopScheduler() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
  }
}

export default new RecommendationEngine();
