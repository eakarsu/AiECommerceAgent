export function reviewResponseTemplate(review, product) {
  const stars = Array(5).fill(0).map((_, i) =>
    i < review.rating ? '&#9733;' : '&#9734;'
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Thank You for Your Review!</h1>
      </div>
      <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
        <p>Hi ${review.customerName || 'Valued Customer'},</p>
        <p>Thank you for taking the time to review <strong>${product.name}</strong>.</p>

        <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 5px; color: #f59e0b; font-size: 24px;">${stars}</p>
          <p style="margin: 0 0 10px; font-weight: bold;">${review.title || ''}</p>
          <p style="margin: 0; color: #666; font-style: italic;">"${review.content || ''}"</p>
        </div>

        ${review.aiResponse ? `
          <div style="margin: 20px 0; padding: 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
            <p style="margin: 0 0 10px; font-weight: bold; color: #1e40af;">Our Response:</p>
            <p style="margin: 0; color: #1e3a5f;">${review.aiResponse}</p>
          </div>
        ` : ''}

        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Your feedback helps us improve. Thank you for being a valued customer!
        </p>
      </div>
    </body>
    </html>
  `;
}
