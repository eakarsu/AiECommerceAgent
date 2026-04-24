export function cartRecoveryEmailTemplate(cart) {
  const items = (cart.cartItems || []).map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px;">` : ''}
        ${item.name || 'Item'}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${parseFloat(item.price || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const hasDiscount = cart.discountCodeOffered && cart.discountAmount > 0;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Don't Leave Your Cart Behind!</h1>
        <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Your items are waiting for you</p>
      </div>

      <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none;">
        ${cart.aiPersonalizedMessage ? `
          <div style="background: #f8f5ff; border-left: 4px solid #8b5cf6; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #4c1d95; white-space: pre-line;">${cart.aiPersonalizedMessage}</p>
          </div>
        ` : `
          <p>Hi ${cart.customerName || 'there'},</p>
          <p>We noticed you left some amazing items in your cart. Complete your purchase today!</p>
        `}

        <h3 style="color: #333; margin-top: 25px;">Your Cart Items:</h3>
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
          <p style="margin: 5px 0; font-size: 18px; text-align: right;">
            <strong>Cart Total:</strong> $${parseFloat(cart.cartTotal || 0).toFixed(2)}
          </p>
        </div>

        ${hasDiscount ? `
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Special Offer Just For You!</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">${cart.discountAmount}% OFF</p>
            <p style="margin: 10px 0 0 0;">Use code: <strong style="background: white; color: #059669; padding: 5px 15px; border-radius: 4px; font-size: 18px;">${cart.discountCodeOffered}</strong></p>
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkout"
             style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Complete Your Purchase
          </a>
        </div>

        <p style="margin-top: 30px; color: #666; font-size: 14px; text-align: center;">
          Have questions? Reply to this email or contact our support team.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #eee; border-top: none;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          This email was sent because you have items in your cart.
          <a href="#" style="color: #8b5cf6;">Unsubscribe</a> from cart reminders.
        </p>
      </div>
    </body>
    </html>
  `;
}
