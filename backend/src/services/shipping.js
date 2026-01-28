import { ShippingMethod, ShippingZone } from '../models/index.js';

class ShippingService {
  async calculateRates(items, address) {
    const methods = await ShippingMethod.findAll({ where: { status: 'active' } });
    const zone = await this.getZoneForAddress(address);

    let totalWeight = 0;
    let totalItems = 0;
    let subtotal = 0;

    for (const item of items) {
      totalWeight += (parseFloat(item.weight) || 1) * (item.quantity || 1);
      totalItems += item.quantity || 1;
      subtotal += (parseFloat(item.price) || 0) * (item.quantity || 1);
    }

    const rates = methods.map(method => {
      if (method.maxWeight && totalWeight > parseFloat(method.maxWeight)) {
        return null;
      }

      let rate = parseFloat(method.baseRate);
      rate += parseFloat(method.perPoundRate || 0) * totalWeight;
      rate += parseFloat(method.perItemRate || 0) * totalItems;

      if (zone) {
        rate *= parseFloat(zone.multiplier || 1);
        rate += parseFloat(zone.additionalFee || 0);
      }

      // Check free shipping threshold
      if (method.freeShippingThreshold && subtotal >= parseFloat(method.freeShippingThreshold)) {
        rate = 0;
      }

      return {
        methodId: method.id,
        name: method.name,
        code: method.code,
        rate: Math.round(rate * 100) / 100,
        estimatedDays: method.estimatedDays,
        freeShipping: rate === 0
      };
    }).filter(Boolean);

    return rates.sort((a, b) => a.rate - b.rate);
  }

  async getZoneForAddress(address) {
    if (!address) return null;

    const zones = await ShippingZone.findAll({ where: { status: 'active' } });

    for (const zone of zones) {
      if (address.state && zone.states && zone.states.includes(address.state)) {
        return zone;
      }
      if (address.zip && zone.zipPrefixes) {
        for (const prefix of zone.zipPrefixes) {
          if (address.zip.startsWith(prefix)) {
            return zone;
          }
        }
      }
    }

    return null;
  }
}

export default new ShippingService();
