import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight, ArrowRight, Building2, Check, Package, ReceiptText, Users, BarChart3, Store, Utensils, Pill, BedDouble, Monitor } from 'lucide-react';
import './home.css';
import ProductTour, { OfficialLogo } from './ProductTour';

const businesses = [
  { name: 'Retail & shops', icon: Store, heading: 'Serve the customer. Keep the shop in view.', text: 'When the counter gets busy, your team needs a clear price, the right stock, and a receipt they can trust. Zera brings those steps together for retail shops, supermarkets, and electronics stores.', audience: 'For owners, cashiers, and store keepers', items: ['Sell at an agreed price, with minimum-price safeguards.', 'Keep cost prices private to the owner.', 'Follow low-stock alerts and receive supplier deliveries.'], label: 'A day in your shop', steps: [['Prepare the shelf','Add products, opening quantities, suggested prices, and minimum prices.'],['Make the sale','Search or scan a product, enter the selling price, choose payment, and issue a receipt.'],['Check the day','Review sales by payment method and compare the cash drawer with the expected balance.']], tools: ['Retail POS','Products','Purchasing','Inventory','Cash counts'] },
  { name: 'Food & drinks', icon: Utensils, heading: 'From the table to the till, keep everyone together.', text: 'Give waiters and cashiers a shared view of each table’s order. Your team can add items, prepare the bill, and record payment without passing the details from memory.', audience: 'For restaurants, bars, waiters, and cashiers', items: ['Keep open orders linked to their tables.', 'Hand the bill from waiter to cashier.', 'Review completed sales and payment totals.'], label: 'From order to payment', steps: [['Start at the table','Select a table and add the customer’s food and drinks.'],['Prepare the bill','Review the order and pass it to the cashier for payment.'],['Record payment','Choose the payment method, complete the sale, and issue a receipt.']], tools: ['Table orders','Product catalog','Bills & receipts','Sales history','Daily sales'] },
  { name: 'Pharmacies', icon: Pill, heading: 'Keep everyday counter work clear.', text: 'Bring your product catalog, counter sales, and stock records into one workspace. Staff can find an item quickly while the owner keeps a view of stock and daily takings.', audience: 'For pharmacy owners and counter teams', items: ['Find products by name, SKU, or barcode.', 'Save customer details and retrieve sales records.', 'Track stock levels and supplier deliveries.'], label: 'Your counter workflow', steps: [['Organize your catalog','Add products, prices, quantities, and low-stock thresholds.'],['Serve the customer','Find the items, review the selling prices, and record payment with a receipt.'],['Follow up on stock','Review stock alerts and record incoming deliveries or physical counts.']], tools: ['Counter POS','Customer records','Inventory','Purchasing','Sales history'] },
  { name: 'Hotels', icon: BedDouble, heading: 'A clearer record of front-desk charges.', text: 'Keep guest-facing services, customer details, and payments together. Zera helps the front desk record what was charged and gives managers a simple view of the day’s sales.', audience: 'For front-desk teams and managers', items: ['List services and products with their prices.', 'Link sales to saved customer details.', 'Issue receipts and review payment records.'], label: 'From service to receipt', steps: [['List your services','Set up chargeable services such as laundry, breakfast, or transfers.'],['Record the charge','Select the service and customer, then review the amount due.'],['Keep the payment record','Complete the sale and retrieve the receipt or daily totals when needed.']], tools: ['Service checkout','Customer records','Receipts','Sales history','Daily sales'] },
];

