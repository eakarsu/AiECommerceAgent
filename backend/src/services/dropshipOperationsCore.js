export const PURCHASE_TRANSITIONS = Object.freeze({
  ready: ['submitted','cancelled','failed'],
  submitted: ['accepted','backordered','cancelled','failed'],
  accepted: ['shipped','backordered','cancelled','failed'],
  backordered: ['accepted','cancelled','failed'],
  shipped: ['delivered','failed'],
  delivered: [], cancelled: [], failed: ['ready'],
});

export const SHIPMENT_TRANSITIONS = Object.freeze({
  label_pending: ['in_transit','delayed','lost'],
  in_transit: ['out_for_delivery','delivered','delayed','lost','returned'],
  out_for_delivery: ['delivered','delayed','returned'],
  delayed: ['in_transit','out_for_delivery','delivered','lost','returned'],
  lost: ['returned'], delivered: ['returned'], returned: [],
});

export function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function calculatePurchaseCost({ quantity, unitCost, shippingCost = 0 }) {
  const units = Math.trunc(numeric(quantity));
  const cost = numeric(unitCost, -1);
  const shipping = numeric(shippingCost, -1);
  if (units <= 0 || cost < 0 || shipping < 0) throw new Error('Positive quantity and non-negative supplier costs are required');
  return Number((units * cost + shipping).toFixed(2));
}

export function calculateCatalogControl({ supplierInventory, supplierUnitCost, previousSupplierCost, priceDriftLimit = 8 }) {
  const inventory = Math.trunc(numeric(supplierInventory, -1));
  const current = numeric(supplierUnitCost, -1);
  const previous = numeric(previousSupplierCost, current);
  if (inventory < 0 || current < 0 || previous < 0) throw new Error('Inventory and supplier costs must be non-negative');
  const priceDriftPercent = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
  const stockState = inventory === 0 ? 'out_of_stock' : inventory < 25 ? 'low' : 'healthy';
  const actionState = inventory === 0 ? 'pause_listing' : Math.abs(priceDriftPercent) >= numeric(priceDriftLimit, 8) ? 'review_price' : 'clear';
  return { priceDriftPercent, stockState, actionState };
}

export function assertTransition(map, current, next, label) {
  if (current === next) return;
  if (!map[current]?.includes(next)) throw new Error(`${label} cannot transition from ${current} to ${next}`);
}

export function canRouteOrder({ paymentStatus, riskStatus, supplierStockStatus, catalogStockState }) {
  const reasons = [];
  if (paymentStatus !== 'paid') reasons.push('Payment must be captured before supplier routing');
  if (riskStatus === 'hold') reasons.push('Risk hold must be resolved before supplier routing');
  if (supplierStockStatus === 'unavailable') reasons.push('Selected supplier is unavailable');
  if (catalogStockState === 'out_of_stock') reasons.push('Latest supplier inventory is out of stock');
  return { allowed: reasons.length === 0, reasons };
}
