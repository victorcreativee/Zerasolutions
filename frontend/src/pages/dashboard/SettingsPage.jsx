import { useEffect, useMemo, useState } from "react";
import { Boxes, Building2, ChartNoAxesCombined, MapPin, Plus, ReceiptText, ShieldCheck, Smartphone, Store, Table2, Wallet, X } from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createBranch, updateBranchStatus, updateBusinessProfile } from "../../services/setupService.js";

const defaultProfileForm = {
  name: "",
  type: "",
  country: "",
  currency: ""
};

const defaultBranchForm = {
  name: "",
  location: ""
};

const settingsTabs = [
  { label: "Profile", value: "profile" },
  { label: "Branches", value: "branches" },
  { label: "Modules & roles", value: "access" }
];

const moduleDetails = {
  POS: {
    name: "POS",
    description: "Sales, open bills, receipts, and checkout workflows.",
    icon: ReceiptText
  },
  INVENTORY: {
    name: "Inventory",
    description: "Products, stock receiving, adjustments, and stock visibility.",
    icon: Boxes
  },
  FINANCE: {
    name: "Finance",
    description: "Money tracking and business reports. Deeper accounting comes later.",
    icon: Wallet
  },
  OPERATIONS: {
    name: "Operations",
    description: "Daily branch workflows and operational tools.",
    icon: Store
  },
  REPORTS: {
    name: "Reports",
    description: "Sales, products, payments, staff, and branch performance.",
    icon: ChartNoAxesCombined
  }
};