export default function HomePage() {
  const [selected, setSelected] = useState(0);
  const business = businesses[selected];
  return <div className="zera-home">
    <a className="home-skip" href="#home-main">Skip to content</a>
    <header className="home-nav home-wrap">
      <Link to="/" aria-label="Zera Solutions home"><OfficialLogo/></Link>
      <nav aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#business-types">Your business</a></nav>
      <Link className="home-login" to="/login">Sign in <ArrowUpRight size={16}/></Link>
    </header>

    <main id="home-main">
      <section className="home-hero home-wrap">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span/> A little clarity for your every day</p>
          <h1>Less busywork.<br/><em>More business.</em></h1>
          <p className="home-lead">Your sales, stock, and people. One thoughtful workspace that helps you get on with the work you love.</p>
          <div className="home-actions"><a className="home-primary" href="#business-types">Find your fit <ArrowRight size={18}/></a><a className="home-text-link" href="#features">Take a closer look <ArrowDown size={16}/></a></div>
          <p className="home-small">Powering businesses in Africa.</p>
        </div>
        <div className="home-visual" aria-label="Illustrative Zera workspace preview">
          <div className="home-orbit" aria-hidden="true"/>
          <div className="home-preview">
            <div className="home-preview-top"><OfficialLogo/><span>Sample workspace</span></div>
            <div className="home-preview-content"><p className="home-small">A GOOD DAY, ALL IN VIEW</p><h2>Hello, shop owner <span aria-hidden="true">✳</span></h2>
              <div className="home-preview-metrics"><div><span>Sales today</span><strong>UGX 284,000</strong><small>12 completed sales</small></div><div><span>Products</span><strong>86</strong><small>In your catalog</small></div></div>
              <div className="home-preview-row"><span className="home-mini-icon"><ReceiptText size={18}/></span><div><strong>Sale recorded</strong><span>Receipt ready for your customer</span></div><Check size={18}/></div>
              <div className="home-preview-row"><span className="home-mini-icon warm"><Package size={18}/></span><div><strong>A little stock check</strong><span>2 products running low</span></div><ArrowUpRight size={18}/></div>
              <div className="home-bars" aria-hidden="true">{[32,55,43,78,62,92,73,100,83,115,98,132].map((height,index)=><i key={index} style={{height}}/>)}</div>
              <p className="home-chart-caption">An example day at a glance</p>
            </div>
          </div>
          <div className="home-note"><span aria-hidden="true">↳</span> A place for everything.<br/>A little room to breathe.</div>
        </div>
      </section>

      <section id="features" className="home-features home-wrap">
        <div className="home-section-heading"><p className="home-eyebrow">THE EVERYDAY, MADE EASIER</p><h2>Less switching.<br/>More getting things done.</h2></div>
        <div className="home-product-intro"><p>Explore checkout for your business—from a shop basket to a restaurant table or a hotel service charge. Then see the stock and daily sales tools that support your team.</p><span>Interface previews · Choose a workflow below</span></div>
        <ProductTour/>
        <div className="home-feature-grid">{[
          [ReceiptText,'Make the sale.','Find an item, agree a price, and give your customer a clear receipt.'],
          [Package,'Know what’s on hand.','Track stock, record deliveries, and spot what needs attention.'],
          [Users,'Work as a team.','Give owners, managers, and staff the right tools for their work.'],
          [BarChart3,'See the day clearly.','Review sales and payment totals without piecing them together.'],
        ].map(([Icon,title,text],index)=><article key={title}><div className="home-feature-head"><Icon size={24}/><span>0{index+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section id="how-it-works" className="home-how home-wrap"><div className="home-section-heading"><p className="home-eyebrow">FROM SETUP TO YOUR FIRST SALE</p><h2>A workspace that fits your day.</h2></div><div className="home-how-grid">{[
        ['01','Make it yours','Your administrator sets up your business type, branches, modules, logo, and colors. Your team sees the tools assigned to them.'],
        ['02','Bring in your products','Add your catalog, opening stock, and selling prices. Owners can keep cost prices private and set minimum prices for the team.'],
        ['03','Get on with business','Find products, enter the agreed price, choose a payment method, and issue a receipt. Keep customer details when you need them.'],
        ['04','Know where you stand','Review sales, receive stock, follow up on low-stock alerts, and compare counted cash with the day’s expected balance.'],
      ].map(([number,title,text])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section id="business-types" className="home-businesses">
        <div className="home-wrap"><div className="home-section-heading"><p className="home-eyebrow">BUILT AROUND YOUR BUSINESS</p><h2>The right tools for your working day.</h2><p className="home-business-intro">A shop counter and a restaurant table work differently. Choose your business to see how Zera supports the people, tasks, and records behind it.</p></div>
          <div className="home-tabs" role="tablist" aria-label="Business types">{businesses.map((item,index)=><button key={item.name} type="button" role="tab" id={`business-tab-${index}`} aria-controls="business-panel" aria-selected={selected===index} tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{let next;if(event.key==='ArrowRight')next=(index+1)%businesses.length;if(event.key==='ArrowLeft')next=(index+businesses.length-1)%businesses.length;if(event.key==='Home')next=0;if(event.key==='End')next=businesses.length-1;if(next!==undefined){event.preventDefault();setSelected(next);document.getElementById(`business-tab-${next}`)?.focus();}}}><item.icon size={18}/>{item.name}</button>)}</div>
          <div className="home-business-panel" id="business-panel" role="tabpanel" aria-labelledby={`business-tab-${selected}`}>
            <div className="home-business-copy"><span className="home-business-audience">{business.audience}</span><h3>{business.heading}</h3><p>{business.text}</p><ul>{business.items.map(item=><li key={item}><Check size={17}/>{item}</li>)}</ul><a className="home-text-link" href="#features">Explore the workspace <ArrowUpRight size={17}/></a></div>
            <div className="home-workflow"><div className="home-counter-title"><business.icon size={21}/><strong>{business.label}</strong></div><ol>{business.steps.map(([title,text],index)=><li key={title}><span className="home-workflow-number">0{index+1}</span><div><h4>{title}</h4><p>{text}</p></div></li>)}</ol><div className="home-workflow-tools"><span>Tools for this workflow</span><div>{business.tools.map(tool=><span key={tool}>{tool}</span>)}</div></div></div>
          </div>
          <p className="home-business-availability">Your workspace is configured by business type, enabled modules, and each person’s role.</p>
        </div>
      </section>

      <section className="home-setup home-wrap"><div><p className="home-eyebrow">START WITH WHAT YOU NEED</p><h2>Your business.<br/>Your setup.</h2><p>Choose the modules that fit your day. Your administrator sets up your organization, branding, and team access.</p></div><div className="home-setup-options"><article><Monitor size={24}/><h3>In your browser</h3><p>Sign in to your organization’s hosted workspace from a supported browser.</p></article><article><Store size={24}/><h3>At your counter</h3><p>A configured desktop installation keeps local shop work on your computer.</p><small>Desktop deployment is arranged for each organization. Online–offline synchronization is still in development.</small></article></div></section>

      <section id="questions" className="home-faq home-wrap"><div><p className="home-eyebrow">A FEW GOOD QUESTIONS</p><h2>Before you begin.</h2></div><div>{[
        ['Is Zera just for retail shops?','No. Zera has workflows for retail and electronics shops, supermarkets, pharmacies, food and drink businesses, and hotel front desks. Your business type and enabled modules determine your workspace.'],
        ['Can my team have different access?','Yes. Owners, managers, and staff receive access according to their roles and the modules enabled for the organization.'],
        ['How do I get an account?','Your Zera administrator creates the organization and its first owner account. The owner can then add the team. If your business already uses Zera, ask your owner for your sign-in details.'],
        ['Will my online and desktop records stay in sync?','Automatic online–offline synchronization is still being developed. Confirm your deployment and data-transfer arrangement before using both for the same business.'],
      ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="home-closing home-wrap"><p className="home-eyebrow">A CALMER WAY TO RUN YOUR DAY</p><h2>Good business starts<br/>with a clear view.</h2><Link className="home-primary" to="/login">Open your workspace <ArrowRight size={18}/></Link></section>
    </main>
    <footer className="home-footer home-wrap"><Link to="/" aria-label="Zera Solutions home"><OfficialLogo/></Link><span>Built around your everyday.</span><Link to="/login">Sign in <ArrowUpRight size={15}/></Link><small>© {new Date().getFullYear()} Zera Solutions</small></footer>
  </div>;
}
