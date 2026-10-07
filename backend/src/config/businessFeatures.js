// Organization names and IDs must never determine feature access.
const profiles = {
  RETAIL_SHOP: 'RETAIL', ELECTRONICS_SHOP: 'RETAIL', SUPERMARKET: 'RETAIL', PHARMACY: 'RETAIL',
  BAR_RESTAURANT: 'TABLE_SERVICE', HOTEL: 'SERVICE'
};
const aliases = {'retail shop':'RETAIL_SHOP','electronics shop':'ELECTRONICS_SHOP','supermarket':'SUPERMARKET','pharmacy':'PHARMACY','bar and restaurant':'BAR_RESTAURANT','hotel':'HOTEL'};
export function businessFeatures(business) {
  const declared=business.platformBusinessType?.key;
  const legacy=String(business.type || '').trim();
  const typeKey=declared || (profiles[legacy.toUpperCase()] ? legacy.toUpperCase() : aliases[legacy.toLowerCase()]) || 'CUSTOM';
  const profile=profiles[typeKey] || (business.posMode==='TABLE_SERVICE'?'TABLE_SERVICE':'SERVICE');
  const modules=new Set((business.modules || []).filter(item=>item.active).map(item=>item.key));
  const operational=business.status!=='INACTIVE' && !['SUSPENDED','CANCELLED'].includes(business.packageStatus);
  const enabled=key=>operational&&modules.has(key);
  return {typeKey,profile,
    retailCheckout:enabled('POS')&&business.posMode!=='TABLE_SERVICE',
    tableService:enabled('POS')&&business.posMode==='TABLE_SERVICE',
    negotiatedPricing:enabled('POS'), // Shared pricing safeguards also apply to service/table sales.
    productIssues:enabled('OPERATIONS')&&profile==='RETAIL',
    dailySales:enabled('OPERATIONS')&&enabled('POS'),
    cashCounts:enabled('OPERATIONS')&&enabled('POS'),
    stockNotifications:enabled('INVENTORY'),
    cashNotifications:enabled('OPERATIONS')&&enabled('POS')
  };
}
export function withBusinessFeatures(business) {return {...business,features:businessFeatures(business)};}
