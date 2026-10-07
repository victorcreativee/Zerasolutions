export function operationIssues(products, stocks, inventoryEnabled) {
  const balances = new Map(stocks.map(stock => [stock.productId, stock]));
  return products.filter(product => product.status === 'ACTIVE').map(product => {
    const stock = balances.get(product.id);
    const tracked = inventoryEnabled && product.type === 'PHYSICAL';
    const quantity = tracked ? Number(stock?.quantity || 0) : null;
    const issues = [];
    if (tracked && quantity <= 0) issues.push('Out of stock');
    else if (tracked && Number(stock?.reorderLevel) > 0 && quantity <= Number(stock.reorderLevel)) issues.push('Low stock');
    if (Number(product.price) === 0) issues.push('Manual price');
    if (Number(product.minimumPrice || 0) === 0) issues.push('No minimum price');
    if (product.type === 'PHYSICAL' && !product.sku && !product.barcode) issues.push('Missing code');
    return { key: product.id, product, issues, issue: issues.join(' · '), quantity };
  }).filter(row => row.issues.length).sort((a,b) => Number(b.issues.includes('Out of stock')) - Number(a.issues.includes('Out of stock')) || a.product.name.localeCompare(b.product.name));
}
