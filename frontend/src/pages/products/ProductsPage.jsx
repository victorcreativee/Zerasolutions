import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  ToggleLeft,
  ToggleRight,
  Wrench,
  X
} from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createProduct, getProducts, updateProduct, updateProductStatus } from "../../services/productService.js";

const defaultForm = {
  name: "",
  sku: "",
  barcode: "",
  type: "PHYSICAL",
  category: "",
  unit: "",
  price: ""
};

const productTypes = [
  {
    key: "PHYSICAL",
    label: "Physical",
    helper: "Stock item",
    icon: Package
  },
  {
    key: "SERVICE",
    label: "Service",
    helper: "No stock",
    icon: Wrench
  },
  {
    key: "FEE",
    label: "Fee / Charge",
    helper: "Delivery, service charge",
    icon: CircleDollarSign
  }
];

export default function ProductsPage() {
  const { activeBusiness, activeBusinessId } = useWorkspace();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeProducts = products.filter((product) => product.status === "ACTIVE");
  const inactiveProducts = products.filter((product) => product.status === "INACTIVE");
  const physicalProducts = products.filter((product) => product.type === "PHYSICAL");
  const serviceProducts = products.filter((product) => product.type === "SERVICE");
  const feeProducts = products.filter((product) => product.type === "FEE");
  const missingCategories = products.filter((product) => !product.category);
  const physicalWithoutCode = physicalProducts.filter((product) => !product.sku && !product.barcode);
  const catalogGuide = getCatalogGuide(activeBusiness);
  const starterProducts = getStarterProducts(activeBusiness);
  const readinessItems = [
    {
      label: "Active catalog",
      value: activeProducts.length ? `${activeProducts.length} active item${activeProducts.length === 1 ? "" : "s"}` : "No active products yet",
      ready: activeProducts.length > 0
    },
    {
      label: "Categories",
      value: missingCategories.length ? `${missingCategories.length} item${missingCategories.length === 1 ? "" : "s"} without category` : "Products are grouped",
      ready: products.length > 0 && missingCategories.length === 0
    },
    {
      label: "Product codes",
      value: physicalWithoutCode.length ? `${physicalWithoutCode.length} physical item${physicalWithoutCode.length === 1 ? "" : "s"} without SKU/barcode` : "Physical items have codes",
      ready: physicalProducts.length === 0 || physicalWithoutCode.length === 0
    }
  ];
  const productCategories = useMemo(() => {
    const categories = products.map((product) => product.category).filter(Boolean);
    return [...new Set(categories)].sort((first, second) => first.localeCompare(second));
  }, [products]);
  const filterCount = [typeFilter !== "ALL", statusFilter !== "ALL", Boolean(categoryFilter), Boolean(search)].filter(Boolean).length;

  useEffect(() => {
    if (!activeBusinessId) {
      setProducts([]);
      return;
    }

    loadProducts();
  }, [activeBusinessId, categoryFilter, statusFilter, typeFilter]);

  async function loadProducts(nextSearch = search) {
    if (!activeBusinessId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const params = {
        ...(nextSearch ? { q: nextSearch } : {}),
        ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {})
      };
      const data = await getProducts(activeBusinessId, params);
      setProducts(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!activeBusinessId) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const product = editingProductId
        ? await updateProduct(activeBusinessId, editingProductId, form)
        : await createProduct(activeBusinessId, form);
      setProducts((current) =>
        editingProductId ? current.map((item) => (item.id === product.id ? product : item)) : [product, ...current]
      );
      setForm(defaultForm);
      setEditingProductId("");
      setMessage(editingProductId ? "Product updated." : "Product created.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle(product) {
    if (!activeBusinessId) {
      return;
    }

    const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError("");
    setMessage("");
    setUpdatingProductId(product.id);

    try {
      const updatedProduct = await updateProductStatus(activeBusinessId, product.id, nextStatus);
      setProducts((current) => current.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
      setMessage(`${updatedProduct.name} is now ${updatedProduct.status.toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update product.");
    } finally {
      setUpdatingProductId("");
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadProducts(search);
  }

  function handleEdit(product) {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      sku: product.sku || "",
      barcode: product.barcode || "",
      type: product.type || "PHYSICAL",
      category: product.category || "",
      unit: product.unit || "",
      price: product.price
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingProductId("");
    setForm(defaultForm);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setCategoryFilter("");
  }

  function useStarterProduct(product) {
    setEditingProductId("");
    setForm({
      ...defaultForm,
      ...product
    });
    setMessage("");
    setError("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">POS catalog</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{catalogGuide.title}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              {catalogGuide.description}
            </p>
          </div>
          <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <Boxes size={30} />
          </div>
        </div>
      </section>

      {!activeBusiness ? (
        <section className="rounded-lg border border-zera-line bg-white p-6">
          <h3 className="text-lg font-bold">No business selected</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">Select a business before creating products.</p>
        </section>
      ) : (
        <>
          {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

          <section className="grid gap-4 md:grid-cols-4">
            <Metric icon={Boxes} label="Products" value={loading ? "..." : products.length} />
            <Metric icon={ToggleRight} label="Active" value={loading ? "..." : activeProducts.length} />
            <Metric icon={Package} label="Physical" value={loading ? "..." : physicalProducts.length} />
            <Metric icon={Wrench} label="Services / Fees" value={loading ? "..." : serviceProducts.length + feeProducts.length} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Catalog readiness</h3>
                  <p className="text-sm text-zera-muted">{catalogGuide.readiness}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {readinessItems.map((item) => (
                  <div className="rounded-md border border-zera-line bg-[#f7faf8] p-3" key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{item.label}</p>
                      {item.ready ? <CheckCircle2 className="text-zera-green" size={17} /> : <AlertTriangle className="text-amber-600" size={17} />}
                    </div>
                    <p className="text-xs leading-5 text-zera-muted">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Starter items</h3>
                  <p className="text-sm text-zera-muted">Tap one to prepare the form, then adjust and save.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {starterProducts.map((product) => (
                  <button
                    className="rounded-md border border-zera-line bg-[#f7faf8] px-3 py-3 text-left transition hover:border-zera-green hover:bg-zera-mint"
                    key={`${product.name}-${product.type}`}
                    type="button"
                    onClick={() => useStarterProduct(product)}
                  >
                    <span className="block text-sm font-bold">{product.name}</span>
                    <span className="mt-1 block text-xs text-zera-muted">
                      {formatProductType(product.type)} · {product.category || "No category"} · {formatMoney(product.price || 0, activeBusiness.currency)}
                    </span>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleSubmit}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Plus size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{editingProductId ? "Edit product" : "Create product"}</h3>
                  <p className="text-sm text-zera-muted">Business: {activeBusiness.name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <ProductTypePicker value={form.type} onChange={(type) => setForm({ ...form, type })} />
                <Input label="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="SKU" placeholder="Optional product code" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
                  <Input label="Barcode" placeholder="Scan or type barcode" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Category"
                    placeholder={form.type === "PHYSICAL" ? "Drinks, food, grocery" : form.type === "SERVICE" ? "Repair, consultation" : "Delivery, service charge"}
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  />
                  <Input
                    label="Unit"
                    placeholder={form.type === "PHYSICAL" ? "bottle, kg, pack" : "service"}
                    value={form.unit}
                    onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  />
                </div>
                <Input
                  label="Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  required
                />
                <Button className="w-full gap-2" disabled={saving}>
                  <Plus size={17} />
                  {saving ? "Saving..." : editingProductId ? "Save product" : "Create product"}
                </Button>
                {editingProductId ? (
                  <Button type="button" variant="ghost" className="w-full gap-2" onClick={cancelEdit}>
                    <X size={17} />
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>

            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Product list</h3>
                  <p className="mt-1 text-sm text-zera-muted">{loading ? "Loading..." : `${products.length} product${products.length === 1 ? "" : "s"}`}</p>
                </div>
                <form className="flex min-h-11 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10" onSubmit={handleSearchSubmit}>
                  <Search size={18} className="text-zera-muted" />
                  <input
                    className="w-full border-0 bg-transparent text-sm outline-none"
                    placeholder="Search product, category, SKU"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </form>
              </div>

              <div className="mb-5 rounded-md border border-zera-line bg-[#f7faf8] p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Filter size={17} className="text-zera-green" />
                    Catalog filters
                  </div>
                  {filterCount ? (
                    <button type="button" className="text-sm font-semibold text-zera-green" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    ["ALL", "All types"],
                    ["PHYSICAL", "Physical"],
                    ["SERVICE", "Services"],
                    ["FEE", "Fees"]
                  ].map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${
                        typeFilter === type ? "border-zera-green bg-zera-green text-white" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                      }`}
                      onClick={() => {
                        setTypeFilter(type);
                        setCategoryFilter("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["ALL", "All status"],
                    ["ACTIVE", "Active"],
                    ["INACTIVE", "Inactive"]
                  ].map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${
                        statusFilter === status ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                      }`}
                      onClick={() => setStatusFilter(status)}
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
                        categoryFilter === "" ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                      }`}
                      onClick={() => setCategoryFilter("")}
                    >
                      All categories
                    </button>
                    {productCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`min-h-9 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                          categoryFilter === category ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                        }`}
                        onClick={() => setCategoryFilter(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {!loading && products.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">
                    No products found. Create the first product for this business.
                  </div>
                ) : null}

                {products.map((product) => (
                  <article key={product.id} className="rounded-md border border-zera-line p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold">{product.name}</h4>
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                              product.status === "ACTIVE" ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {product.status === "ACTIVE" ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-2 text-xl font-bold">
                          {formatMoney(product.price, activeBusiness.currency)}
                          {product.unit ? <span className="text-sm font-semibold text-zera-muted"> / {product.unit}</span> : null}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-zera-muted">
                          <span className="inline-flex items-center gap-1 rounded-md bg-zera-mint px-2 py-1 text-zera-green">
                            <Boxes size={13} />
                            {formatProductType(product.type)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#f7faf8] px-2 py-1">
                            <Tag size={13} />
                            {product.category || "No category"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#f7faf8] px-2 py-1">
                            <Tag size={13} />
                            {product.sku || "No SKU"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#f7faf8] px-2 py-1">
                            <Barcode size={13} />
                            {product.barcode || "No barcode"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:flex-col">
                        <Button type="button" variant="secondary" className="gap-2 sm:w-28" onClick={() => handleEdit(product)}>
                          <Pencil size={16} />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant={product.status === "ACTIVE" ? "secondary" : "primary"}
                          className="sm:w-28"
                          disabled={updatingProductId === product.id}
                          onClick={() => handleStatusToggle(product)}
                        >
                          {product.status === "ACTIVE" ? "Pause" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function ProductTypePicker({ onChange, value }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-zera-ink">Product type</span>
      <div className="grid overflow-hidden rounded-md border border-zera-line sm:grid-cols-3">
        {productTypes.map((type) => {
          const Icon = type.icon;
          const selected = value === type.key;

          return (
            <button
              key={type.key}
              type="button"
              className={`min-h-20 border-b border-zera-line px-3 text-left transition last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                selected ? "bg-zera-green text-white" : "bg-white text-zera-ink hover:bg-zera-mint"
              }`}
              onClick={() => onChange(type.key)}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icon size={18} />
                {type.label}
              </span>
              <span className={`mt-1 block text-xs ${selected ? "text-white/80" : "text-zera-muted"}`}>{type.helper}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-zera-muted">
        {value === "PHYSICAL"
          ? "Physical products can later connect to inventory tracking."
          : value === "SERVICE"
            ? "Services can be sold without stock movement."
            : "Fees and charges keep delivery or service costs separate from normal products."}
      </p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-zera-line bg-white p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-zera-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-zera-ink">{value}</p>
    </article>
  );
}

function formatProductType(type = "PHYSICAL") {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getCatalogGuide(business) {
  const type = (business?.type || "").toLowerCase();

  if (type.includes("bar") || type.includes("restaurant")) {
    return {
      title: "Menu and service items",
      description:
        "Create drinks, meals, services, and charges that waiters or cashiers can add to table bills. Keep names short and categories clear.",
      readiness: "A good restaurant catalog is easy to scan during busy service."
    };
  }

  if (type.includes("pharmacy")) {
    return {
      title: "Pharmacy products and services",
      description:
        "Create medicines, consultation services, and charges that pharmacists can find quickly at the counter.",
      readiness: "A pharmacy catalog should make items easy to search by name, category, SKU, or barcode."
    };
  }

  if (type.includes("hotel")) {
    return {
      title: "Guest services and charges",
      description:
        "Create service items, room-related charges, and front desk products that can be billed while the hotel module grows.",
      readiness: "A front desk catalog should separate services, fees, and physical items clearly."
    };
  }

  if (type.includes("supermarket")) {
    return {
      title: "Supermarket checkout catalog",
      description:
        "Create fast-moving products with clear categories, units, prices, and codes so checkout remains quick.",
      readiness: "A supermarket catalog works best when physical products have categories and codes."
    };
  }

  if (type.includes("retail")) {
    return {
      title: "Retail shop products",
      description:
        "Create the products and service charges your shop sells today. Keep the catalog simple, searchable, and ready for checkout.",
      readiness: "A retail catalog should be clear enough for any cashier to search quickly."
    };
  }

  return {
    title: "Products and services",
    description: "Create the simple items POS can sell today. Inventory counts and purchasing will come later.",
    readiness: "A clean catalog makes POS faster and easier for every team member."
  };
}

function getStarterProducts(business) {
  const type = (business?.type || "").toLowerCase();

  if (type.includes("bar") || type.includes("restaurant")) {
    return [
      createStarterProduct("Nile beer", "PHYSICAL", "Drinks", "bottle", "5000", "DRK001"),
      createStarterProduct("Grilled chicken", "PHYSICAL", "Food", "plate", "25000", "FOD001"),
      createStarterProduct("Table service charge", "FEE", "Charges", "bill", "0", "FEE001"),
      createStarterProduct("Takeaway pack", "FEE", "Charges", "pack", "1000", "FEE002")
    ];
  }

  if (type.includes("pharmacy")) {
    return [
      createStarterProduct("Paracetamol 500mg", "PHYSICAL", "Medicine", "tablet", "500", "MED001"),
      createStarterProduct("Cough syrup", "PHYSICAL", "Medicine", "bottle", "8500", "MED002"),
      createStarterProduct("Consultation", "SERVICE", "Services", "visit", "10000", "SRV001"),
      createStarterProduct("Delivery fee", "FEE", "Charges", "order", "3000", "FEE001")
    ];
  }

  if (type.includes("hotel")) {
    return [
      createStarterProduct("Laundry service", "SERVICE", "Guest services", "service", "15000", "SRV001"),
      createStarterProduct("Room service charge", "FEE", "Charges", "bill", "5000", "FEE001"),
      createStarterProduct("Bottled water", "PHYSICAL", "Mini bar", "bottle", "3000", "MIN001"),
      createStarterProduct("Airport pickup", "SERVICE", "Transport", "trip", "60000", "SRV002")
    ];
  }

  if (type.includes("supermarket")) {
    return [
      createStarterProduct("Mineral water 500ml", "PHYSICAL", "Drinks", "bottle", "1000", "GRC001"),
      createStarterProduct("Sugar 1kg", "PHYSICAL", "Groceries", "pack", "4500", "GRC002"),
      createStarterProduct("Bread", "PHYSICAL", "Bakery", "loaf", "5000", "BAK001"),
      createStarterProduct("Delivery fee", "FEE", "Charges", "order", "3000", "FEE001")
    ];
  }

  if (type.includes("retail")) {
    return [
      createStarterProduct("Mineral water", "PHYSICAL", "Drinks", "bottle", "1000", "PRD001"),
      createStarterProduct("Soap", "PHYSICAL", "Household", "piece", "2500", "PRD002"),
      createStarterProduct("Delivery fee", "FEE", "Charges", "order", "3000", "FEE001"),
      createStarterProduct("Repair service", "SERVICE", "Services", "service", "10000", "SRV001")
    ];
  }

  return [
    createStarterProduct("Sample product", "PHYSICAL", "General", "item", "1000", "PRD001"),
    createStarterProduct("Service charge", "FEE", "Charges", "bill", "0", "FEE001"),
    createStarterProduct("Consultation", "SERVICE", "Services", "visit", "10000", "SRV001"),
    createStarterProduct("Delivery fee", "FEE", "Charges", "order", "3000", "FEE002")
  ];
}

function createStarterProduct(name, type, category, unit, price, sku) {
  return {
    name,
    type,
    category,
    unit,
    price,
    sku,
    barcode: ""
  };
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}
