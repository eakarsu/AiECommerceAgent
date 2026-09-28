import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PURCHASE_TRANSITIONS, SHIPMENT_TRANSITIONS, assertTransition,
  calculateCatalogControl, calculatePurchaseCost, canRouteOrder,
} from './dropshipOperationsCore.js';

test('purchase cost includes quantity and one shipment charge', () => {
  assert.equal(calculatePurchaseCost({ quantity: 3, unitCost: 11.39, shippingCost: 2.5 }), 36.67);
});

test('catalog control pauses an out-of-stock listing', () => {
  assert.deepEqual(calculateCatalogControl({ supplierInventory: 0, supplierUnitCost: 12, previousSupplierCost: 10 }), {
    priceDriftPercent: 20, stockState: 'out_of_stock', actionState: 'pause_listing',
  });
});

test('catalog control flags material cost drift', () => {
  assert.deepEqual(calculateCatalogControl({ supplierInventory: 100, supplierUnitCost: 10.9, previousSupplierCost: 10, priceDriftLimit: 8 }), {
    priceDriftPercent: 9, stockState: 'healthy', actionState: 'review_price',
  });
});

test('catalog control clears stable inventory and cost', () => {
  assert.deepEqual(calculateCatalogControl({ supplierInventory: 100, supplierUnitCost: 10.5, previousSupplierCost: 10, priceDriftLimit: 8 }), {
    priceDriftPercent: 5, stockState: 'healthy', actionState: 'clear',
  });
});

test('routing gate rejects unpaid and held orders', () => {
  assert.deepEqual(canRouteOrder({ paymentStatus: 'pending', riskStatus: 'hold', supplierStockStatus: 'available', catalogStockState: 'healthy' }), {
    allowed: false,
    reasons: ['Payment must be captured before supplier routing','Risk hold must be resolved before supplier routing'],
  });
});

test('routing gate accepts a paid, clear, available order', () => {
  assert.deepEqual(canRouteOrder({ paymentStatus: 'paid', riskStatus: 'clear', supplierStockStatus: 'available', catalogStockState: 'healthy' }), { allowed: true, reasons: [] });
});

test('purchase transitions reject skipping supplier acceptance', () => {
  assert.throws(() => assertTransition(PURCHASE_TRANSITIONS,'submitted','shipped','Purchase order'), /cannot transition/);
  assert.doesNotThrow(() => assertTransition(PURCHASE_TRANSITIONS,'submitted','accepted','Purchase order'));
});

test('shipment transitions permit recovery from delay but reject delivery reversal', () => {
  assert.doesNotThrow(() => assertTransition(SHIPMENT_TRANSITIONS,'delayed','in_transit','Shipment'));
  assert.throws(() => assertTransition(SHIPMENT_TRANSITIONS,'delivered','in_transit','Shipment'), /cannot transition/);
});
