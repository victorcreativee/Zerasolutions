import PurchasingPage from "./pages/purchasing/PurchasingPage.jsx";
import { lazy, Suspense } from "react";
const HomePage = lazy(() => import("./pages/public/HomePage.jsx"));
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import AccountPage from "./pages/account/AccountPage.jsx";
import CustomersPage from "./pages/customers/CustomersPage.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import SettingsPage from "./pages/dashboard/SettingsPage.jsx";
import UsersPage from "./pages/dashboard/UsersPage.jsx";
import FinancePage from "./pages/finance/FinancePage.jsx";
import InventoryPage from "./pages/inventory/InventoryPage.jsx";
import OperationsPage from "./pages/operations/OperationsPage.jsx";
import OpenBillsPage from "./pages/pos/OpenBillsPage.jsx";
import POSPage from "./pages/pos/POSPage.jsx";
import ProductsPage from "./pages/products/ProductsPage.jsx";
import ReportsPage from "./pages/reports/ReportsPage.jsx";
import SalesPage from "./pages/sales/SalesPage.jsx";
import SystemAdminPage from "./pages/systemAdmin/SystemAdminPage.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import SystemAdminRoute from "./routes/SystemAdminRoute.jsx";
import BusinessOwnerRoute from "./routes/BusinessOwnerRoute.jsx";
import BusinessModuleRoute from "./routes/BusinessModuleRoute.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

const salesRoles = ["Owner", "Manager", "Cashier", "Waiter", "Store Keeper", "Pharmacist", "Front Desk"];
const productRoles = ["Owner", "Manager", "Store Keeper", "Pharmacist"];
const reportRoles = ["Owner", "Manager", "Cashier"];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={window.zeraDesktop ? <Navigate to="/dashboard" replace /> : <Suspense fallback={<div className="min-h-screen bg-[#fbfaf6]" role="status" aria-label="Loading Zera" />}><HomePage /></Suspense>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route element={<BusinessModuleRoute moduleKey="POS" allowedRoles={salesRoles} />}>
            <Route path="/pos" element={<POSPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKey="POS" allowedRoles={["Owner", "Manager", "Cashier"]} />}>
            <Route path="/open-bills" element={<OpenBillsPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKey="POS" allowedRoles={salesRoles} />}>
            <Route path="/sales" element={<SalesPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKey="POS" allowedRoles={salesRoles} />}>
            <Route path="/customers" element={<CustomersPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKeys={["POS", "INVENTORY"]} allowedRoles={productRoles} />}>
            <Route path="/products" element={<ProductsPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKey="INVENTORY" allowedRoles={["Owner", "Manager", "Store Keeper", "Pharmacist"]} />}>
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchasing" element={<PurchasingPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKey="FINANCE" allowedRoles={["Owner"]} />}>
            <Route path="/finance" element={<FinancePage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKey="OPERATIONS" allowedRoles={["Owner", "Manager"]} />}>
            <Route path="/operations" element={<OperationsPage />} />
          </Route>
          <Route element={<BusinessModuleRoute moduleKeys={["REPORTS", "POS"]} allowedRoles={reportRoles} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route element={<BusinessOwnerRoute />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route element={<SystemAdminRoute />}>
            <Route path="/system-admin" element={<SystemAdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
