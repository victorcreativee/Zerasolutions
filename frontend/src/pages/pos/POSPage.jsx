import { useEffect, useMemo, useState } from "react";
import { Hotel, Minus, Pill, Plus, Printer, ReceiptText, Search, ShoppingBasket, ShoppingCart, Smartphone, Store, Table2, Trash2, UserRound, X } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../../components/Button.jsx";
import PrintableBill from "../../components/PrintableBill.jsx";
import PrintableReceipt from "../../components/PrintableReceipt.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import {
  createPOSOrder,
  createPOSTable,
  createSale,
  getActiveTableOrder,
  getPOSTables,
  getPOSReadiness,
  markPOSOrderBillPrinted,
  payPOSOrder
} from "../../services/posService.js";
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
  const [tableFilter, setTableFilter] = useState("ALL");
  const [newTableName, setNewTableName] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [lastSale, setLastSale] = useState(null);
  const [activeTableOrder, setActiveTableOrder] = useState(null);
  const [sentOrderForBill, setSentOrderForBill] = useState(null);
  const [billToPrint, setBillToPrint] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState("SALE");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discountAmount, setDiscountAmount] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
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
  const workflowSteps = modeInfo.workflowSteps || [];
  const canManageTables = ["Owner", "Manager"].includes(activeRoleName);
  const canPayTableBills = ["Owner", "Manager", "Cashier"].includes(activeRoleName);
  const subtotal = cartItems.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0);
  const normalizedDiscountAmount = getValidDiscountAmount(discountAmount, subtotal);
  const cartTaxableSubtotal = roundMoney(Math.max(subtotal - normalizedDiscountAmount, 0));
  const taxAmount = getBusinessTaxAmount(cartTaxableSubtotal, activeBusiness);
  const cartTotal = roundMoney(cartTaxableSubtotal + taxAmount);
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const activeOrderSubtotal = activeTableOrder?.items?.reduce((total, item) => total + Number(item.lineTotal), 0) || Number(activeTableOrder?.subtotal || activeTableOrder?.total || 0);
  const activeOrderTotal = Number(activeTableOrder?.total || activeOrderSubtotal);
  const canPaySelectedTableBill = isTableService && canPayTableBills && activeTableOrder && !cartItems.length;
  const canPrintSelectedTableBill = isTableService && !canPayTableBills && activeTableOrder && !cartItems.length;
  const reviewDisabledReason = getReviewDisabledReason({
    cartItems,
    isTableService,
    selectedTableId,
    activeTableOrder,
    canPayTableBills
  });
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
  const tableStats = useMemo(() => buildTableStats(tables), [tables]);
  const visibleTables = useMemo(() => filterTablesForPOS(tables, tableFilter), [tableFilter, tables]);
  const isTableOrderReview = isTableService && reviewMode !== "PAY_ORDER";
  const orderForReview = reviewMode === "PAY_ORDER" ? activeTableOrder : isTableOrderReview ? sentOrderForBill : null;
  const orderSentInModal = isTableOrderReview && Boolean(sentOrderForBill);
  const reviewItems =
    orderForReview
      ? orderForReview.items?.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal
        })) || []
      : cartItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.product.price,
          lineTotal: Number(item.product.price) * item.quantity
        }));
  const reviewSubtotal = orderForReview?.items?.reduce((total, item) => total + Number(item.lineTotal), 0) || (reviewMode === "PAY_ORDER" ? activeOrderSubtotal : subtotal);
  const reviewDiscountAmount = reviewMode === "PAY_ORDER" || !isTableOrderReview ? getValidDiscountAmount(discountAmount, reviewSubtotal) : 0;
  const reviewTaxableSubtotal = roundMoney(Math.max(reviewSubtotal - reviewDiscountAmount, 0));
  const reviewTaxAmount = orderForReview
    ? getBusinessTaxAmount(reviewTaxableSubtotal, activeBusiness)
    : getBusinessTaxAmount(reviewTaxableSubtotal, activeBusiness);
  const reviewTotal = roundMoney(reviewTaxableSubtotal + reviewTaxAmount);
  const totals = [
    { label: "Subtotal", value: formatMoney(subtotal, activeBusiness?.currency) },
    ...(normalizedDiscountAmount > 0 ? [{ label: "Discount", value: `-${formatMoney(normalizedDiscountAmount, activeBusiness?.currency)}` }] : []),
    ...(isBusinessTaxEnabled(activeBusiness) ? [{ label: getBusinessTaxLabel(activeBusiness), value: formatMoney(taxAmount, activeBusiness?.currency) }] : []),
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
      setActiveTableOrder(null);
      return;
    }

    loadTables();
  }, [activeBusinessId, activeBranchId, isTableService]);

  useEffect(() => {
    if (!activeBusinessId || !activeBranchId || !selectedTableId || !isTableService) {
      setActiveTableOrder(null);
      return;
    }

    loadActiveOrderForTable(selectedTableId);
  }, [activeBusinessId, activeBranchId, selectedTableId, isTableService]);

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

  async function loadActiveOrderForTable(tableId) {
    try {
      setTableError("");
      const order = await getActiveTableOrder(activeBusinessId, activeBranchId, tableId);
      setActiveTableOrder(order);
    } catch (apiError) {
      setActiveTableOrder(null);
      setTableError(apiError.response?.data?.message || "Unable to load the active table bill.");
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

    if (isTableService) {
      await handleSendTableOrder();
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
        discountAmount: normalizedDiscountAmount,
        tableId: isTableService ? selectedTableId : undefined,
        paymentMethod,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity
        }))
      });
      setCartItems([]);
      setDiscountAmount("");
      setReviewOpen(false);
      setLastSale(sale);
      setSaleMessage(`Sale recorded: ${sale.receiptNumber}`);
    } catch (apiError) {
      setSaleError(apiError.response?.data?.detail || apiError.response?.data?.message || "Unable to record sale.");
    } finally {
      setSavingSale(false);
    }
  }

  async function handleSendTableOrder() {
    if (!activeBusinessId || !activeBranchId || !selectedTableId || !cartItems.length) {
      return;
    }

    setSavingOrder(true);
    setSaleError("");
    setSaleMessage("");

    try {
      const order = await createPOSOrder({
        businessId: activeBusinessId,
        branchId: activeBranchId,
        customerId: selectedCustomerId || undefined,
        tableId: selectedTableId,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity
        }))
      });
      setCartItems([]);
      setDiscountAmount("");
      setActiveTableOrder(order);
      setSentOrderForBill(order);
      setSaleMessage(`Table bill updated: ${order.orderNumber}`);
      await loadTables();
    } catch (apiError) {
      setSaleError(apiError.response?.data?.detail || apiError.response?.data?.message || "Unable to send table order.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function handlePayTableOrder() {
    if (!activeTableOrder) {
      return;
    }

    setSavingSale(true);
    setSaleError("");
    setSaleMessage("");

    try {
      const sale = await payPOSOrder(activeTableOrder.id, {
        discountAmount: getValidDiscountAmount(discountAmount, activeOrderSubtotal),
        paymentMethod,
        customerId: selectedCustomerId || activeTableOrder.customerId || undefined
      });
      setCartItems([]);
      setDiscountAmount("");
      setReviewOpen(false);
      setActiveTableOrder(null);
      setLastSale(sale);
      setSaleMessage(`Payment received: ${sale.receiptNumber}`);
      await loadTables();
    } catch (apiError) {
      setSaleError(apiError.response?.data?.detail || apiError.response?.data?.message || "Unable to receive payment.");
    } finally {
      setSavingSale(false);
    }
  }

  async function handlePrintCustomerBill(orderToPrint = activeTableOrder) {
    if (!orderToPrint) {
      return;
    }

    setPrintingBill(true);
    setSaleError("");

    try {
      const order = await markPOSOrderBillPrinted(orderToPrint.id);
      setActiveTableOrder(order);
      setSentOrderForBill(order);
      setBillToPrint(order);
      window.setTimeout(() => {
        window.print();
        setBillToPrint(null);
        setReviewOpen(false);
        setSentOrderForBill(null);
      }, 180);
    } catch (apiError) {
      setSaleError(apiError.response?.data?.message || "Unable to print customer bill.");
    } finally {
      setPrintingBill(false);
    }
  }

  function openReview(nextMode) {
    setSaleError("");
    setSentOrderForBill(null);
    setReviewMode(isTableService && nextMode === "SALE" ? "ORDER" : nextMode);
    setReviewOpen(true);
  }

  function openTableReview() {
    setSaleError("");

    if (cartItems.length) {
      setSentOrderForBill(null);
      setReviewMode("ORDER");
    } else if (activeTableOrder && canPayTableBills) {
      setSentOrderForBill(null);
      setReviewMode("PAY_ORDER");
    } else if (activeTableOrder) {
      setSentOrderForBill(activeTableOrder);
      setReviewMode("ORDER");
    }

    setReviewOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-3">
      <header className="rounded-md border border-zera-line bg-white shadow-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5">
          <div className="mr-auto min-w-[220px]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">{modeInfo.kicker}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-zera-ink">
              {activeBranch ? `${activeBranch.name} ${modeInfo.shortTitle}` : modeInfo.title}
            </h2>
          </div>
          <POSInlineContext label="Business" ready={Boolean(activeBusiness)} value={activeBusiness?.name || "No business"} />
          <POSInlineContext label="Branch" ready={branchReady} value={activeBranch?.name || "No branch"} />
          <POSInlineContext label="Mode" ready={Boolean(activeBusiness)} value={modeInfo.title} />
          <POSInlineContext label="Access" ready={roleReady} value={activeRoleName || "No role"} />
          <span className={`inline-flex min-h-8 shrink-0 items-center rounded-md px-2.5 text-xs font-bold ${workspaceReady ? "bg-zera-mintSoft text-zera-green" : "bg-red-50 text-red-700"}`}>
            {workspaceReady ? "Ready" : "Setup needed"}
          </span>
        </div>
        {saleMessage || readinessError ? (
          <div className="border-t border-zera-line px-3 py-2">
            {saleMessage ? <p className="rounded-md bg-zera-mintSoft px-3 py-2 text-sm font-semibold text-zera-green">{saleMessage}</p> : null}
            {readinessError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{readinessError}</p> : null}
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <main className="min-w-0 space-y-3">

          {isTableService ? (
            <section className="flex min-h-[360px] flex-col overflow-hidden rounded-md border border-zera-line bg-white p-4 shadow-xs">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
                    <Table2 size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-zera-green">Table service</p>
                    <h3 className="mt-1 text-xl font-bold">Tables</h3>
                    <p className="mt-1 text-sm text-zera-muted">{loadingTables ? "Loading tables..." : `${tables.length} table${tables.length === 1 ? "" : "s"} in this branch`}</p>
                  </div>
                </div>
                {selectedTable ? (
                  <div className="rounded-md border border-zera-line bg-[#fbfdfb] px-3 py-2 text-sm font-semibold text-zera-green">
                    Selected: {selectedTable.name}
                    {activeTableOrder ? (
                      <span className="ml-2 text-zera-ink">
                        / {activeTableOrder.status === "BILL_PRINTED" ? "Bill printed" : "Open bill"} / {formatMoney(activeOrderTotal, activeBusiness?.currency)}
                      </span>
                    ) : selectedTable.serviceSummary?.todaySalesCount ? (
                      <span className="ml-2 text-zera-ink">/ Paid today</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {[
                    { label: "All tables", value: "ALL", count: tableStats.all },
                    { label: "Open orders", value: "OPEN", count: tableStats.open },
                    { label: "Bill printed", value: "BILL_PRINTED", count: tableStats.billPrinted },
                    { label: "Available", value: "AVAILABLE", count: tableStats.available }
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      className={`min-h-9 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                        tableFilter === filter.value
                          ? "border-zera-green bg-zera-mintSoft text-zera-green"
                          : "border-zera-line bg-white text-zera-ink hover:border-zera-green hover:bg-zera-mintSoft hover:text-zera-green"
                      }`}
                      onClick={() => setTableFilter(filter.value)}
                    >
                      {filter.label}
                      <span className={`ml-2 rounded-md px-2 py-0.5 text-xs ${tableFilter === filter.value ? "bg-white text-zera-green" : "bg-zera-mintSoft text-zera-muted"}`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
              </div>

              {tableError ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{tableError}</p> : null}

              <div className="mt-3 grid flex-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {visibleTables.map((table) => {
                  const tableState = getTableServiceState(table);

                  return (
                    <button
                      key={table.id}
                      type="button"
                      className={`min-h-[84px] rounded-md border px-3 py-2.5 text-left transition ${
                        selectedTableId === table.id ? "border-zera-green bg-zera-mintSoft text-zera-ink" : "border-zera-line bg-white hover:border-zera-green hover:bg-zera-mintSoft"
                      }`}
                      onClick={() => setSelectedTableId(table.id)}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="block truncate font-bold">{table.name}</span>
                        <span className={`rounded-md bg-white px-2 py-1 text-[11px] font-bold ${tableState.className}`}>{tableState.label}</span>
                      </span>
                      <span className="mt-2 block text-xs text-zera-muted">
                        {table.seats} seats / {formatTableStatus(table.status)}
                      </span>
                      <span className="mt-2 block truncate text-xs font-semibold text-zera-ink">
                        {table.serviceSummary?.activeOrder
                          ? formatMoney(table.serviceSummary.activeOrder.total, activeBusiness?.currency)
                          : table.serviceSummary?.todaySalesCount
                            ? "Ready for next guest"
                            : "Ready"}
                      </span>
                    </button>
                  );
                })}
                {!loadingTables && visibleTables.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-5 text-sm text-zera-muted sm:col-span-3 lg:col-span-4 2xl:col-span-5">
                    No tables match this filter.
                  </div>
                ) : null}
              </div>

              {canManageTables ? (
                <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={handleCreateTable}>
                  <label className="block">
                    <span className="sr-only">New table name</span>
                    <input
                      className="min-h-9 w-full rounded-md border border-zera-line bg-white px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                      value={newTableName}
                      onChange={(event) => setNewTableName(event.target.value)}
                      placeholder="Table name"
                    />
                  </label>
                  <Button type="submit" variant="secondary" className="h-9 gap-2" disabled={!newTableName.trim()}>
                    <Plus size={17} />
                    Add table
                  </Button>
                </form>
              ) : null}
            </section>
          ) : null}

          <section className={`flex flex-col overflow-hidden rounded-md border border-zera-line bg-white p-4 shadow-xs ${isTableService ? "min-h-[320px]" : "min-h-[calc(100vh-150px)]"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-zera-green">{modeInfo.requirement}</p>
                <h3 className="mt-1 text-xl font-bold">{modeInfo.productSectionTitle}</h3>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-md border border-zera-line bg-white px-3 py-2 text-sm font-semibold text-zera-muted">
                  {products.length} active item{products.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
                <Search size={18} className="text-zera-muted" />
                <input
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search product, category, SKU, or barcode"
                />
              </label>
            </div>

            {productCategories.length ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  className={`min-h-9 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                    productCategoryFilter === "" ? "border-zera-green bg-zera-mintSoft text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mintSoft"
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
                      productCategoryFilter === category ? "border-zera-green bg-zera-mintSoft text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mintSoft"
                    }`}
                    onClick={() => setProductCategoryFilter(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}

            {productError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{productError}</p> : null}

            <div className="mt-4 grid flex-1 content-start gap-2 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
              {!loadingProducts && products.length === 0 ? (
                <div className="rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-5 text-sm text-zera-muted md:col-span-2 2xl:col-span-3">
                  No active products found. Owners and managers can add products from the Products page.
                </div>
              ) : null}

              {loadingProducts ? (
                <div className="rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-5 text-sm text-zera-muted md:col-span-2 2xl:col-span-3">
                  Loading products...
                </div>
              ) : null}

              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={!workspaceReady}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-zera-line bg-white px-3 py-2.5 text-left transition hover:border-zera-green hover:bg-zera-mintSoft disabled:cursor-not-allowed disabled:hover:border-zera-line disabled:hover:bg-white"
                  onClick={() => addToCart(product)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-zera-ink">{product.name}</span>
                    <span className="mt-1 block truncate text-xs text-zera-muted">
                      {product.category || formatProductType(product.type)} · {product.sku || product.barcode || "No code"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-zera-green">{formatMoney(product.price, activeBusiness?.currency)}</span>
                    {product.unit ? <span className="mt-1 block text-xs text-zera-muted">/{product.unit}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </section>

        </main>

        <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          {isTableService && activeTableOrder ? (
            <section className="overflow-hidden rounded-md border border-zera-line bg-white p-3 shadow-xs">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-zera-green">Open table bill</p>
                  <h3 className="mt-1 text-base font-bold">{activeTableOrder.table?.name || selectedTable?.name}</h3>
                  <p className="mt-1 text-xs text-zera-muted">
                    {activeTableOrder.orderNumber} · {activeTableOrder.items?.length || 0} item{activeTableOrder.items?.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                  Waiting payment
                </span>
              </div>

              <div className="max-h-44 space-y-2 overflow-y-auto">
                {activeTableOrder.items?.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-zera-mintSoft px-3 py-2">
                    <div>
                      <p className="text-sm font-bold">{item.product?.name || "Product"}</p>
                      <p className="mt-1 text-xs text-zera-muted">
                        {item.quantity} x {formatMoney(item.unitPrice, activeBusiness?.currency)}
                      </p>
                    </div>
                    <p className="text-sm font-bold">{formatMoney(item.lineTotal, activeBusiness?.currency)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-zera-line pt-3">
                <span className="font-bold">Bill total</span>
                <span className="text-lg font-bold">{formatMoney(activeOrderTotal, activeBusiness?.currency)}</span>
              </div>

              <div className="mt-3 grid gap-2">
                {canPayTableBills ? (
                  <Button type="button" className="h-9 gap-2" onClick={() => openReview("PAY_ORDER")}>
                    <ReceiptText size={18} />
                    Receive payment
                  </Button>
                ) : (
                  <p className="rounded-md bg-zera-mintSoft px-3 py-2 text-sm text-zera-muted">
                    Add new items from the cart, then print the customer bill from the review modal when the guest asks to pay.
                  </p>
                )}
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-md border border-zera-line bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-zera-line pb-3">
              <div>
                <p className="text-xs font-bold uppercase text-zera-green">Checkout</p>
                <h3 className="mt-1 text-lg font-bold">Cart</h3>
                <p className="text-sm text-zera-muted">
                  {totalItems} item{totalItems === 1 ? "" : "s"} / {selectedCustomer ? selectedCustomer.name : modeInfo.walkInLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="px-2"
                disabled={!cartItems.length}
                onClick={() => {
                  setCartItems([]);
                  setDiscountAmount("");
                }}
                aria-label="Clear cart"
              >
                <Trash2 size={18} />
              </Button>
            </div>

            <div className="mt-3 rounded-md border border-zera-line bg-[#fbfdfb] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-zera-ink">{modeInfo.customerTitle}</p>
                <Link className="text-xs font-bold text-zera-green hover:underline" to="/customers">
                  Manage
                </Link>
              </div>
              <label className="mt-2 flex min-h-9 items-center gap-2 rounded-md border border-zera-line bg-white px-3">
                <Search size={16} className="text-zera-muted" />
                <input
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder={modeInfo.customerSearchPlaceholder}
                />
              </label>
              <select
                className="mt-2 min-h-9 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="">{modeInfo.walkInLabel}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
              {loadingCustomers ? <p className="mt-2 text-xs text-zera-muted">Loading customers...</p> : null}
              {customerError ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{customerError}</p> : null}
            </div>

            {cartItems.length ? (
              <div className="mt-3 max-h-[34vh] space-y-2 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <article key={item.product.id} className="rounded-md border border-zera-line p-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold">{item.product.name}</h4>
                        <p className="mt-1 text-xs text-zera-muted">
                          {formatMoney(item.product.price, activeBusiness?.currency)} {item.product.unit ? `per ${item.product.unit}` : "each"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold">{formatMoney(Number(item.product.price) * item.quantity, activeBusiness?.currency)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          aria-label={`Reduce ${item.product.name}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          aria-label={`Increase ${item.product.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-zera-muted hover:bg-red-50 hover:text-red-700"
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
              <div className="mt-3 flex min-h-32 flex-col items-center justify-center rounded-md border border-dashed border-zera-line bg-zera-mintSoft px-4 text-center">
                <ReceiptText size={30} className="text-zera-green" />
                <h4 className="mt-3 font-bold">Cart is empty</h4>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {totals.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zera-muted">{item.label}</span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
              {cartItems.length && !isTableOrderReview ? (
                <label className="grid grid-cols-[1fr_140px] items-center gap-3 text-sm">
                  <span className="text-zera-muted">Discount</span>
                  <input
                    className="h-9 rounded-md border border-zera-line bg-white px-2.5 text-right text-sm font-bold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                    min="0"
                    max={subtotal}
                    placeholder="0"
                    type="number"
                    value={discountAmount}
                    onChange={(event) => setDiscountAmount(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="border-t border-zera-line pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-2xl font-bold text-zera-ink">{formatMoney(cartTotal, activeBusiness?.currency)}</span>
                </div>
              </div>
            </div>

            {!isTableOrderReview ? (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-zera-ink">Payment method</span>
                <select
                  className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="CARD">Card</option>
                </select>
              </label>
            ) : null}

            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                className="min-h-11 gap-2"
                disabled={Boolean(reviewDisabledReason)}
                onClick={() => (isTableService ? openTableReview() : openReview("SALE"))}
              >
                <ReceiptText size={18} />
                {getPrimaryPOSActionLabel({
                  canPaySelectedTableBill,
                  canPrintSelectedTableBill,
                  cartItems,
                  isTableService,
                  reviewButtonLabel: modeInfo.reviewButtonLabel
                })}
              </Button>
              {reviewDisabledReason ? <p className="text-sm text-zera-muted">{reviewDisabledReason}</p> : null}
            </div>
          </section>

          {lastSale ? (
            <section className="overflow-hidden rounded-md border border-zera-line bg-white p-3 shadow-xs">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-zera-green">Receipt ready</p>
                  <h3 className="mt-1 text-base font-bold">{lastSale.receiptNumber}</h3>
                  <p className="mt-1 text-sm text-zera-muted">
                    {formatMoney(lastSale.total, activeBusiness?.currency)} / {formatPayment(lastSale.paymentMethod)}
                  </p>
                </div>
                <ReceiptText size={22} className="text-zera-green" />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-zera-line bg-zera-mintSoft p-3">
                <PrintableReceipt business={activeBusiness} sale={lastSale} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Button type="button" className="no-print h-9 gap-2" onClick={() => window.print()}>
                  <Printer size={18} />
                  Print
                </Button>
                <Link
                  className="no-print inline-flex min-h-9 items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-semibold text-zera-green transition hover:bg-zera-mintSoft"
                  to="/sales"
                >
                  Sales
                </Link>
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      {reviewOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6">
          <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-zera-line bg-white p-5 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zera-green">
                  {reviewMode === "PAY_ORDER" ? "Cashier payment" : orderSentInModal ? "Customer bill" : isTableOrderReview ? "Table order" : "Draft sale"}
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {reviewMode === "PAY_ORDER" ? "Receive payment" : orderSentInModal ? "Print customer bill" : isTableOrderReview ? "Send table order" : "Review cart"}
                </h3>
              </div>
              {!orderSentInModal ? (
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-zera-muted hover:bg-zera-mintSoft hover:text-zera-ink"
                  onClick={() => setReviewOpen(false)}
                  aria-label="Close review"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {reviewItems.map((item, index) => (
                <div key={`${item.product.id}-${index}`} className="flex items-start justify-between gap-3 rounded-md bg-zera-mintSoft px-3 py-3">
                  <div>
                    <p className="font-bold">{item.product.name}</p>
                    <p className="mt-1 text-sm text-zera-muted">
                      {item.quantity} x {formatMoney(item.unitPrice, activeBusiness?.currency)}
                      {item.product.unit ? ` / ${item.product.unit}` : ""}
                    </p>
                  </div>
                  <p className="font-bold">{formatMoney(item.lineTotal, activeBusiness?.currency)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-zera-line p-4">
              {reviewMode === "PAY_ORDER" || !isTableOrderReview ? (
                <label className="mb-4 grid grid-cols-[1fr_160px] items-center gap-3 text-sm">
                  <span className="text-zera-muted">Discount</span>
                  <input
                    className="h-10 rounded-md border border-zera-line bg-white px-3 text-right text-sm font-bold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                    min="0"
                    max={reviewSubtotal}
                    placeholder="0"
                    type="number"
                    value={discountAmount}
                    onChange={(event) => setDiscountAmount(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="font-bold">{reviewMode === "PAY_ORDER" ? "Amount due" : isTableOrderReview ? "Order total" : "Draft total"}</span>
                <span className="text-xl font-bold">{formatMoney(reviewTotal, activeBusiness?.currency)}</span>
              </div>
              {reviewTaxAmount > 0 ? (
                <div className="mt-3 flex items-center justify-between border-t border-zera-line pt-3 text-sm">
                  <span className="text-zera-muted">{getBusinessTaxLabel(activeBusiness)}</span>
                  <span className="font-bold">{formatMoney(reviewTaxAmount, activeBusiness?.currency)}</span>
                </div>
              ) : null}
              {reviewDiscountAmount > 0 ? (
                <div className="mt-3 flex items-center justify-between border-t border-zera-line pt-3 text-sm">
                  <span className="text-zera-muted">Discount</span>
                  <span className="font-bold">-{formatMoney(reviewDiscountAmount, activeBusiness?.currency)}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-md bg-zera-mintSoft px-3 py-3">
              <p className="text-xs font-semibold uppercase text-zera-muted">Customer</p>
              <p className="mt-1 font-bold">{selectedCustomer?.name || "Walk-in customer"}</p>
              {selectedCustomer?.phone || selectedCustomer?.email ? (
                <p className="mt-1 text-sm text-zera-muted">{selectedCustomer.phone || selectedCustomer.email}</p>
              ) : null}
            </div>

            {isTableService ? (
              <div className="mt-4 rounded-md bg-zera-mintSoft px-3 py-3">
                <p className="text-xs font-semibold uppercase text-zera-muted">Table</p>
                <p className="mt-1 font-bold">{selectedTable?.name || "No table selected"}</p>
                {orderForReview?.orderNumber || activeTableOrder?.orderNumber ? (
                  <p className="mt-1 text-sm text-zera-muted">{orderForReview?.orderNumber || activeTableOrder.orderNumber}</p>
                ) : null}
              </div>
            ) : null}

            {!isTableOrderReview ? (
              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Payment method</span>
                <select
                  className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="CARD">Card</option>
                </select>
              </label>
            ) : null}

            {saleError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saleError}</p> : null}
            {orderSentInModal ? (
              <p className="mt-4 rounded-md bg-zera-mintSoft px-3 py-2 text-sm font-semibold text-zera-green">
                Order sent. Print the customer bill when the guest asks to pay, then cashier will close the table.
              </p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {orderSentInModal ? (
                <Button
                  type="button"
                  className="gap-2 sm:col-span-2"
                  disabled={printingBill}
                  onClick={() => handlePrintCustomerBill(sentOrderForBill)}
                >
                  <Printer size={18} />
                  {printingBill ? "Preparing bill..." : "Print customer bill"}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={() => setReviewOpen(false)}>
                    Back to cart
                  </Button>
                  <Button
                    type="button"
                    disabled={savingSale || savingOrder}
                    onClick={reviewMode === "PAY_ORDER" ? handlePayTableOrder : isTableOrderReview ? handleSendTableOrder : handleRecordSale}
                  >
                    {savingSale || savingOrder
                      ? "Saving..."
                      : reviewMode === "PAY_ORDER"
                        ? "Receive payment"
                        : isTableOrderReview
                          ? "Send table order"
                          : "Record sale"}
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {billToPrint ? (
        <div className="print-host">
          <PrintableBill business={activeBusiness} order={billToPrint} />
        </div>
      ) : null}
    </div>
  );
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getValidDiscountAmount(value, subtotal) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return roundMoney(Math.min(parsed, Number(subtotal || 0)));
}

function isBusinessTaxEnabled(business) {
  const taxRate = Number(business?.taxRate || 0);
  return Boolean(business?.taxEnabled && Number.isFinite(taxRate) && taxRate > 0);
}

function getBusinessTaxAmount(subtotal, business) {
  if (!isBusinessTaxEnabled(business)) {
    return 0;
  }

  return roundMoney((Number(subtotal || 0) * Number(business.taxRate || 0)) / 100);
}

function getBusinessTaxLabel(business) {
  const label = business?.taxName?.trim() || "Tax";
  const rate = Number(business?.taxRate || 0);

  if (!isBusinessTaxEnabled(business)) {
    return label;
  }

  return `${label} ${rate}%`;
}

function formatPayment(method = "CASH") {
  return method.replace("_", " ").toLowerCase();
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

  if (business.posMode === "TABLE_SERVICE") {
    return "TABLE_SERVICE";
  }

  return "RETAIL_CHECKOUT";
}

function formatTableStatus(status = "AVAILABLE") {
  return status.toLowerCase().replace("_", " ");
}

function getTableServiceState(table) {
  const activeOrder = table.serviceSummary?.activeOrder;

  if (activeOrder?.status === "BILL_PRINTED") {
    return {
      label: "Bill printed",
      className: "text-amber-700"
    };
  }

  if (activeOrder) {
    return {
      label: "Open order",
      className: "text-amber-700"
    };
  }

  if (table.serviceSummary?.todaySalesCount) {
    return {
      label: "Closed",
      className: "text-zera-green"
    };
  }

  return {
    label: "Available",
    className: "text-zera-muted"
  };
}

function buildTableStats(tables) {
  return tables.reduce(
    (stats, table) => {
      const activeOrder = table.serviceSummary?.activeOrder;

      stats.all += 1;

      if (activeOrder?.status === "BILL_PRINTED") {
        stats.billPrinted += 1;
      } else if (activeOrder) {
        stats.open += 1;
      } else {
        stats.available += 1;
      }

      return stats;
    },
    { all: 0, available: 0, billPrinted: 0, open: 0 }
  );
}

function filterTablesForPOS(tables, tableFilter) {
  if (tableFilter === "OPEN") {
    return tables.filter((table) => table.serviceSummary?.activeOrder && table.serviceSummary.activeOrder.status !== "BILL_PRINTED");
  }

  if (tableFilter === "BILL_PRINTED") {
    return tables.filter((table) => table.serviceSummary?.activeOrder?.status === "BILL_PRINTED");
  }

  if (tableFilter === "AVAILABLE") {
    return tables.filter((table) => !table.serviceSummary?.activeOrder);
  }

  return tables;
}

function getReviewDisabledReason({ cartItems, isTableService, selectedTableId, activeTableOrder, canPayTableBills }) {
  if (!isTableService) {
    return cartItems.length ? "" : "Add products to the cart first.";
  }

  if (!selectedTableId) {
    return "Select a table before continuing.";
  }

  if (cartItems.length) {
    return "";
  }

  if (activeTableOrder && canPayTableBills) {
    return "";
  }

  if (activeTableOrder && !canPayTableBills) {
    return "";
  }

  return "Add menu items to open this table bill.";
}

function getPrimaryPOSActionLabel({ canPaySelectedTableBill, canPrintSelectedTableBill, cartItems, isTableService, reviewButtonLabel }) {
  if (!isTableService) {
    return reviewButtonLabel;
  }

  if (cartItems.length) {
    return "Send table order";
  }

  if (canPaySelectedTableBill) {
    return "Receive table payment";
  }

  if (canPrintSelectedTableBill) {
    return "Print customer bill";
  }

  return "Select table and add items";
}

function getPOSModeInfo(posMode, roleName = "", businessType = "") {
  const normalizedType = businessType.toLowerCase();

  if (posMode === "TABLE_SERVICE") {
    return {
      icon: Table2,
      kicker: "Table service",
      title: "Table-service POS",
      shortTitle: "table service",
      description: "",
      productSectionTitle: "Menu entry",
      productEntryHint: "Tap menu items into the selected table bill.",
      emptyCartText: "Select a table, then tap active products to prepare the table bill.",
      reviewTitle: "Bill review",
      reviewDescription: "",
      reviewButtonLabel: "Send table order",
      requirement: "Table required before checkout",
      workflow: "Table first, order second, cashier payment last",
      workflowSteps: ["Choose table", "Add order", "Cashier closes bill"],
      nextFoundation: "",
      counterHint: "Staff select a table before adding items.",
      customerTitle: "Customer",
      customerSearchPlaceholder: "Search saved customers",
      customerSelectLabel: "Bill customer",
      walkInLabel: "Walk-in customer"
    };
  }

  if (roleName === "Pharmacist" || normalizedType.includes("pharmacy")) {
    return {
      icon: Pill,
      kicker: "Pharmacy counter",
      title: "Pharmacy checkout POS",
      shortTitle: "pharmacy checkout",
      description: "",
      productSectionTitle: "Medicine and service entry",
      productEntryHint: "Search medicines, services, SKU, barcode, or category before adding to the cart.",
      emptyCartText: "Tap active pharmacy items to prepare the customer sale.",
      reviewTitle: "Pharmacy sale review",
      reviewDescription: "Confirm products, quantities, customer, and payment method before recording the sale.",
      reviewButtonLabel: "Review pharmacy sale",
      requirement: "No table required",
      workflow: "Customer optional, item check, payment last",
      workflowSteps: ["Find item", "Confirm quantity", "Record payment"],
      nextFoundation: "",
      counterHint: "Pharmacy sales use customer lookup and quick product search.",
      customerTitle: "Patient / customer",
      customerSearchPlaceholder: "Search patient or customer",
      customerSelectLabel: "Sale customer",
      walkInLabel: "Walk-in customer"
    };
  }

  if (roleName === "Front Desk" || normalizedType.includes("hotel")) {
    return {
      icon: Hotel,
      kicker: "Front desk",
      title: "Front desk service POS",
      shortTitle: "service checkout",
      description: "",
      productSectionTitle: "Guest service entry",
      productEntryHint: "Search services, charges, or products that should be billed at the front desk.",
      emptyCartText: "Tap active services or products to prepare the guest receipt.",
      reviewTitle: "Service sale review",
      reviewDescription: "Confirm guest/customer context, items, and payment method before recording the sale.",
      reviewButtonLabel: "Review service sale",
      requirement: "No table required",
      workflow: "Guest optional, service charge, payment last",
      workflowSteps: ["Choose guest", "Add service", "Record payment"],
      nextFoundation: "",
      counterHint: "Front desk sales are built around guest services and charges.",
      customerTitle: "Guest / customer",
      customerSearchPlaceholder: "Search guest or customer",
      customerSelectLabel: "Guest or customer",
      walkInLabel: "Walk-in guest"
    };
  }

  if (normalizedType.includes("supermarket")) {
    return {
      icon: ShoppingBasket,
      kicker: "Supermarket checkout",
      title: "Supermarket checkout POS",
      shortTitle: "supermarket checkout",
      description: "",
      productSectionTitle: "Scan or search items",
      productEntryHint: "Use barcode, SKU, product name, or category for fast basket checkout.",
      emptyCartText: "Tap active supermarket items to prepare the customer basket.",
      reviewTitle: "Basket review",
      reviewDescription: "Confirm the basket and payment method before recording the supermarket sale.",
      reviewButtonLabel: "Review basket sale",
      requirement: "No table required",
      workflow: "Scan/search, basket, payment last",
      workflowSteps: ["Find item", "Build basket", "Record payment"],
      nextFoundation: "",
      counterHint: "Supermarket checkout prioritizes fast search, quantities, and barcode flow.",
      customerTitle: "Customer",
      customerSearchPlaceholder: "Search saved customers",
      customerSelectLabel: "Sale customer",
      walkInLabel: "Walk-in customer"
    };
  }

  if (normalizedType.includes("electronic")) {
    return {
      icon: Smartphone,
      kicker: "Electronics checkout",
      title: "Electronics shop POS",
      shortTitle: "electronics checkout",
      description: "",
      productSectionTitle: "Device and accessory entry",
      productEntryHint: "Find devices, accessories, repair-service items, SKU, or barcode before adding to cart.",
      emptyCartText: "Tap active electronics items to prepare the customer sale.",
      reviewTitle: "Electronics sale review",
      reviewDescription: "Confirm devices, accessories, quantities, customer, and payment method before recording the sale.",
      reviewButtonLabel: "Review electronics sale",
      requirement: "No table required",
      workflow: "Find item, confirm stock, record payment",
      workflowSteps: ["Find device", "Check cart", "Record payment"],
      nextFoundation: "",
      counterHint: "Electronics checkout prioritizes SKU/barcode search, stock visibility, and clean receipts.",
      customerTitle: "Customer",
      customerSearchPlaceholder: "Search customer or phone number",
      customerSelectLabel: "Sale customer",
      walkInLabel: "Walk-in customer"
    };
  }

  if (normalizedType.includes("retail")) {
    return {
      icon: Store,
      kicker: "Retail counter",
      title: "Retail shop checkout POS",
      shortTitle: "retail checkout",
      description: "",
      productSectionTitle: "Product entry",
      productEntryHint: "Search product name, category, SKU, or barcode before adding items to the cart.",
      emptyCartText: "Tap active retail items to prepare a checkout cart.",
      reviewTitle: "Checkout review",
      reviewDescription: "Confirm the cart and payment method before recording the retail sale.",
      reviewButtonLabel: "Review retail sale",
      requirement: "No table required",
      workflow: "Product first, cart second, payment last",
      workflowSteps: ["Find product", "Check cart", "Record payment"],
      nextFoundation: "",
      counterHint: "Retail checkout focuses on clear product search and simple payment.",
      customerTitle: "Customer",
      customerSearchPlaceholder: "Search saved customers",
      customerSelectLabel: "Sale customer",
      walkInLabel: "Walk-in customer"
    };
  }

  if (roleName === "Store Keeper") {
    return {
      icon: Store,
      kicker: "Store counter",
      title: "Store checkout support",
      shortTitle: "catalog checkout",
      description: "",
      productSectionTitle: "Product entry",
      productEntryHint: "Search products and categories to verify catalog readiness or prepare a quick sale.",
      emptyCartText: "Tap active products to prepare a checkout cart.",
      reviewTitle: "Checkout review",
      reviewDescription: "Confirm the cart and record a manual payment.",
      reviewButtonLabel: "Review checkout sale",
      requirement: "No table required",
      workflow: "Catalog first, cart second, payment last",
      workflowSteps: ["Find product", "Check cart", "Record payment"],
      nextFoundation: "",
      counterHint: "Store checkout focuses on clear product search and catalog accuracy.",
      customerTitle: "Customer",
      customerSearchPlaceholder: "Search saved customers",
      customerSelectLabel: "Sale customer",
      walkInLabel: "Walk-in customer"
    };
  }

  return {
    icon: Store,
    kicker: "Retail counter",
    title: "Retail checkout POS",
    shortTitle: "checkout",
    description: "",
    productSectionTitle: "Product entry",
    productEntryHint: "Search, filter, and tap products into the cart for a quick counter checkout.",
    emptyCartText: "Tap active products to prepare a checkout cart.",
    reviewTitle: "Checkout review",
    reviewDescription: "Confirm the cart and record a manual payment.",
    reviewButtonLabel: "Review checkout sale",
    requirement: "No table required",
    workflow: "Cart first, customer optional, payment last",
    workflowSteps: ["Add products", "Attach customer", "Record payment"],
    nextFoundation: "",
    counterHint: "Counter sales are optimized for fast product search and simple payment.",
    customerTitle: "Customer",
    customerSearchPlaceholder: "Search saved customers",
    customerSelectLabel: "Sale customer",
    walkInLabel: "Walk-in customer"
  };
}

function StatusPill({ helper, label, ready }) {
  return (
    <span className={`rounded-md px-3 py-2 ${ready ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
      <span className="block text-[0.65rem] font-bold uppercase tracking-wide opacity-80">{helper}</span>
      <span className="block truncate text-sm font-bold">{label}</span>
    </span>
  );
}

function POSInlineContext({ label, ready, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-zera-green" : "bg-red-500"}`} />
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</span>
      <span className="max-w-[210px] truncate font-semibold text-zera-ink">{value}</span>
    </div>
  );
}

function POSContextCell({ helper, label, ready }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-zera-muted">{helper}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-zera-green" : "bg-red-500"}`} />
        <p className="truncate text-sm font-bold text-zera-ink">{label}</p>
      </div>
    </div>
  );
}
