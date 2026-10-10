// Development-only visual fixture. All API calls stay in memory; writes fail.
import { api } from '../src/services/api.js';
if (!import.meta.env.DEV || location.hostname !== '127.0.0.1' || location.port !== '5182') throw new Error('Use the isolated preview at 127.0.0.1:5182.');
const branch = {id:'qa-branch',name:'Main branch',status:'ACTIVE'};
const business = {id:'qa-shop',name:'Everyday Shop',currency:'UGX',status:'ACTIVE',businessType:'Retail shop',posMode:'RETAIL',useBrandTheme:false,branches:[branch],modules:['POS','INVENTORY','REPORTS','FINANCE','OPERATIONS'].map(key=>({key,active:true})),features:{}};
const user = {id:'qa-owner',name:'Alex',email:'alex@example.test',systemRole:'USER',memberships:[{businessId:business.id,role:{name:'Owner'}}]};
const products = Array.from({length:27},(_,index)=>({id:`product-${index}`,name:['Canvas tote','Ceramic mug','Travel pouch','Notebook','Water bottle','Gift bag'][index%6]+` ${index+1}`,type:'PHYSICAL',price:15000+index*1000,minimumPrice:10000,status:'ACTIVE',category:index%2?'Accessories':'Essentials',sku:`SKU-${String(index+1).padStart(3,'0')}`,barcode:'',unit:'piece'}));
const customers=Array.from({length:23},(_,index)=>({id:`customer-${index}`,name:`Customer ${index+1}`,email:`customer${index+1}@example.test`,phone:'0700 000 000',status:'ACTIVE',notes:''}));
const stockItems=products.map((product,index)=>({id:`stock-${index}`,productId:product.id,product,quantity:15+index,reorderLevel:5,branchId:branch.id,branch}));
const users=Array.from({length:14},(_,index)=>({id:`member-${index}`,role:{name:index?'Cashier':'Owner'},user:{...user,id:`user-${index}`,name:`Team member ${index+1}`,status:'ACTIVE'}}));
const sales=Array.from({length:23},(_,index)=>({id:`sale-${index}`,receiptNumber:`SALE-${String(index+1).padStart(4,'0')}`,createdAt:new Date().toISOString(),status:'COMPLETED',paymentMethod:'CASH',total:25000,subtotal:25000,discountAmount:0,taxAmount:0,branch,customer:customers[index],cashier:user,items:[{quantity:1,unitPrice:25000,total:25000,product:products[index]}]}));
business.type = 'Retail shop';
business.features = { typeKey: 'RETAIL_SHOP', profile: 'RETAIL' };
if (new URLSearchParams(location.search).get('role') === 'keeper') user.memberships[0].role.name = 'Store Keeper';
sales.forEach(sale => sale.items.forEach(item => { item.lineTotal = item.total; }));
api.defaults.adapter=async config=>{
  if(config.method!=='get') throw new Error('This visual preview does not save changes.');
  let data;
  if(config.url==='/auth/profile')data={user};
  else if(config.url==='/businesses')data={businesses:[business]};
  else if(config.url.startsWith('/products/'))data={products:products.filter(product=>(!config.params?.search||product.name.toLowerCase().includes(config.params.search.toLowerCase()))&&(!config.params?.category||product.category===config.params.category))};
  else if(config.url.startsWith('/customers/'))data={customers};
  else if(config.url.startsWith('/pos/sales/'))data={sales};
  else if(config.url.startsWith('/inventory/'))data={stockItems,recentAdjustments:[],valuation:user.memberships[0].role.name==='Owner'?{value:1240000,missingCostProducts:2}:null};
  else if(config.url.startsWith('/users/'))data={users};
  else if(config.url.startsWith('/reports/'))data={report:{recentReceipts:sales,expenses:{APPROVED:{amount:75000,count:3},PENDING:{amount:20000,count:1}}}};
  else if(config.url.startsWith('/money/')) {
    const accounts=[['CASH','Cash',150000],['BANK','Bank',800000],['MOMO','Mobile Money',250000],['CARD_CLEARING','Card payments awaiting settlement',50000]].map(([code,name,balance])=>({id:code,code,name,balance,kind:'ASSET',createdAt:new Date().toISOString()}));
    data={accounts:new URLSearchParams(location.search).get('money')==='new'?[]:accounts,postings:[{id:'qa-transfer',kind:'TRANSFER',amount:100000,note:'Cash deposited at bank',recordedBy:{name:'Alex'},createdAt:new Date().toISOString(),entries:[{account:accounts[0],amount:-100000},{account:accounts[1],amount:100000}]}],total:1,documents:[{id:'qa-purchase',kind:'PURCHASE',label:'PO-001 · Everyday supplier',outstanding:'75000.00'},{id:'qa-expense',kind:'EXPENSE',label:'Delivery transport',outstanding:'20000.00'}]};
  }
  else if(config.url.startsWith('/payroll/'))data={profiles:[{id:'profile-qa',employeeId:user.id,employee:{name:'Alex'},branchId:branch.id,branch,monthlyAmount:'350000',active:true}],employees:[user],entries:[{id:'payroll-qa',expense:{title:'Salary · Alex · 2026-10',status:'PENDING',amount:'350000'},paid:'0'}]};
  else if(config.url.startsWith('/finance/')&&config.url.endsWith('/cashflow'))data={tracking:{branches:1,tracked:1},accounts:[{id:'cash-qa',code:'CASH',name:'Cash',branch:branch.name,balance:'150000'},{id:'bank-qa',code:'BANK',name:'Bank',branch:branch.name,balance:'800000'},{id:'momo-qa',code:'MOMO',name:'Mobile Money',branch:branch.name,balance:'250000'},{id:'cards-qa',code:'CARD_CLEARING',name:'Card payments',branch:branch.name,balance:'50000'}],movements:[{kind:'SALE',amount:'575000'},{kind:'OTHER_INCOME',amount:'25000'},{kind:'CAPITAL',amount:'100000'},{kind:'EXPENSE',amount:'100000'},{kind:'PURCHASE',amount:'150000'}]};
  else if(config.url.startsWith('/finance/')&&config.url.endsWith('/expenses')){const expenses=[['Delivery transport','Transport',20000,'PENDING',0],['October rent','Rent',350000,'APPROVED',350000],['Packaging supplies','Supplies',65000,'APPROVED',25000],['Travel reimbursement','Travel',18000,'REJECTED',0]].map(([title,category,amount,status,paid],i)=>({id:`expense-${i}`,title,category,amount,status,paid,branch,recordedBy:{name:'Alex'},createdAt:new Date().toISOString()})).filter(e=>(!config.params?.status||e.status===config.params.status)&&(!config.params?.search||e.title.toLowerCase().includes(config.params.search.toLowerCase())));data={expenses,total:expenses.length};} 
  else if(config.url.startsWith('/finance/'))data={finance:{summary:{receiptCount:23,collectedTotal:575000,taxCollected:0,approvedExpenseTotal:100000,pendingExpenseCount:2},paymentRows:[{key:'CASH',label:'Cash',total:575000}],recentReceipts:sales,recentExpenses:[]}};
  else if(config.url.startsWith('/operations/'))data={operations:{products:{activeItems:products},inventory:{stockItems}}};
  else if(config.url.includes('/purchasing/')&&config.url.endsWith('/suppliers'))data={suppliers:[]};
  else if(config.url.includes('/purchasing/'))data={orders:[],total:0};
  else throw new Error(`No visual fixture for ${config.url}`);
  return {data,status:200,statusText:'OK',headers:{},config};
};
localStorage.setItem('zera_token','local-visual-fixture');
localStorage.setItem('zera_user',JSON.stringify(user));
window.zeraDesktop={apiBaseUrl:'http://127.0.0.1:5182/unused'};
await import('../src/main.jsx');
