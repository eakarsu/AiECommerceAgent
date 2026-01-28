export function shippingUpdateTemplate(order) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Your Order Has Shipped!</h1>
      </div>
      <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
        <p>Great news! Your order <strong>${order.orderNumber}</strong> is on its way.</p>

        ${order.trackingNumber ? `
          <div style="margin: 20px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px; color: #166534; font-weight: bold;">Tracking Number</p>
            <p style="margin: 0; font-size: 18px; font-family: monospace;">${order.trackingNumber}</p>
          </div>
        ` : ''}

        ${order.shippingAddress ? `
          <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <strong>Delivering to:</strong><br>
            ${order.shippingAddress.street || ''}<br>
            ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zip || ''}
          </div>
        ` : ''}

        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Thank you for shopping with us!
        </p>
      </div>
    </body>
    </html>
  `;
}
