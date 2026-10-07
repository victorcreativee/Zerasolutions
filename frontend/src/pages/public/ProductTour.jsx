import { useState } from 'react';
import { Search, Package, ReceiptText, BarChart3, Users, LayoutDashboard, ShoppingBag, Check, Utensils, BedDouble, Pill, ShoppingBasket } from 'lucide-react';

import CheckoutPreview from './CheckoutPreview';

const views = [
  { name: 'Retail POS', icon: ReceiptText, caption: 'Find a product, enter the agreed selling price, and prepare a receipt. Minimum prices protect your margins; cost prices stay private to the owner.' },
  { name: 'Inventory', icon: Package, caption: 'Receive deliveries, check low stock, and record physical counts. Stock movements give your team a record of what changed.' },
  { name: 'Operations', icon: BarChart3, caption: 'Review the day’s sales by payment method. Record a cash count and compare the drawer with expected cash.' },
  { name: 'Restaurant & bar POS', kind:'restaurant', icon: Utensils, subtitle:'Tables, orders & bills', caption:'Select a table, add food and drinks, then send the order. The cashier receives payment and closes the table bill.' },
  { name: 'Hotel service POS', kind:'hotel', icon: BedDouble, subtitle:'Guest services & charges', caption:'Select guest services or products, review the charges, and record payment. This preview shows front-desk checkout for services, rather than room reservations.' },
  { name: 'Pharmacy POS', kind:'pharmacy', icon: Pill, subtitle:'Product lookup & counter sales', caption:'Find products by name, SKU, or barcode, confirm quantities, and prepare the customer receipt. Customer lookup supports repeat visits.' },
  { name: 'Supermarket POS', kind:'supermarket', icon: ShoppingBasket, subtitle:'Scan, basket & payment', caption:'Scan or search products, build the customer basket, and review quantities and payment before recording the sale.' },
];
const products = [['Everyday tote','35,000'],['Ceramic mug','18,000'],['Notebook','12,000'],['Travel pouch','25,000'],['Water bottle','30,000'],['Gift bag','5,000']];

export function OfficialLogo() {
  return <span className="home-official-logo"><img src="/brand/zera-official.png" alt="Zera — Powering businesses in Africa" width="1774" height="887"/></span>;
}

export default function ProductTour() {
  const [view, setView] = useState(0);
  return <><div className="tour-selector" role="group" aria-label="Explore Zera screens">{[0,3,4,5,6,1,2].map(index=>{const item=views[index];return <button type="button" key={item.name} aria-pressed={view===index} onClick={()=>setView(index)}><item.icon size={22}/><span><strong>{item.name}</strong><small>{item.subtitle || ['Products, pricing & receipts','Stock levels & movements','Daily sales & cash counts'][index]}</small></span></button>;})}</div><div className="product-tour">
    <div className="tour-toolbar"><span><i/><i/><i/></span><span>Zera workspace · Sample data</span></div>
    <div className="tour-shell">
      <aside className="tour-sidebar"><OfficialLogo/><span className="tour-section-label">WORK</span><span><LayoutDashboard size={15}/>Dashboard</span>{views.map((item,index)=><button type="button" key={item.name} aria-pressed={view===index} className={view===index?'active':''} onClick={()=>setView(index)}><item.icon size={15}/>{item.name}</button>)}<span className="tour-section-label">COMMERCE</span><span><ShoppingBag size={15}/>Products</span><span><Users size={15}/>Customers</span><small>Sample Shop<br/>Main branch</small></aside>
      <div className="tour-workspace">
        <div className="tour-heading"><strong>{views[view].name}</strong><span>Main branch</span></div>
        <div className="tour-mobile-switch">{views.map((item,index)=><button type="button" key={item.name} aria-pressed={view===index} onClick={()=>setView(index)}>{item.name}</button>)}</div>
        {views[view].kind?<CheckoutPreview kind={views[view].kind}/>:view===0?<div className="tour-pos"><section className="tour-card"><h3>Product entry</h3><div className="tour-search"><Search size={14}/>Search product, SKU, or barcode</div><div className="tour-products">{products.map(([name,price])=><div key={name}><strong>{name}</strong><span>UGX {price}</span></div>)}</div><div className="tour-pagination">1–6 of 6 <span>Page 1 of 1</span></div></section><section className="tour-card tour-cart"><h3>Cart</h3><small>Walk-in customer</small><div className="tour-cart-line"><strong>Everyday tote</strong><span>1 × 35,000</span></div><div className="tour-cart-line"><strong>Ceramic mug</strong><span>1 × 18,000</span></div><div className="tour-total"><span>Total</span><strong>UGX 53,000</strong></div><small>Payment method</small><div className="tour-payment">Cash</div><div className="tour-action"><ReceiptText size={14}/>Review sale</div></section></div>:view===1?<section className="tour-card"><h3>Products in stock</h3><div className="tour-pills"><span>All stock</span><span>Low stock</span><span>Stock movements</span></div><table><thead><tr><th>Product</th><th>On hand</th><th>Status</th></tr></thead><tbody>{[['Everyday tote','24','In stock'],['Ceramic mug','3','Low stock'],['Notebook','48','In stock'],['Travel pouch','12','In stock']].map(row=><tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td><span className={row[2]==='Low stock'?'tour-warning':'tour-stock'}>{row[2]}</span></td></tr>)}</tbody></table><div className="tour-pagination"><Check size={13}/>Latest movement: 12 notebooks received</div></section>:<section className="tour-card"><h3>Daily sales</h3><div className="tour-stats"><div><small>Completed sales</small><strong>12</strong></div><div><small>Sales total</small><strong>UGX 284,000</strong></div></div><table><thead><tr><th>Payment method</th><th>Amount</th></tr></thead><tbody><tr><td>Cash</td><td>UGX 204,000</td></tr><tr><td>Mobile money</td><td>UGX 80,000</td></tr></tbody></table><div className="tour-cash"><strong>Cash count</strong><span>Expected: UGX 254,000</span><span>Counted: UGX 254,000</span><b>Balanced</b></div></section>}
      </div>
    </div>
    <p className="tour-caption" aria-live="polite">{views[view].caption}</p>
  </div></>;
}
