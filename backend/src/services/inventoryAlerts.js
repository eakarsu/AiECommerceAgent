import { InventoryAlert, Inventory, Product, ProductVariant } from '../models/index.js';
import { Op } from 'sequelize';

class InventoryAlertService {
  async checkAndCreateAlerts(productId, quantity, reorderPoint) {
    const alerts = [];

    if (quantity === 0) {
      const existing = await InventoryAlert.findOne({
        where: { productId, type: 'out_of_stock', status: { [Op.ne]: 'resolved' } }
      });
      if (!existing) {
        const alert = await InventoryAlert.create({
          productId,
          type: 'out_of_stock',
          message: `Product is out of stock`,
          currentQuantity: quantity,
          threshold: reorderPoint
        });
        alerts.push(alert);
      }
    } else if (quantity <= reorderPoint) {
      const existing = await InventoryAlert.findOne({
        where: { productId, type: 'low_stock', status: { [Op.ne]: 'resolved' } }
      });
      if (!existing) {
        const alert = await InventoryAlert.create({
          productId,
          type: 'low_stock',
          message: `Stock level (${quantity}) is at or below reorder point (${reorderPoint})`,
          currentQuantity: quantity,
          threshold: reorderPoint
        });
        alerts.push(alert);
      }
    }

    return alerts;
  }

  async checkAllInventory() {
    const inventoryItems = await Inventory.findAll({
      include: [{ model: Product }]
    });

    const alerts = [];
    for (const item of inventoryItems) {
      const newAlerts = await this.checkAndCreateAlerts(
        item.productId,
        item.quantity,
        item.reorderPoint
      );
      alerts.push(...newAlerts);
    }

    return alerts;
  }

  async resolveAlert(alertId) {
    const alert = await InventoryAlert.findByPk(alertId);
    if (!alert) throw new Error('Alert not found');

    await alert.update({
      status: 'resolved',
      resolvedAt: new Date()
    });
    return alert;
  }

  async acknowledgeAlert(alertId) {
    const alert = await InventoryAlert.findByPk(alertId);
    if (!alert) throw new Error('Alert not found');

    await alert.update({
      status: 'acknowledged',
      acknowledgedAt: new Date()
    });
    return alert;
  }

  async getAlertStats() {
    const [active, acknowledged, total] = await Promise.all([
      InventoryAlert.count({ where: { status: 'active' } }),
      InventoryAlert.count({ where: { status: 'acknowledged' } }),
      InventoryAlert.count()
    ]);

    const byType = await InventoryAlert.findAll({
      attributes: [
        'type',
        [InventoryAlert.sequelize.fn('COUNT', '*'), 'count']
      ],
      where: { status: { [Op.ne]: 'resolved' } },
      group: ['type'],
      raw: true
    });

    return { active, acknowledged, total, byType };
  }
}

export default new InventoryAlertService();
