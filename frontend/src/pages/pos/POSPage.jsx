import { useEffect, useMemo, useState } from "react";
import { Banknote, Barcode, Calculator, CheckCircle2, CreditCard, Filter, Minus, Plus, Printer, ReceiptText, Search, ShoppingCart, Store, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../../components/Button.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createSale, getPOSReadiness, getRecentSales } from "../../services/posService.js";
import { getProducts } from "../../services/productService.js";

export default function POSPage() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId, activeBusiness, activeBusinessId, activeRoleName } = useWorkspace();
  const [readiness, setReadiness] = useState(null);
  const [products, setProducts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("ALL");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [readinessError, setReadinessError] = useState("");
  const [productError, setProductError] = useState("");
  const [saleError, setSaleError] = useState("");
  const [saleMessage, setSaleMessage] = useState("");
  const branchReady = readiness?.checks?.branchActive ?? activeBranch?.status === "ACTIVE";
  const workspaceReady = Boolean(activeBusiness && activeBranch && branchReady && (readiness?.checks?.posActive ?? true));
  const subtotal = cartItems.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0);
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const productCategories = useMemo(() => {
    const categories = products.map((product) => product.category).filter(Boolean);
    return [...new Set(categories)].sort((first, second) => first.localeCompare(second));
  }, [products]);
  const productFilterCount = [productTypeFilter !== "ALL", Boolean(productCategoryFilter), Boolean(productSearch)].filter(Boolean).length;
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
        setLoadingReadiness(true);
        setReadinessError("");
        const data = await getPOSReadiness(activeBusinessId, activeBranchId);
        setReadiness(data);
      } catch (apiError) {
        setReadinessError(apiError.response?.data?.message || "Unable to load POS readiness.");
      } finally {
        setLoadingReadiness(false);
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
          ...(productTypeFilter !== "ALL" ? { type: productTypeFilter } : {}),
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
  }, [activeBusinessId, productSearch, productCategoryFilter, productTypeFilter]);

  useEffect(() => {
    if (!activeBusinessId) {
      setRecentSales([]);
      return;
    }

    loadRecentSales();
  }, [activeBusinessId]);

  async function loadRecentSales() {
    try {
      const data = await getRecentSales(activeBusinessId);
      setRecentSales(data);
    } catch {
      setRecentSales([]);
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

  function updateProductTypeFilter(type) {
    setProductTypeFilter(type);
    setProductCategoryFilter("");
  }

  function clearProductFilters() {
    setProductSearch("");
    setProductTypeFilter("ALL");
    setProductCategoryFilter("");
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
        paymentMethod,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity
        }))
      });
      setCartItems([]);
      setReviewOpen(false);
      setSaleMessage(`Sale recorded: ${sale.receiptNumber}`);
      await loadRecentSales();
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
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{activeBranch ? `${activeBranch.name} register` : "Retail register"}</h2>
            <p className="mt-3 max-w-3xl leading-7 text-zera-muted">
              Sales are not enabled yet. This shell prepares the cashier workspace, branch readiness, cart layout, and payment surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={activeBusiness?.name || "No business"} ready={Boolean(activeBusiness)} />
            <StatusPill label={activeBranch?.name || "No branch"} ready={branchReady} />
            <StatusPill label={activeRoleName || "No role"} ready={Boolean(activeRoleName)} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold">Product entry</h3>
                <p className="mt-1 text-sm text-zera-muted">Search and scan controls are staged for the product catalog phase.</p>
              </div>
              <div className={`rounded-md px-3 py-2 text-sm font-semibold ${workspaceReady ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
                {workspaceReady ? "Register ready" : "Setup needed"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="flex min-h-14 items-center gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-4">
                <Search size={20} className="text-zera-muted" />
                <input
                  className="w-full border-0 bg-transparent text-base outline-none"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search product, category, SKU, or barcode"
                />
              </label>
              <Button type="button" variant="secondary" className="gap-2" disabled>
                <Barcode size={18} />
                Scan
              </Button>
            </div>

            <div className="mt-4 rounded-md border border-zera-line bg-[#f7faf8] p-3">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Filter size={17} className="text-zera-green" />
                  Product filters
                </div>
                {productFilterCount ? (
                  <button type="button" className="text-sm font-semibold text-zera-green" onClick={clearProductFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["ALL", "All"],
                  ["PHYSICAL", "Physical"],
                  ["SERVICE", "Services"],
                  ["FEE", "Fees"]
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${
                      productTypeFilter === type ? "border-zera-green bg-zera-green text-white" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                    }`}
                    onClick={() => updateProductTypeFilter(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {productCategories.length ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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
            </div>

            {productError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{productError}</p> : null}
            {saleMessage ? <p className="mt-4 rounded-md bg-zera-mint px-3 py-2 text-sm font-semibold text-zera-green">{saleMessage}</p> : null}

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

          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Calculator size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Keypad</h3>
                  <p className="text-sm text-zera-muted">Manual entry comes later.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "Clear"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled
                    className="min-h-14 rounded-md border border-zera-line bg-[#f7faf8] text-lg font-bold text-zera-muted disabled:cursor-not-allowed"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Store size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Register readiness</h3>
                  <p className="text-sm text-zera-muted">A quick check before sales screens are built.</p>
                </div>
              </div>
              <div className="space-y-3">
                <ReadinessRow label="Business assigned" value={activeBusiness?.name || "Missing"} ready={Boolean(activeBusiness)} />
                <ReadinessRow label="Branch active" value={activeBranch?.name || "Missing"} ready={branchReady} />
                <ReadinessRow label="Cashier identity" value={user?.name || "Missing"} ready={Boolean(user?.name)} />
                <ReadinessRow label="POS module" value={loadingReadiness ? "Checking..." : readiness?.checks?.posActive ? "Enabled" : "Not enabled"} ready={Boolean(readiness?.checks?.posActive)} />
                <ReadinessRow
                  label="Product catalog"
                  value={loadingReadiness ? "Checking..." : `${readiness?.activeProductCount || products.length} active product${(readiness?.activeProductCount || products.length) === 1 ? "" : "s"}`}
                  ready={Boolean(readiness?.checks?.productCatalogReady || products.length)}
                />
                <ReadinessRow label="Payment mode" value="Manual recording" ready />
              </div>
              {readinessError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{readinessError}</p> : null}
            </section>
          </section>
        </div>

        <aside className="space-y-5">
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
                <p className="mt-2 text-sm leading-6 text-zera-muted">Tap an active product to prepare a draft cart. Checkout is still locked.</p>
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

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button type="button" variant="secondary" className="gap-2" disabled>
                <Minus size={17} />
                Discount
              </Button>
              <Button type="button" variant="secondary" className="gap-2" disabled>
                <Plus size={17} />
                Hold
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <h3 className="text-lg font-bold">Sale review</h3>
            <p className="mt-1 text-sm text-zera-muted">Record a simple sale with a manual payment method. No payment gateway is connected.</p>
            <div className="mt-4 grid gap-3">
              <Button type="button" className="gap-2" disabled={!cartItems.length} onClick={() => setReviewOpen(true)}>
                <ReceiptText size={18} />
                Review draft sale
              </Button>
              <Button type="button" variant="secondary" className="gap-2" disabled>
                <Banknote size={18} />
                Cash payment
              </Button>
              <Button type="button" variant="secondary" className="gap-2" disabled>
                <CreditCard size={18} />
                Card / Mobile money
              </Button>
              <Button type="button" variant="secondary" className="gap-2" disabled>
                <Printer size={18} />
                Print receipt
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Recent sales</h3>
                <p className="mt-1 text-sm leading-6 text-zera-muted">
                  {recentSales.length
                    ? `${recentSales.length} latest sale${recentSales.length === 1 ? "" : "s"} recorded.`
                    : "Recorded sales will appear here."}
                </p>
              </div>
            </div>
            {recentSales.length ? (
              <div className="mt-4 space-y-2">
                {recentSales.slice(0, 3).map((sale) => (
                  <div key={sale.id} className="rounded-md bg-[#f7faf8] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{sale.receiptNumber}</p>
                      <p className="text-sm font-bold">{formatMoney(sale.total, activeBusiness?.currency)}</p>
                    </div>
                    <p className="mt-1 text-xs text-zera-muted">{sale.paymentMethod.replace("_", " ")}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <Link
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-semibold text-zera-green transition hover:bg-zera-mint"
              to="/sales"
            >
              View sales history
            </Link>
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

function StatusPill({ label, ready }) {
  return (
    <span className={`rounded-md px-3 py-2 text-sm font-semibold ${ready ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
      {label}
    </span>
  );
}

function ReadinessRow({ label, ready, value }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-[#f7faf8] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-1 text-sm text-zera-muted">{value}</p>
      </div>
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${ready ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
        {ready ? "Ready" : "Pending"}
      </span>
    </div>
  );
}
