import bcrypt from 'bcryptjs';

export function validateOwner(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) throw new Error('Enter the owner name.');
  if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) throw new Error('Enter a valid email.');
  if (typeof input.password !== 'string' || input.password.length < 12 || Buffer.byteLength(input.password) > 72) throw new Error('Use a password of at least 12 characters and at most 72 bytes.');
  if (typeof input.businessName !== 'string' || !input.businessName.trim() || input.businessName.length > 160) throw new Error('Enter the shop name.');
}

export async function provisionWorkspace(client, manifest, input) {
  validateOwner(input);
  const passwordHash = await bcrypt.hash(input.password, 12);
  return client.$transaction(async tx => {
    if (await tx.user.count() || await tx.business.count()) throw new Error('This database already has a workspace. Sign in with its existing account.');
    const source = manifest?.business || {};
    const brand = manifest?.branding || {};
    const receipt = manifest?.receipt || {};
    let packageId;
    if (manifest?.package?.key) {
      const plan = manifest.package;
      const created = await tx.platformPackage.create({data:{key:plan.key, name:plan.name || plan.key,
        maxBranches:plan.limits?.branches ?? null, maxUsers:plan.limits?.users ?? null, maxProducts:plan.limits?.products ?? null,
        modules:{create:(manifest.modules || []).map(({key,active}) => ({moduleKey:key,active}))}}});
      packageId = created.id;
    }
    let platformBusinessTypeId;
    if (source.typeKey && source.typeKey !== 'CUSTOM') {
      const type = await tx.platformBusinessType.create({data:{
        key:source.typeKey,value:source.type || 'Retail shop',label:source.type || 'Retail shop',
        posMode:source.posMode || 'RETAIL_CHECKOUT',
        defaultModuleKeys:(manifest.modules || []).filter(module=>module.active).map(module=>module.key),
        roles:(manifest.roles || []).map(role=>({name:role.name,description:role.description || null}))
      }});
      platformBusinessTypeId=type.id;
    }
    const business = await tx.business.create({ data: {
      platformBusinessTypeId,
      name: source.name || input.businessName.trim(), type: source.type || 'Retail shop', posMode: source.posMode || 'RETAIL_CHECKOUT',
      platformPackageId: packageId, packageStatus: manifest?.package?.status || 'ACTIVE',
      country: source.country || 'Uganda', currency: source.currency || 'UGX',
      logoUrl: brand.logoUrl || null, brandPrimaryColor: brand.primaryColor || null, brandSecondaryColor: brand.secondaryColor || null,
      useBrandTheme: Boolean(brand.useBrandTheme), receiptHeader: receipt.header || null, receiptFooter: receipt.footer || null,
      contactPhone: receipt.contactPhone || null, contactEmail: receipt.contactEmail || null, address: receipt.address || null,
      taxEnabled: Boolean(receipt.taxEnabled), taxName: receipt.taxName || 'VAT', taxRate: Number(receipt.taxRate) || 0,
      modules: { create: manifest?.modules?.length ? manifest.modules.map(({key, active}) => ({key, active})) : ['POS','INVENTORY','FINANCE','REPORTS','OPERATIONS'].map(key => ({key, active:true})) }
    } });
    const branchDefinitions = manifest?.branches?.length ? manifest.branches : [{name:'Main branch', status:'ACTIVE'}];
    const branchIds = new Map();
    for (const branch of branchDefinitions) {
      const created = await tx.branch.create({data:{businessId:business.id, name:branch.name, location:branch.location || null, status:branch.status || 'ACTIVE'}});
      if (branch.id) branchIds.set(branch.id, created.id);
      if (business.posMode === 'TABLE_SERVICE') await tx.pOSTable.createMany({data:Array.from({length:8}, (_,index) => ({businessId:business.id, branchId:created.id, name:String(index+1), seats:4}))});
    }
    if (manifest?.catalog) {
      if (manifest.catalog.version !== 1 || !Array.isArray(manifest.catalog.products)) throw new Error('Unsupported product transfer.');
      for (const item of manifest.catalog.products) {
        const {name,sku,barcode,type,category,unit,price,minimumPrice,status} = item;
        const product = await tx.product.create({data:{businessId:business.id,name,sku,barcode,type,category,unit,price,minimumPrice,status}});
        for (const stock of item.inventoryStocks || []) {
          const branchId = branchIds.get(stock.branchId);
          if (!branchId) throw new Error('Product stock references an unknown branch.');
          if (!Number.isSafeInteger(stock.quantity) || stock.quantity < 0 || !Number.isSafeInteger(stock.reorderLevel) || stock.reorderLevel < 0) throw new Error('Invalid opening stock.');
          await tx.inventoryStock.create({data:{businessId:business.id,productId:product.id,branchId,quantity:stock.quantity,reorderLevel:stock.reorderLevel}});
        }
      }
    }
    let ownerRole;
    const roles = new Map([['Owner', {name:'Owner'}], ['Manager', {name:'Manager'}], ['Cashier', {name:'Cashier'}]]);
    for (const role of manifest?.roles || []) roles.set(role.name, role);
    for (const role of roles.values()) {
      const created = await tx.role.create({data:{businessId:business.id, name:role.name, description:role.description || null}});
      if (role.name === 'Owner') ownerRole = created;
    }
    await tx.user.create({data:{name:input.name.trim(), email:input.email.trim().toLowerCase(), passwordHash,
      memberships:{create:{businessId:business.id, roleId:ownerRole.id}}}});
    return business;
  }, {timeout:120000});
}
