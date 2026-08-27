import { useEffect, useMemo, useState } from "react";
import {
  Barcode,
  CheckCircle2,
  CircleDollarSign,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Wrench,
  X
} from "lucide-react";
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
  { key: "PHYSICAL", label: "Physical", helper: "Moves stock", icon: Package },
  { key: "SERVICE", label: "Service", helper: "No stock count", icon: Wrench },
  { key: "FEE", label: "Fee / Charge", helper: "Delivery or service charge", icon: CircleDollarSign }
];

export default function ProductsPage() {
  const { activeBusiness, activeBusinessId } = useWorkspace();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);
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
  const physicalWithoutCode = physicalProducts.filter((product) => !product.sku && !product.barcode);
  const visibleProducts = products.slice(0, visibleCount);
  const hiddenProductCount = Math.max(products.length - visibleProducts.length, 0);
  const isEditing = Boolean(editingProductId);
  const guide = getCatalogGuide(activeBusiness);
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

  useEffect(() => {
    setVisibleCount(100);
  }, [activeBusinessId, categoryFilter, search, statusFilter, typeFilter]);

  async function loadProducts(nextSearch = search, overrides = {}) {
    if (!activeBusinessId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const nextTypeFilter = overrides.typeFilter ?? typeFilter;
      const nextStatusFilter = overrides.statusFilter ?? statusFilter;
      const nextCategoryFilter = overrides.categoryFilter ?? categoryFilter;
      const params = {
        ...(nextSearch ? { q: nextSearch } : {}),
        ...(nextTypeFilter !== "ALL" ? { type: nextTypeFilter } : {}),
        ...(nextStatusFilter !== "ALL" ? { status: nextStatusFilter } : {}),
        ...(nextCategoryFilter ? { category: nextCategoryFilter } : {})
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
      const payload = {
        ...form,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        category: form.category.trim(),
        unit: form.unit.trim()
      };
      const product = editingProductId
        ? await updateProduct(activeBusinessId, editingProductId, payload)
        : await createProduct(activeBusinessId, payload);
      setProducts((current) =>
        editingProductId ? current.map((item) => (item.id === product.id ? product : item)) : [product, ...current]
      );
      closeDrawer();
      setMessage(editingProductId ? "Product updated." : "Product created.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to save product.");
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

  function openCreateDrawer() {
    setEditingProductId("");
    setForm(defaultForm);
    setDrawerOpen(true);
    setMessage("");
    setError("");
  }

  function openEditDrawer(product) {
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
    setDrawerOpen(true);
    setMessage("");
    setError("");
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingProductId("");
    setForm(defaultForm);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setCategoryFilter("");
    loadProducts("", { typeFilter: "ALL", statusFilter: "ALL", categoryFilter: "" });
  }

  if (!activeBusiness) {
    return (
      <section className="rounded-md border border-zera-line bg-white p-5">
        <h2 className="text-xl font-bold">Products</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a business before managing products.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-zera-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-zera-green">{guide.eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zera-ink">Products</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{guide.description}</p>
        </div>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-bold text-white shadow-xs hover:bg-zera-greenDark"
          type="button"
          onClick={openCreateDrawer}
        >
          <Plus size={17} />
          New product
        </button>
      </header>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md border border-zera-green/10 bg-zera-mintSoft px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <CatalogCounts
        activeCount={activeProducts.length}
        feeCount={feeProducts.length}
        inactiveCount={inactiveProducts.length}
        loading={loading}
        missingCodeCount={physicalWithoutCode.length}
        physicalCount={physicalProducts.length}
        serviceCount={serviceProducts.length}
        totalCount={products.length}
      />

      <section className="rounded-md border border-zera-line bg-white">
        <CatalogToolbar
          categories={productCategories}
          categoryFilter={categoryFilter}
          filterCount={filterCount}
          onCategoryChange={setCategoryFilter}
          onClearFilters={clearFilters}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearchSubmit}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          search={search}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
        />

        <ProductTable
          business={activeBusiness}
          hiddenCount={hiddenProductCount}
          loading={loading}
          onEdit={openEditDrawer}
          onLoadMore={() => setVisibleCount((current) => current + 100)}
          onStatusToggle={handleStatusToggle}
          products={visibleProducts}
          totalCount={products.length}
          updatingProductId={updatingProductId}
        />
      </section>

      {drawerOpen ? (
        <ProductDrawer
          business={activeBusiness}
          form={form}
          isEditing={isEditing}
          onChange={setForm}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function CatalogCounts({ activeCount, feeCount, inactiveCount, loading, missingCodeCount, physicalCount, serviceCount, totalCount }) {
  const items = [
    { label: "Total", value: totalCount },
    { label: "Active", value: activeCount },
    { label: "Physical", value: physicalCount },
    { label: "Services / fees", value: serviceCount + feeCount },
    { label: "Paused", value: inactiveCount },
    { label: "Need codes", value: missingCodeCount, attention: missingCodeCount > 0 }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div
          className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm shadow-xs ${
            item.attention ? "border-amber-200 bg-amber-50 text-amber-800" : "border-zera-line bg-white text-zera-muted"
          }`}
          key={item.label}
        >
          <span className="font-semibold">{item.label}</span>
          <span className="font-bold text-zera-ink">{loading ? "..." : item.value}</span>
        </div>
      ))}
    </div>
  );
}

function CatalogToolbar({
  categories,
  categoryFilter,
  filterCount,
  onCategoryChange,
  onClearFilters,
  onSearchChange,
  onSearchSubmit,
  onStatusChange,
  onTypeChange,
  search,
  statusFilter,
  typeFilter
}) {
  return (
    <div className="overflow-x-auto border-b border-zera-line bg-white px-3 py-2">
      <div className="flex min-w-max flex-nowrap items-center gap-2">
        <form
          className="flex h-9 w-[320px] shrink-0 items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10"
          onSubmit={onSearchSubmit}
        >
          <Search size={16} className="shrink-0 text-zera-muted" />
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="Search product, category, SKU, or barcode"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </form>

        <SegmentedTypeFilter value={typeFilter} onChange={onTypeChange} />

        <SelectControl label="Status" value={statusFilter} onChange={onStatusChange} widthClass="w-[112px]">
          <option value="ALL">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Paused</option>
        </SelectControl>

        <SelectControl label="Category" value={categoryFilter} onChange={onCategoryChange} widthClass="w-[150px]">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </SelectControl>

        <button
          className="h-9 w-[64px] shrink-0 rounded-md border border-zera-line bg-white px-2 text-sm font-bold text-zera-muted hover:bg-zera-mintSoft hover:text-zera-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!filterCount}
          type="button"
          onClick={onClearFilters}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function SegmentedTypeFilter({ onChange, value }) {
  const items = [
    { label: "All", value: "ALL" },
    { label: "Physical", value: "PHYSICAL" },
    { label: "Service", value: "SERVICE" },
    { label: "Fee", value: "FEE" }
  ];

  return (
    <div className="inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-zera-line bg-zera-surface p-1">
      {items.map((item) => (
        <button
          className={`h-7 min-w-[72px] rounded px-2 text-sm font-bold transition ${
            value === item.value ? "bg-white text-zera-green shadow-xs" : "text-zera-muted hover:bg-white hover:text-zera-ink"
          }`}
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SelectControl({ children, label, onChange, value, widthClass = "w-40" }) {
  return (
    <label className={`block shrink-0 ${widthClass}`}>
      <span className="sr-only">{label}</span>
      <select
        className="h-9 w-full rounded-md border border-zera-line bg-white px-2.5 text-sm font-semibold text-zera-ink outline-none focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function ProductTable({ business, hiddenCount, loading, onEdit, onLoadMore, onStatusToggle, products, totalCount, updatingProductId }) {
  if (!loading && totalCount === 0) {
    return (
      <div className="m-4 rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-6 text-sm text-zera-muted">
        No products match this view. Create a product or clear filters.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="max-h-[calc(100vh-292px)] min-w-[980px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
              <tr>
                <th className="w-[30%] px-3 py-2.5">Product</th>
                <th className="w-[12%] px-3 py-2.5">Type</th>
                <th className="w-[14%] px-3 py-2.5">Category</th>
                <th className="w-[17%] px-3 py-2.5">Code</th>
                <th className="w-[13%] px-3 py-2.5 text-right">Price</th>
                <th className="w-[7%] px-3 py-2.5">Status</th>
                <th className="w-[7%] px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zera-line">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-zera-muted" colSpan={7}>
                    Loading products...
                  </td>
                </tr>
              ) : null}

              {!loading && products.map((product) => (
                <ProductRow
                  business={business}
                  key={product.id}
                  onEdit={onEdit}
                  onStatusToggle={onStatusToggle}
                  product={product}
                  updating={updatingProductId === product.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-zera-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zera-muted">
          Showing {loading ? "..." : products.length} of {loading ? "..." : totalCount} products
        </p>
        {hiddenCount > 0 ? (
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-bold text-zera-ink hover:bg-zera-mintSoft"
            type="button"
            onClick={onLoadMore}
          >
            Load {Math.min(hiddenCount, 100)} more
          </button>
        ) : null}
      </div>
    </>
  );
}

function ProductRow({ business, onEdit, onStatusToggle, product, updating }) {
  return (
    <tr className="hover:bg-zera-mintSoft/70">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-zera-ink">{product.name}</p>
          <p className="mt-1 truncate text-xs text-zera-muted">{product.unit ? `Unit: ${product.unit}` : "No unit set"}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <ProductTypeBadge type={product.type} />
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-zera-mintSoft px-2 py-1 text-xs font-semibold text-zera-muted">
          <Tag size={13} />
          <span className="truncate">{product.category || "No category"}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
            product.sku || product.barcode ? "bg-zera-mintSoft text-zera-muted" : "bg-amber-50 text-amber-700"
          }`}
        >
          <Barcode size={13} />
          <span className="truncate">{product.sku || product.barcode || "Needs code"}</span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-bold">
        {formatMoney(product.price, business.currency)}
        {product.unit ? <span className="block text-xs font-semibold text-zera-muted">per {product.unit}</span> : null}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={product.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink hover:bg-zera-mintSoft"
            type="button"
            onClick={() => onEdit(product)}
            aria-label={`Edit ${product.name}`}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-bold ${
              product.status === "ACTIVE"
                ? "border-zera-line bg-white text-zera-ink hover:bg-red-50 hover:text-red-700"
                : "border-zera-green bg-zera-green text-white hover:bg-zera-greenDark"
            }`}
            disabled={updating}
            type="button"
            onClick={() => onStatusToggle(product)}
          >
            {product.status === "ACTIVE" ? "Pause" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProductDrawer({ business, form, isEditing, onChange, onClose, onSubmit, saving }) {
  const selectedType = productTypes.find((type) => type.key === form.type) || productTypes[0];
  const hints = getProductFormHints(business, form.type);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
      <button className="hidden flex-1 cursor-default lg:block" type="button" aria-label="Close product form" onClick={onClose} />
      <aside className="flex h-full w-full max-w-2xl flex-col border-l border-zera-line bg-white shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-zera-line bg-zera-mintSoft/40 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase text-zera-green">{business.name}</p>
            <h3 className="mt-1 text-xl font-bold">{isEditing ? "Edit product" : "New product"}</h3>
            <p className="mt-1 text-sm text-zera-muted">Keep the record clear enough for checkout, stock, and receipts.</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-md text-zera-muted hover:bg-zera-surface" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-y-auto px-5 py-4" onSubmit={onSubmit}>
          <div className="space-y-4">
            <section className="rounded-md border border-zera-line bg-zera-mintSoft p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold">Product type</h4>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-zera-muted">{selectedType.helper}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {productTypes.map((type) => {
                  const Icon = type.icon;
                  const selected = form.type === type.key;

                  return (
                    <button
	                    className={`flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 text-left shadow-xs ${
	                        selected ? "border-zera-green bg-white text-zera-green ring-2 ring-zera-green/10" : "border-zera-line bg-white text-zera-ink hover:bg-zera-surface"
                      }`}
                      key={type.key}
                      type="button"
                      onClick={() => onChange({ ...form, type: type.key })}
                    >
                      <Icon className="shrink-0" size={18} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{type.label}</span>
                        <span className={`block truncate text-xs ${selected ? "text-zera-green" : "text-zera-muted"}`}>{type.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-zera-line p-4">
              <SectionLabel title="Product details" helper="Use names and categories staff can recognize quickly at checkout." />
              <div className="mt-3 space-y-3">
              <Field label="Product name" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Category"
                  placeholder={hints.category}
                  value={form.category}
                  onChange={(value) => onChange({ ...form, category: value })}
                />
                <Field
                  label="Unit"
                  placeholder={hints.unit}
                  value={form.unit}
                  onChange={(value) => onChange({ ...form, unit: value })}
                />
              </div>
              </div>
            </section>

            <section className="rounded-md border border-zera-line p-4">
              <SectionLabel title="Selling and codes" helper={form.type === "PHYSICAL" ? "Codes help scanning and inventory accuracy." : "Codes are optional for non-stock items."} />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Price" min="0" required step="0.01" type="number" value={form.price} onChange={(value) => onChange({ ...form, price: value })} />
                <Field label="SKU" placeholder={hints.sku} value={form.sku} onChange={(value) => onChange({ ...form, sku: value })} />
                <Field label="Barcode" placeholder={hints.barcode} value={form.barcode} onChange={(value) => onChange({ ...form, barcode: value })} />
              </div>
            </section>

            <section className="rounded-md border border-zera-line bg-zera-mintSoft p-4">
              <p className="text-xs font-bold uppercase text-zera-green">Checkout preview</p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{form.name || "Product name"}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">
                    {selectedType.label} · {form.category || "No category"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold">{formatMoney(form.price || 0, business.currency)}</p>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-2 border-t border-zera-line bg-white py-4 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-bold text-zera-ink hover:bg-zera-surface"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-bold text-white shadow-xs hover:bg-zera-greenDark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              <CheckCircle2 size={16} />
              {saving ? "Saving..." : isEditing ? "Save changes" : "Create product"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function getProductFormHints(business, productType) {
  const businessType = (business?.type || "").toLowerCase();

  if (businessType.includes("electronic")) {
    if (productType === "SERVICE") {
      return {
        category: "Repairs, setup, diagnostics",
        unit: "service",
        sku: "Optional service code",
        barcode: "Optional"
      };
    }

    if (productType === "FEE") {
      return {
        category: "Delivery, warranty, service charge",
        unit: "charge",
        sku: "Optional charge code",
        barcode: "Optional"
      };
    }

    return {
      category: "Phones, accessories, parts",
      unit: "piece, unit, pair",
      sku: "e.g. CHG-IP20W",
      barcode: "Scan box barcode"
    };
  }

  if (productType === "SERVICE") {
    return {
      category: "Consultation, repair, service",
      unit: "service",
      sku: "Optional service code",
      barcode: "Optional"
    };
  }

  if (productType === "FEE") {
    return {
      category: "Delivery, service charge",
      unit: "charge",
      sku: "Optional charge code",
      barcode: "Optional"
    };
  }

  return {
    category: "Drinks, grocery, accessories",
    unit: "bottle, kg, pack",
    sku: "Optional product code",
    barcode: "Scan or type barcode"
  };
}

function SectionLabel({ helper, title }) {
  return (
    <div>
      <h4 className="text-sm font-bold">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-zera-muted">{helper}</p>
    </div>
  );
}

function Field({ label, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zera-ink">{label}</span>
      <input
        className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition placeholder:text-zera-muted/60 focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${status === "ACTIVE" ? "bg-zera-mintSoft text-zera-green" : "bg-red-50 text-red-700"}`}>
      {status === "ACTIVE" ? "Active" : "Paused"}
    </span>
  );
}

function ProductTypeBadge({ type }) {
  const className =
    type === "PHYSICAL"
      ? "bg-zera-mintSoft text-zera-green"
      : type === "SERVICE"
        ? "bg-blue-50 text-blue-700"
        : "bg-amber-50 text-amber-700";

  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${className}`}>{formatProductType(type)}</span>;
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
      eyebrow: "Menu catalog",
      description: "Meals, drinks, service charges, and menu items used by waiters and cashiers."
    };
  }

  if (type.includes("pharmacy")) {
    return {
      eyebrow: "Pharmacy catalog",
      description: "Medicines, consultations, and counter charges prepared for fast search and checkout."
    };
  }

  if (type.includes("hotel")) {
    return {
      eyebrow: "Guest billing catalog",
      description: "Guest services, minibar items, fees, and front desk charges."
    };
  }

  if (type.includes("supermarket")) {
    return {
      eyebrow: "Supermarket catalog",
      description: "High-volume checkout items with clear categories, prices, and barcode-friendly records."
    };
  }

  if (type.includes("electronic")) {
    return {
      eyebrow: "Electronics catalog",
      description: "Devices, accessories, repair services, and charges prepared for fast search, stock tracking, and clean receipts."
    };
  }

  return {
    eyebrow: "Sales catalog",
    description: "Products, services, and charges that appear in POS, inventory, receipts, and reports."
  };
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}
