export function orderConfirmationTemplate(order) {
  const items = (order.items || []).map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name || 'Item'}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.price || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Order Confirmed!</h1>
      </div>
      <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
        <p>Thank you for your order! Here's your order summary:</p>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>

        <div style="border-top: 2px solid #eee; padding-top: 15px; margin-top: 15px;">
          <p style="margin: 5px 0;"><strong>Subtotal:</strong> $${parseFloat(order.subtotal || 0).toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Tax:</strong> $${parseFloat(order.tax || 0).toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Shipping:</strong> $${parseFloat(order.shipping || 0).toFixed(2)}</p>
          <p style="margin: 5px 0; font-size: 18px;"><strong>Total:</strong> $${parseFloat(order.total || 0).toFixed(2)}</p>
        </div>

        ${order.shippingAddress ? `
          <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <strong>Shipping Address:</strong><br>
            ${order.shippingAddress.street || ''}<br>
            ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zip || ''}
          </div>
        ` : ''}

        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          We'll send you a shipping update once your order is on its way.
        </p>
      </div>
    </body>
    </html>
  `;
}