export default function SettingsPage() {
  const { activeBusiness, activeBusinessId, loading, refreshWorkspace, selectBranch } = useWorkspace();
  const roleDetails = useMemo(() => buildRoleDetails(activeBusiness), [activeBusiness]);
  const workflow = useMemo(() => getPOSWorkflowInfo(activeBusiness), [activeBusiness]);
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState(defaultProfileForm);
  const [branchForm, setBranchForm] = useState(defaultBranchForm);
  const [showBranchPanel, setShowBranchPanel] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [updatingBranchId, setUpdatingBranchId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setBranchForm(defaultBranchForm);
    setShowBranchPanel(false);
  }, [activeBusinessId]);

  useEffect(() => {
    setProfileForm(
      activeBusiness
        ? {
            name: activeBusiness.name || "",
            type: activeBusiness.type || "",
            country: activeBusiness.country || "",
            currency: activeBusiness.currency || ""
          }
        : defaultProfileForm
    );
  }, [activeBusiness]);

  async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!activeBusinessId) {
      return;
    }

    setError("");
    setMessage("");
    setSavingProfile(true);

    try {
      const business = await updateBusinessProfile(activeBusinessId, {
        name: profileForm.name,
        country: profileForm.country,
        currency: profileForm.currency.toUpperCase()
      });
      await refreshWorkspace({ preferredBusinessId: business.id });
      setMessage("Business profile updated.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update business profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleBranchSubmit(event) {
    event.preventDefault();

    if (!activeBusinessId) {
      return;
    }

    setError("");
    setMessage("");
    setSavingBranch(true);

    try {
      const branch = await createBranch({
        businessId: activeBusinessId,
        name: branchForm.name,
        location: branchForm.location
      });
      await refreshWorkspace({ preferredBusinessId: branch.businessId, preferredBranchId: branch.id });
      selectBranch(branch.id);
      setBranchForm(defaultBranchForm);
      setShowBranchPanel(false);
      setMessage("Branch created.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create branch.");
    } finally {
      setSavingBranch(false);
    }
  }

  async function handleBranchStatusToggle(branch) {
    if (!activeBusinessId) {
      return;
    }

    const nextStatus = branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError("");
    setMessage("");
    setUpdatingBranchId(branch.id);

    try {
      const updatedBranch = await updateBranchStatus(activeBusinessId, branch.id, nextStatus);
      await refreshWorkspace({ preferredBusinessId: activeBusinessId, preferredBranchId: updatedBranch.id });
      setMessage(`${updatedBranch.name} is now ${updatedBranch.status.toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update branch status.");
    } finally {
      setUpdatingBranchId("");
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="flex flex-col gap-4 border-b border-zera-line px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Business setup</p>
            <h2 className="mt-1 text-2xl font-bold">Workspace settings</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
              Manage the selected business profile, branch locations, and active foundations.
            </p>
          </div>
          {activeBusiness ? <SummaryPill label="Selected business" value={activeBusiness.name} /> : null}
        </div>
        {activeBusiness ? (
          <div className="grid divide-y divide-zera-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <SettingsMetric label="Type" value={activeBusiness.type || "Not set"} />
            <SettingsMetric label="Workflow" value={workflow.label} />
            <SettingsMetric label="Branches" value={`${activeBusiness.branches?.filter((branch) => branch.status === "ACTIVE").length || 0}/${activeBusiness.branches?.length || 0}`} />
            <SettingsMetric label="Modules" value={`${activeBusiness.modules?.filter((module) => module.active).length || 0}/${activeBusiness.modules?.length || 0}`} />
          </div>
        ) : null}
      </header>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      {!activeBusiness && !loading ? (
        <section className="rounded-md border border-zera-line bg-white p-5">
          <h3 className="text-lg font-bold">No business assigned</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">Ask the Zera system admin to create the business account and owner login first.</p>
        </section>
      ) : null}

      {activeBusiness ? (
        <>
          <nav className="flex gap-2 overflow-x-auto rounded-md border border-zera-line bg-white p-2 shadow-xs">
            {settingsTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`h-10 rounded-md px-3 text-sm font-bold transition ${
                  activeTab === tab.value ? "border border-zera-green bg-zera-mintSoft text-zera-green" : "border border-transparent text-zera-muted hover:bg-zera-mintSoft hover:text-zera-green"
                }`}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "profile" ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <form className="overflow-hidden rounded-md border border-zera-line bg-white p-4 shadow-xs" onSubmit={handleProfileSubmit}>
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Business profile</h3>
                    <p className="mt-0.5 text-sm text-zera-muted">System admin controls the business type and sales workflow.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Business name" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required />
                  <ReadOnlyField label="Business type" value={profileForm.type || "Not set"} />
                  <Input label="Country" value={profileForm.country} onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })} />
                  <Input label="Currency" value={profileForm.currency} onChange={(event) => setProfileForm({ ...profileForm, currency: event.target.value.toUpperCase() })} />
                </div>

                <div className="mt-4 flex justify-end">
                  <Button className="h-10 px-4" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              </form>

              <section className="overflow-hidden rounded-md border border-zera-line bg-white p-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
                    <workflow.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Sales workflow</h3>
                    <p className="mt-1 text-sm leading-6 text-zera-muted">{workflow.description}</p>
                    <p className="mt-3 rounded-md bg-zera-mintSoft px-3 py-2 text-xs font-semibold text-zera-muted">Managed by Zera System Admin.</p>
                  </div>
                </div>
              </section>
            </section>
          ) : null}

          {activeTab === "branches" ? (
            <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
              <div className="flex flex-col gap-3 border-b border-zera-line p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold">Branches</h3>
                  <p className="mt-0.5 text-sm text-zera-muted">
                    {loading ? "Loading..." : `${activeBusiness.branches?.length || 0} location${activeBusiness.branches?.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Button type="button" className="h-10 gap-2 px-3" onClick={() => setShowBranchPanel(true)}>
                  <Plus size={16} />
                  New branch
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zera-line bg-zera-mintSoft text-xs uppercase text-zera-muted">
                      <th className="px-4 py-3 font-bold">Branch</th>
                      <th className="px-4 py-3 font-bold">Location</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBusiness.branches?.length ? (
                      activeBusiness.branches.map((branch) => (
                        <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft" key={branch.id}>
                          <td className="px-4 py-3 font-bold">{branch.name}</td>
                          <td className="px-4 py-3 text-zera-muted">{branch.location || "Location not set"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge active={branch.status === "ACTIVE"} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant={branch.status === "ACTIVE" ? "secondary" : "primary"}
                              className="h-9 px-3"
                              disabled={updatingBranchId === branch.id}
                              onClick={() => handleBranchStatusToggle(branch)}
                            >
                              {branch.status === "ACTIVE" ? "Pause" : "Activate"}
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-10 text-center text-zera-muted" colSpan="4">
                          Add the first branch so the workspace has a shop location.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "access" ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <ModulesTable modules={activeBusiness.modules || []} />
              <RolesPanel roles={roleDetails} />
            </section>
          ) : null}

          {showBranchPanel ? (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/20 no-print">
              <form className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onSubmit={handleBranchSubmit}>
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zera-line bg-white p-5">
                  <div>
                    <p className="text-xs font-bold uppercase text-zera-green">New branch</p>
                    <h3 className="mt-1 text-xl font-bold">{activeBusiness.name}</h3>
                    <p className="mt-1 text-sm text-zera-muted">Add a location where this business operates.</p>
                  </div>
                  <button className="rounded-md border border-zera-line p-2 text-zera-muted hover:text-zera-ink" type="button" onClick={() => setShowBranchPanel(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-4 p-5">
                  <Input label="Branch name" value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} required />
                  <Input label="Location" value={branchForm.location} onChange={(event) => setBranchForm({ ...branchForm, location: event.target.value })} />
                </div>
                <div className="sticky bottom-0 border-t border-zera-line bg-white p-5">
                  <Button className="w-full gap-2" disabled={savingBranch}>
                    <Plus size={17} />
                    {savingBranch ? "Creating..." : "Create branch"}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ModulesTable({ modules }) {
  return (
    <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
      <div className="border-b border-zera-line p-4">
        <h3 className="font-bold">Enabled modules</h3>
        <p className="mt-0.5 text-sm text-zera-muted">Visible foundations for this business.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zera-line bg-zera-mintSoft text-xs uppercase text-zera-muted">
              <th className="px-4 py-3 font-bold">Module</th>
              <th className="px-4 py-3 font-bold">Purpose</th>
              <th className="px-4 py-3 text-right font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => {
              const details = moduleDetails[module.key] || {
                name: module.key,
                description: "Prepared for future use.",
                icon: Store
              };
              const Icon = details.icon;

              return (
                <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft" key={module.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
                        <Icon size={17} />
                      </div>
                      <span className="font-bold">{details.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zera-muted">{details.description}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge active={module.active} enabledLabel="Enabled" disabledLabel="Off" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RolesPanel({ roles }) {
  return (
    <section className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3 className="font-bold">Role structure</h3>
          <p className="mt-0.5 text-sm text-zera-muted">Prepared access levels for this business type.</p>
        </div>
      </div>
      <div className="divide-y divide-zera-line rounded-md border border-zera-line">
        {roles.map((role) => (
          <div className="px-3 py-3" key={role.name}>
            <p className="font-bold">{role.name}</p>
            <p className="mt-1 text-sm leading-6 text-zera-muted">{role.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zera-ink">{label}</span>
      <div className="flex h-10 items-center rounded-md border border-zera-line bg-zera-mintSoft px-3 text-sm font-semibold text-zera-muted">{value}</div>
    </label>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-md border border-zera-line bg-white px-3">
      <span className="text-xs font-bold uppercase text-zera-muted">{label}</span>
      <span className="max-w-48 truncate text-sm font-bold text-zera-ink">{value}</span>
    </div>
  );
}

function StatusBadge({ active, disabledLabel = "Inactive", enabledLabel = "Active" }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${active ? "bg-zera-mintSoft text-zera-green" : "bg-red-50 text-red-700"}`}>{active ? enabledLabel : disabledLabel}</span>;
}

function SettingsMetric({ label, value }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zera-ink">{value}</p>
    </div>
  );
}

function buildRoleDetails(activeBusiness) {
  if (activeBusiness?.roles?.length) {
    return activeBusiness.roles;
  }

  const type = (activeBusiness?.type || "").toLowerCase();
  const posMode = activeBusiness?.posMode || "RETAIL_CHECKOUT";
  const baseRoles = [
    { name: "Owner", description: "Full access to business setup, modules, and team accounts." },
    { name: "Manager", description: "Manage daily operations, staff, and branch oversight." }
  ];

  if (posMode === "TABLE_SERVICE" || type.includes("bar") || type.includes("restaurant")) {
    return [
      ...baseRoles,
      { name: "Waiter", description: "Take table orders and record table-service bills." },
      { name: "Cashier", description: "Receive payments and close customer bills." }
    ];
  }

  if (type.includes("pharmacy")) {
    return [
      ...baseRoles,
      { name: "Pharmacist", description: "Serve pharmacy customers and record medicine sales." },
      { name: "Cashier", description: "Receive payments and run checkout." }
    ];
  }

  if (type.includes("retail")) {
    return [
      ...baseRoles,
      { name: "Store Keeper", description: "Support stock-facing shop duties and retail checkout." },
      { name: "Cashier", description: "Run retail checkout and receive payments." }
    ];
  }

  if (type.includes("supermarket")) {
    return [
      ...baseRoles,
      { name: "Cashier", description: "Run fast checkout and receive payments." },
      { name: "Store Keeper", description: "Support product and stock-facing supermarket work." }
    ];
  }

  if (type.includes("electronic")) {
    return [
      ...baseRoles,
      { name: "Cashier", description: "Sell devices and accessories and receive payments." },
      { name: "Store Keeper", description: "Receive device stock and keep product records clean." },
      { name: "Technician", description: "Support repair and device-service workflows." }
    ];
  }

  if (type.includes("hotel")) {
    return [
      ...baseRoles,
      { name: "Front Desk", description: "Serve guest-facing hotel workflows and record service sales." },
      { name: "Cashier", description: "Receive payments and close service bills." }
    ];
  }

  return [...baseRoles, { name: "Cashier", description: "Run checkout and receive payments." }];
}

function getPOSWorkflowInfo(business) {
  const type = (business?.type || "").toLowerCase();

  if (business?.posMode === "TABLE_SERVICE") {
    return {
      description: "Waiters open tables and send orders. Cashiers receive payment, close the bill, and free the table.",
      icon: Table2,
      label: "Table-service POS"
    };
  }

  if (type.includes("electronic")) {
    return {
      description: "Cashiers sell devices and accessories, store keepers manage stock, and technicians support repair-service items.",
      icon: Smartphone,
      label: "Electronics checkout POS"
    };
  }

  return {
    description: "Cashiers or sales staff record sales directly at checkout and receive payment in one flow.",
    icon: Store,
    label: "Retail checkout POS"
  };
}
