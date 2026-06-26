import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ReceiptText, Search, ShoppingCart, Store, Table2, Trash2, UserRound, X } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../../components/Button.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createPOSTable, createSale, getPOSTables, getPOSReadiness } from "../../services/posService.js";
import { getCustomers } from "../../services/customerService.js";
import { getProducts } from "../../services/productService.js";

export default function POSPage() {
  const { activeBranch, activeBranchId, activeBusiness, activeBusinessId, activeRoleName } = useWorkspace();
  const [readiness, setReadiness] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [productError, setProductError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [tableError, setTableError] = useState("");
  const [saleError, setSaleError] = useState("");
  const [saleMessage, setSaleMessage] = useState("");
  const [readinessError, setReadinessError] = useState("");
  const branchReady = readiness?.checks?.branchActive ?? activeBranch?.status === "ACTIVE";
  const posReady = readiness?.checks?.posActive ?? true;
  const roleReady = readiness?.checks?.roleAllowed ?? Boolean(activeRoleName);
  const workspaceReady = Boolean(activeBusiness && activeBranch && branchReady && posReady && roleReady);
  const posMode = getEffectivePOSMode(activeBusiness);
  const isTableService = posMode === "TABLE_SERVICE";
  const modeInfo = getPOSModeInfo(posMode, activeRoleName, activeBusiness?.type);
  const ModeIcon = modeInfo.icon;
  const canManageTables = ["Owner", "Manager"].includes(activeRoleName);
  const subtotal = cartItems.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0);
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const reviewDisabledReason = !cartItems.length
    ? "Add products to the cart first."
    : isTableService && !selectedTableId
      ? "Select a table before reviewing the bill."
      : "";
  const productCategories = useMemo(() => {
    const categories = products.map((product) => product.category).filter(Boolean);
    return [...new Set(categories)].sort((first, second) => first.localeCompare(second));
  }, [products]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );
  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [tables, selectedTableId]
  );
  const totals = [
    { label: "Subtotal", value: formatMoney(subtotal, activeBusiness?.currency) },
    { label: "Tax", value: formatMoney(0, activeBusiness?.currency) },
    { label: "Discount", value: formatMoney(0, activeBusiness?.currency) }
  ];

  useEffect(() => {
    if (!activeBusinessId || !activeBranchId) {
      setReadiness(null);
      return;
    }

    async function loadReadiness() {
      try {
        setReadinessError("");
        const data = await getPOSReadiness(activeBusinessId, activeBranchId);
        setReadiness(data);
      } catch (apiError) {
        setReadinessError(apiError.response?.data?.message || "Unable to load POS readiness.");
      }
    }

    loadReadiness();
  }, [activeBranchId, activeBusinessId]);

  useEffect(() => {
    if (!activeBusinessId) {
      setProducts([]);
      return;
    }

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        setProductError("");
        const params = {
          status: "ACTIVE",
          ...(productSearch ? { q: productSearch } : {}),
          ...(productCategoryFilter ? { category: productCategoryFilter } : {})
        };
        const data = await getProducts(activeBusinessId, params);
        setProducts(data);
      } catch (apiError) {
        setProductError(apiError.response?.data?.message || "Unable to load products.");
      } finally {
        setLoadingProducts(false);
      }
    }

    const timeout = window.setTimeout(loadProducts, 250);
    return () => window.clearTimeout(timeout);
  }, [activeBusinessId, productSearch, productCategoryFilter]);

  useEffect(() => {
    if (!activeBusinessId) {
      setCustomers([]);
      setSelectedCustomerId("");
      return;
    }

    async function loadCustomers() {
      try {
        setLoadingCustomers(true);
        setCustomerError("");
        const data = await getCustomers(activeBusinessId, {
          status: "ACTIVE",
          ...(customerSearch ? { q: customerSearch } : {})
        });
        setCustomers(data);
        setSelectedCustomerId((current) => (data.some((customer) => customer.id === current) ? current : ""));
      } catch (apiError) {
        setCustomerError(apiError.response?.data?.message || "Unable to load customers.");
      } finally {
        setLoadingCustomers(false);
      }
    }

    const timeout = window.setTimeout(loadCustomers, 250);
    return () => window.clearTimeout(timeout);
  }, [activeBusinessId, customerSearch]);

  useEffect(() => {
    if (!activeBusinessId || !activeBranchId || !isTableService) {
      setTables([]);
      setSelectedTableId("");
      return;
    }

    loadTables();
  }, [activeBusinessId, activeBranchId, isTableService]);

  async function loadTables() {
    try {
      setLoadingTables(true);
      setTableError("");
      const data = await getPOSTables(activeBusinessId, activeBranchId);
      setTables(data);
      setSelectedTableId((current) => (data.some((table) => table.id === current) ? current : data[0]?.id || ""));
    } catch (apiError) {
      setTableError(apiError.response?.data?.message || "Unable to load POS tables.");
    } finally {
      setLoadingTables(false);
    }
  }

  function addToCart(product) {
    setCartItems((current) => {
      const existingItem = current.find((item) => item.product.id === product.id);

      if (existingItem) {
        return current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function updateCartQuantity(productId, quantity) {
    setCartItems((current) => {
      if (quantity <= 0) {
        return current.filter((item) => item.product.id !== productId);
      }

      return current.map((item) => (item.product.id === productId ? { ...item, quantity } : item));
    });
  }

  function removeFromCart(productId) {
    setCartItems((current) => current.filter((item) => item.product.id !== productId));
  }

  async function handleCreateTable(event) {
    event.preventDefault();

    if (!activeBusinessId || !activeBranchId || !newTableName.trim()) {
      return;
    }

    try {
      setTableError("");
      const table = await createPOSTable({
        businessId: activeBusinessId,
        branchId: activeBranchId,
        name: newTableName,
        seats: 4
      });
      setTables((current) => [...current, table]);
      setSelectedTableId(table.id);
      setNewTableName("");
    } catch (apiError) {
      setTableError(apiError.response?.data?.message || "Unable to add table.");
    }
  }

  async function handleRecordSale() {
    if (!activeBusinessId || !activeBranchId || !cartItems.length) {
      return;
    }

    setSavingSale(true);
    setSaleError("");
    setSaleMessage("");

    try {
      const sale = await createSale({
        businessId: activeBusinessId,
        branchId: activeBranchId,
        customerId: selectedCustomerId || undefined,
        tableId: isTableService ? selectedTableId : undefined,
        paymentMethod,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity
        }))
      });
      setCartItems([]);
      setReviewOpen(false);
      setSaleMessage(`Sale recorded: ${sale.receiptNumber}`);
    } catch (apiError) {
      setSaleError(apiError.response?.data?.detail || apiError.response?.data?.message || "Unable to record sale.");
    } finally {
      setSavingSale(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-zera-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Zera POS</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {activeBranch ? `${activeBranch.name} ${modeInfo.shortTitle}` : modeInfo.title}
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-zera-muted">
              {modeInfo.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={activeBusiness?.name || "No business"} ready={Boolean(activeBusiness)} />
            <StatusPill label={posModeLabel(posMode)} ready={Boolean(activeBusiness)} />
            <StatusPill label={activeBranch?.name || "No branch"} ready={branchReady} />
            <StatusPill label={activeRoleName || "No role"} ready={roleReady} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          {isTableService ? (
            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                    <Table2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Table service</h3>
                    <p className="text-sm text-zera-muted">
                      {loadingTables ? "Loading tables..." : `${tables.length} table${tables.length === 1 ? "" : "s"} for this branch`}
                    </p>
                  </div>
                </div>
                {selectedTable ? (
                  <div className="rounded-md bg-zera-mint px-3 py-2 text-sm font-semibold text-zera-green">
                    Current: {selectedTable.name}
                  </div>
                ) : null}
              </div>

              {tableError ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{tableError}</p> : null}

              <div className="grid gap-2 sm:grid-cols-4">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    className={`min-h-16 rounded-md border px-3 text-left transition ${
                      selectedTableId === table.id ? "border-zera-green bg-zera-mint text-zera-ink" : "border-zera-line bg-[#f7faf8] hover:border-zera-green"
                    }`}
                    onClick={() => setSelectedTableId(table.id)}
                  >
                    <span className="block font-bold">{table.name}</span>
                    <span className="mt-1 block text-xs text-zera-muted">
                      {table.seats} seats · {formatTableStatus(table.status)}
                    </span>
                  </button>
                ))}
              </div>

              {!loadingTables && !tables.length ? (
                <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">
                  No tables exist for this branch yet. Owners and managers can add the first table below.
                </div>
              ) : null}

              {canManageTables ? (
                <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleCreateTable}>
                  <label className="block">
                    <span className="sr-only">New table name</span>
                    <input
                      className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                      value={newTableName}
                      onChange={(event) => setNewTableName(event.target.value)}
                      placeholder="Add table, e.g. Patio 4"
                    />
                  </label>
                  <Button type="submit" variant="secondary" className="gap-2" disabled={!newTableName.trim()}>
                    <Plus size={17} />
                    Add table
                  </Button>
                </form>
              ) : null}
            </section>
          ) : (
            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                    <ModeIcon size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Retail checkout</h3>
                    <p className="text-sm text-zera-muted">Counter sale mode for shops, supermarkets, pharmacies, and quick-service businesses.</p>
                  </div>
                </div>
                <div className="rounded-md bg-zera-mint px-3 py-2 text-sm font-semibold text-zera-green">No table required</div>
              </div>
            </section>
          )}

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold">Product entry</h3>
                <p className="mt-1 text-sm text-zera-muted">{modeInfo.productEntryHint}</p>
              </div>
              <div className={`rounded-md px-3 py-2 text-sm font-semibold ${workspaceReady ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
                {workspaceReady ? "Register ready" : "Setup needed"}
              </div>
            </div>

            <div className="mt-5">
              <label className="flex min-h-14 items-center gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-4">
                <Search size={20} className="text-zera-muted" />
                <input
                  className="w-full border-0 bg-transparent text-base outline-none"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search product, category, SKU, or barcode"
                />
              </label>
            </div>

            {productCategories.length ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  className={`min-h-9 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                    productCategoryFilter === "" ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                  }`}
                  onClick={() => setProductCategoryFilter("")}
                >
                  All categories
                </button>
                {productCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`min-h-9 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                      productCategoryFilter === category ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                    }`}
                    onClick={() => setProductCategoryFilter(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}

            {productError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{productError}</p> : null}
            {saleMessage ? <p className="mt-4 rounded-md bg-zera-mint px-3 py-2 text-sm font-semibold text-zera-green">{saleMessage}</p> : null}
            {readinessError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{readinessError}</p> : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {!loadingProducts && products.length === 0 ? (
                <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted sm:col-span-2 lg:col-span-3">
                  No active products found. Owners and managers can add products from the Products page.
                </div>
              ) : null}

              {loadingProducts ? (
                <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted sm:col-span-2 lg:col-span-3">
                  Loading products...
                </div>
              ) : null}

              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={!workspaceReady}
                  className="min-h-24 rounded-md border border-zera-line bg-[#f7faf8] px-4 text-left transition hover:border-zera-green hover:bg-zera-mint disabled:cursor-not-allowed disabled:hover:border-zera-line disabled:hover:bg-[#f7faf8]"
                  onClick={() => addToCart(product)}
                >
                  <span className="block font-bold text-zera-ink">{product.name}</span>
                  <span className="mt-2 block text-sm font-semibold text-zera-green">
                    {formatMoney(product.price, activeBusiness?.currency)}
                    {product.unit ? <span className="text-zera-muted"> / {product.unit}</span> : null}
                  </span>
                  <span className="mt-1 block text-xs text-zera-muted">{product.category || formatProductType(product.type)}</span>
                  <span className="mt-1 block text-xs text-zera-muted">{product.sku || product.barcode || "No code"}</span>
                </button>
              ))}
            </div>
          </section>

        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                <UserRound size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Customer</h3>
                <p className="text-sm text-zera-muted">{selectedCustomer ? selectedCustomer.name : "Walk-in sale"}</p>
              </div>
            </div>

            <label className="flex min-h-11 items-center gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-3">
              <Search size={17} className="text-zera-muted" />
              <input
                className="w-full border-0 bg-transparent text-sm outline-none"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search saved customers"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-2 block text-sm font-medium text-zera-ink">Sale customer</span>
              <select
                className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {loadingCustomers ? <p className="mt-3 text-sm text-zera-muted">Loading customers...</p> : null}
            {customerError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{customerError}</p> : null}

            <Link
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-semibold text-zera-green transition hover:bg-zera-mint"
              to="/customers"
            >
              Manage customers
            </Link>
          </section>

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Cart</h3>
                  <p className="text-sm text-zera-muted">
                    {totalItems} item{totalItems === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" className="px-2" disabled={!cartItems.length} onClick={() => setCartItems([])} aria-label="Clear cart">
                <Trash2 size={18} />
              </Button>
            </div>

            {cartItems.length ? (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <article key={item.product.id} className="rounded-md border border-zera-line p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold">{item.product.name}</h4>
                        <p className="mt-1 text-sm text-zera-muted">
                          {formatMoney(item.product.price, activeBusiness?.currency)} {item.product.unit ? `per ${item.product.unit}` : "each"}
                        </p>
                      </div>
                      <p className="font-bold">{formatMoney(Number(item.product.price) * item.quantity, activeBusiness?.currency)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          aria-label={`Reduce ${item.product.name}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          aria-label={`Increase ${item.product.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-md text-zera-muted hover:bg-red-50 hover:text-red-700"
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-zera-line bg-[#f7faf8] px-4 text-center">
                <ReceiptText size={30} className="text-zera-green" />
                <h4 className="mt-3 font-bold">Cart is empty</h4>
                <p className="mt-2 text-sm leading-6 text-zera-muted">{modeInfo.emptyCartText}</p>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {totals.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zera-muted">{item.label}</span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
              <div className="border-t border-zera-line pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-2xl font-bold">{formatMoney(subtotal, activeBusiness?.currency)}</span>
                </div>
              </div>
            </div>

          </section>

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <h3 className="text-lg font-bold">{modeInfo.reviewTitle}</h3>
            <p className="mt-1 text-sm text-zera-muted">{modeInfo.reviewDescription}</p>
            <div className="mt-4 grid gap-3">
              <Button type="button" className="gap-2" disabled={!cartItems.length || (isTableService && !selectedTableId)} onClick={() => setReviewOpen(true)}>
                <ReceiptText size={18} />
                {modeInfo.reviewButtonLabel}
              </Button>
              {reviewDisabledReason ? <p className="text-sm text-zera-muted">{reviewDisabledReason}</p> : null}
            </div>
          </section>
        </aside>
      </section>

      {reviewOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6">
          <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zera-line bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zera-green">Draft sale</p>
                <h3 className="mt-1 text-2xl font-bold">Review cart</h3>
                <p className="mt-2 text-sm leading-6 text-zera-muted">
                Confirm the cart and record a manual sale. Payment integrations and inventory deductions are not connected yet.
                </p>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-md text-zera-muted hover:bg-[#f7faf8] hover:text-zera-ink"
                onClick={() => setReviewOpen(false)}
                aria-label="Close review"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {cartItems.map((item) => (
                <div key={item.product.id} className="flex items-start justify-between gap-3 rounded-md bg-[#f7faf8] px-3 py-3">
                  <div>
                    <p className="font-bold">{item.product.name}</p>
                    <p className="mt-1 text-sm text-zera-muted">
                      {item.quantity} x {formatMoney(item.product.price, activeBusiness?.currency)}
                      {item.product.unit ? ` / ${item.product.unit}` : ""}
                    </p>
                  </div>
                  <p className="font-bold">{formatMoney(Number(item.product.price) * item.quantity, activeBusiness?.currency)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-zera-line p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">Draft total</span>
                <span className="text-2xl font-bold">{formatMoney(subtotal, activeBusiness?.currency)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-[#f7faf8] px-3 py-3">
              <p className="text-xs font-semibold uppercase text-zera-muted">Customer</p>
              <p className="mt-1 font-bold">{selectedCustomer?.name || "Walk-in customer"}</p>
              {selectedCustomer?.phone || selectedCustomer?.email ? (
                <p className="mt-1 text-sm text-zera-muted">{selectedCustomer.phone || selectedCustomer.email}</p>
              ) : null}
            </div>

            {isTableService ? (
              <div className="mt-4 rounded-md bg-[#f7faf8] px-3 py-3">
                <p className="text-xs font-semibold uppercase text-zera-muted">Table</p>
                <p className="mt-1 font-bold">{selectedTable?.name || "No table selected"}</p>
              </div>
            ) : null}

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-zera-ink">Payment method</span>
              <select
                className="min-h-12 w-full rounded-md border border-zera-line bg-white px-4 text-base text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="CARD">Card</option>
              </select>
            </label>

            {saleError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saleError}</p> : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setReviewOpen(false)}>
                Back to cart
              </Button>
              <Button type="button" disabled={savingSale} onClick={handleRecordSale}>
                {savingSale ? "Recording..." : "Record sale"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatProductType(type = "PHYSICAL") {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getEffectivePOSMode(business) {
  if (!business) {
    return "RETAIL_CHECKOUT";
  }

  const type = (business.type || "").toLowerCase();

  if (business.posMode === "TABLE_SERVICE" || type.includes("bar") || type.includes("restaurant")) {
    return "TABLE_SERVICE";
  }

  return "RETAIL_CHECKOUT";
}

function posModeLabel(posMode) {
  return posMode === "TABLE_SERVICE" ? "Table-service POS" : "Retail checkout POS";
}

function formatTableStatus(status = "AVAILABLE") {
  return status.toLowerCase().replace("_", " ");
}

function getPOSModeInfo(posMode, roleName = "", businessType = "") {
  if (posMode === "TABLE_SERVICE") {
    return {
      icon: Table2,
      title: "Table-service POS",
      shortTitle: "table service",
      description: "Select a table, build the cart, attach a customer when needed, then record the bill with a manual payment method.",
      productEntryHint: "Tap menu items into the selected table bill.",
      emptyCartText: "Select a table, then tap active products to prepare the table bill.",
      reviewTitle: "Bill review",
      reviewDescription: "Confirm the table bill and record a manual payment. Kitchen tickets and payment gateway integration come later.",
      reviewButtonLabel: "Review table bill",
      requirement: "Table required before checkout",
      workflow: "Table first, cart second, payment last"
    };
  }

  if (roleName === "Pharmacist" || businessType.toLowerCase().includes("pharmacy")) {
    return {
      icon: Store,
      title: "Pharmacy checkout POS",
      shortTitle: "pharmacy checkout",
      description: "Search medicines or services, attach a customer when needed, and record a clear pharmacy counter sale.",
      productEntryHint: "Search medicines, services, SKU, barcode, or category before adding to the cart.",
      emptyCartText: "Tap active pharmacy items to prepare the customer sale.",
      reviewTitle: "Pharmacy sale review",
      reviewDescription: "Confirm products, quantities, customer, and payment method before recording the sale.",
      reviewButtonLabel: "Review pharmacy sale",
      requirement: "No table required",
      workflow: "Customer optional, item check, payment last"
    };
  }

  if (roleName === "Front Desk" || businessType.toLowerCase().includes("hotel")) {
    return {
      icon: Store,
      title: "Front desk service POS",
      shortTitle: "service checkout",
      description: "Record guest-facing service charges with customer lookup and simple manual payment.",
      productEntryHint: "Search services, charges, or products that should be billed at the front desk.",
      emptyCartText: "Tap active services or products to prepare the guest receipt.",
      reviewTitle: "Service sale review",
      reviewDescription: "Confirm guest/customer context, items, and payment method before recording the sale.",
      reviewButtonLabel: "Review service sale",
      requirement: "No table required",
      workflow: "Guest optional, service charge, payment last"
    };
  }

  if (roleName === "Store Keeper") {
    return {
      icon: Store,
      title: "Store checkout support",
      shortTitle: "catalog checkout",
      description: "Support checkout while keeping product names, categories, and prices clear for the team.",
      productEntryHint: "Search products and categories to verify catalog readiness or prepare a quick sale.",
      emptyCartText: "Tap active products to prepare a checkout cart.",
      reviewTitle: "Checkout review",
      reviewDescription: "Confirm the cart and record a manual payment.",
      reviewButtonLabel: "Review checkout sale",
      requirement: "No table required",
      workflow: "Catalog first, cart second, payment last"
    };
  }

  return {
    icon: Store,
    title: "Retail checkout POS",
    shortTitle: "checkout",
    description: "Run fast counter sales with customer selection available for repeat buyers and credit-history foundations later.",
    productEntryHint: "Search, filter, and tap products into the cart for a quick counter checkout.",
    emptyCartText: "Tap active products to prepare a checkout cart.",
    reviewTitle: "Checkout review",
    reviewDescription: "Confirm the cart and record a manual payment.",
    reviewButtonLabel: "Review checkout sale",
    requirement: "No table required",
    workflow: "Cart first, customer optional, payment last"
  };
}

function StatusPill({ label, ready }) {
  return (
    <span className={`rounded-md px-3 py-2 text-sm font-semibold ${ready ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
      {label}
    </span>
  );
}
