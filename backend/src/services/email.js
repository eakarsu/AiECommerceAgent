import nodemailer from 'nodemailer';
import { orderConfirmationTemplate } from '../templates/email/orderConfirmation.js';
import { shippingUpdateTemplate } from '../templates/email/shippingUpdate.js';
import { lowStockAlertTemplate } from '../templates/email/lowStockAlert.js';
import { reviewResponseTemplate } from '../templates/email/reviewResponse.js';
import { cartRecoveryEmailTemplate } from '../templates/email/cartRecoveryEmail.js';

class EmailService {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (!this.transporter && process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
    }
    return this.transporter;
  }

  getFromAddress() {
    const name = process.env.EMAIL_FROM_NAME || 'AI Commerce';
    const address = process.env.EMAIL_FROM_ADDRESS || 'noreply@ecommerce.ai';
    return `"${name}" <${address}>`;
  }

  async sendEmail(to, subject, html) {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.log(`Email not sent (SMTP not configured): ${subject} -> ${to}`);
      return null;
    }

    const info = await transporter.sendMail({
      from: this.getFromAddress(),
      to,
      subject,
      html
    });

    console.log(`Email sent: ${subject} -> ${to} (${info.messageId})`);
    return info;
  }

  async sendOrderConfirmation(order, customerEmail) {
    const html = orderConfirmationTemplate(order);
    return this.sendEmail(
      customerEmail,
      `Order Confirmation - ${order.orderNumber}`,
      html
    );
  }

  async sendShippingUpdate(order, customerEmail) {
    const html = shippingUpdateTemplate(order);
    return this.sendEmail(
      customerEmail,
      `Shipping Update - ${order.orderNumber}`,
      html
    );
  }

  async sendLowStockAlert(alert, product) {
    const adminEmail = process.env.EMAIL_FROM_ADDRESS || 'admin@ecommerce.ai';
    const html = lowStockAlertTemplate(alert, product);
    return this.sendEmail(
      adminEmail,
      `Low Stock Alert: ${product.name}`,
      html
    );
  }

  async sendReviewResponse(review, product, customerEmail) {
    const html = reviewResponseTemplate(review, product);
    return this.sendEmail(
      customerEmail,
      `Response to your review of ${product.name}`,
      html
    );
  }

  async sendCartRecoveryEmail(cart, customerEmail) {
    const html = cartRecoveryEmailTemplate(cart);
    const subject = cart.discountCodeOffered
      ? `${cart.discountAmount}% off your cart - Complete your purchase!`
      : `Don't forget your cart, ${cart.customerName || 'friend'}!`;
    return this.sendEmail(customerEmail, subject, html);
  }
}

export default new EmailService();
