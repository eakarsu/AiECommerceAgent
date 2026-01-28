export function lowStockAlertTemplate(alert, product) {
  const typeColors = {
    low_stock: '#f59e0b',
    out_of_stock: '#ef4444',
    overstock: '#3b82f6',
    reorder_needed: '#8b5cf6'
  };

  const color = typeColors[alert.type] || '#6b7280';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${color}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Inventory Alert</h1>
      </div>
      <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="padding: 15px; background: #fef3cd; border: 1px solid #ffc107; border-radius: 8px; margin-bottom: 20px;">
          <strong>Alert Type:</strong> ${alert.type.replace('_', ' ').toUpperCase()}
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Product:</td>
            <td style="padding: 8px 0; font-weight: bold;">${product.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">SKU:</td>
            <td style="padding: 8px 0;">${product.sku}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Current Quantity:</td>
            <td style="padding: 8px 0; font-weight: bold; color: ${color};">${alert.currentQuantity}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Reorder Threshold:</td>
            <td style="padding: 8px 0;">${alert.threshold}</td>
          </tr>
        </table>

        <p style="margin-top: 20px;">${alert.message}</p>

        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Please take action to restock this item.
        </p>
      </div>
    </body>
    </html>
  `;
}
