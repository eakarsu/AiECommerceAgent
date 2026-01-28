import Stripe from 'stripe';
import { Order } from '../models/index.js';

class StripeService {
  constructor() {
    this.stripe = null;
  }

  getClient() {
    if (!this.stripe && process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return this.stripe;
  }

  getStripe() {
    return this.getClient();
  }

  async createPaymentIntent(order) {
    const stripe = this.getClient();
    if (!stripe) throw new Error('Stripe is not configured');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(order.total) * 100),
      currency: 'usd',
      metadata: {
        orderId: order.id.toString(),
        orderNumber: order.orderNumber
      }
    });

    await order.update({ paymentIntentId: paymentIntent.id });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  }

  async createRefund(paymentIntentId, amount) {
    const stripe = this.getClient();
    if (!stripe) throw new Error('Stripe is not configured');

    const refundParams = { payment_intent: paymentIntentId };
    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundParams);
    return refund;
  }

  async handleWebhookEvent(event) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const order = await Order.findOne({
          where: { paymentIntentId: paymentIntent.id }
        });
        if (order) {
          await order.update({
            paymentStatus: 'paid',
            status: 'processing'
          });
        }
        return { handled: true, orderId: order?.id };
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const order = await Order.findOne({
          where: { paymentIntentId: paymentIntent.id }
        });
        if (order) {
          await order.update({ paymentStatus: 'failed' });
        }
        return { handled: true, orderId: order?.id };
      }

      default:
        return { handled: false };
    }
  }

  verifyWebhookSignature(body, signature) {
    const stripe = this.getClient();
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook not configured');
    }

    return stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}

export default new StripeService();
