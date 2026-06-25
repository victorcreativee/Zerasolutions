import { useEffect, useState } from "react";
import { Boxes, Building2, ChartNoAxesCombined, MapPin, Plus, ReceiptText, ShieldCheck, Store, Table2, Wallet } from "lucide-react";
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

const moduleDetails = {
  POS: {
    name: "POS",
    description: "Retail selling workspace. Sales screens come later.",
    icon: ReceiptText
  },
  INVENTORY: {
    name: "Inventory",
    description: "Stock visibility and control. Placeholder for now.",
    icon: Boxes
  },
  FINANCE: {
    name: "Finance",
    description: "Money tracking and reports. Placeholder for now.",
    icon: Wallet
  },
  OPERATIONS: {
    name: "Operations",
    description: "Daily branch workflows. Placeholder for now.",
    icon: Store
  },
  REPORTS: {
    name: "Reports",
    description: "Business insights and summaries. Placeholder for now.",
    icon: ChartNoAxesCombined
  }
};

const roleDetails = [
  { name: "Owner", description: "Full access to business setup, modules, and team accounts." },
  { name: "Manager", description: "Prepared for daily operations and branch oversight." },
  { name: "Cashier", description: "Prepared for POS access and customer-facing workflows." }
];

export default function SettingsPage() {
  const { activeBusiness, activeBusinessId, loading, refreshWorkspace, selectBranch } = useWorkspace();
  const [profileForm, setProfileForm] = useState(defaultProfileForm);
  const [branchForm, setBranchForm] = useState(defaultBranchForm);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [updatingBranchId, setUpdatingBranchId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setBranchForm(defaultBranchForm);
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
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-zera-green">Business setup</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Workspace settings</h2>
        <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
          Manage the selected business, its branches, and visible module foundations. New businesses are created by the Zera system admin.
        </p>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      {!activeBusiness && !loading ? (
        <section className="rounded-lg border border-zera-line bg-white p-6">
          <h3 className="text-lg font-bold">No business assigned</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">
            Ask the Zera system admin to create the business account and owner login first.
          </p>
        </section>
      ) : null}

      {activeBusiness ? (
        <>
          <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleProfileSubmit}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Business profile</h3>
                  <p className="text-sm text-zera-muted">Created by system admin</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  label="Business name"
                  value={profileForm.name}
                  onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                  required
                />
                <ReadOnlyWorkflow business={activeBusiness} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Country"
                    value={profileForm.country}
                    onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })}
                  />
                  <Input
                    label="Currency"
                    value={profileForm.currency}
                    onChange={(event) => setProfileForm({ ...profileForm, currency: event.target.value.toUpperCase() })}
                  />
                </div>
                <Button className="w-full" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save business profile"}
                </Button>
              </div>
            </form>

            <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleBranchSubmit}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <MapPin size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Add branch</h3>
                  <p className="text-sm text-zera-muted">Business: {activeBusiness.name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  label="Branch name"
                  value={branchForm.name}
                  onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })}
                  required
                />
                <Input
                  label="Location"
                  value={branchForm.location}
                  onChange={(event) => setBranchForm({ ...branchForm, location: event.target.value })}
                />
                <Button className="w-full gap-2" disabled={savingBranch}>
                  <Plus size={17} />
                  {savingBranch ? "Creating..." : "Create branch"}
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                <Store size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Branches</h3>
                <p className="text-sm text-zera-muted">
                  {loading ? "Loading..." : `${activeBusiness.branches?.length || 0} branch${activeBusiness.branches?.length === 1 ? "" : "es"}`}
                </p>
              </div>
            </div>

            {activeBusiness.branches?.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {activeBusiness.branches.map((branch) => (
                  <article key={branch.id} className="rounded-md border border-zera-line p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold">{branch.name}</h4>
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                              branch.status === "ACTIVE" ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {branch.status === "ACTIVE" ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zera-muted">{branch.location || "Location not set"}</p>
                      </div>
                      <Button
                        type="button"
                        variant={branch.status === "ACTIVE" ? "secondary" : "primary"}
                        className="sm:w-28"
                        disabled={updatingBranchId === branch.id}
                        onClick={() => handleBranchStatusToggle(branch)}
                      >
                        {branch.status === "ACTIVE" ? "Pause" : "Activate"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">
                Add the first branch so the workspace has a shop location.
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4">
                <h3 className="text-lg font-bold">Enabled modules</h3>
                <p className="mt-1 text-sm text-zera-muted">System Admin controls which foundations are visible for this business.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(activeBusiness.modules || []).map((module) => {
                  const details = moduleDetails[module.key] || {
                    name: module.key,
                    description: "Prepared for future use.",
                    icon: Store
                  };
                  const Icon = details.icon;

                  return (
                    <article key={module.id} className="rounded-md border border-zera-line p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                            <Icon size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold">{details.name}</h4>
                            <p className="mt-1 text-sm leading-6 text-zera-muted">{details.description}</p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                            module.active ? "bg-zera-mint text-zera-green" : "bg-[#f7faf8] text-zera-muted"
                          }`}
                        >
                          {module.active ? "Enabled" : "Off"}
                        </span>
                      </div>
                      <div className="mt-4 text-xs font-semibold text-zera-muted">Managed by Zera System Admin</div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Role structure</h3>
                  <p className="text-sm text-zera-muted">Prepared access levels.</p>
                </div>
              </div>

              <div className="space-y-3">
                {roleDetails.map((role) => (
                  <article key={role.name} className="rounded-md border border-zera-line p-4">
                    <h4 className="font-bold">{role.name}</h4>
                    <p className="mt-1 text-sm leading-6 text-zera-muted">{role.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ReadOnlyWorkflow({ business }) {
  const workflow = getPOSWorkflowInfo(business);
  const Icon = workflow.icon;

  return (
    <div className="rounded-md border border-zera-line bg-[#f7faf8] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-zera-green">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zera-ink">Business type and sales workflow</p>
          <p className="mt-1 text-sm text-zera-muted">{business.type || "Business type not set"} · {workflow.label}</p>
          <p className="mt-2 text-xs leading-5 text-zera-muted">
            Controlled by Zera System Admin so every branch gets the correct POS experience.
          </p>
        </div>
      </div>
    </div>
  );
}

function getPOSWorkflowInfo(business) {
  if (business?.posMode === "TABLE_SERVICE") {
    return {
      icon: Table2,
      label: "Table-service POS"
    };
  }

  return {
    icon: Store,
    label: "Retail checkout POS"
  };
}
