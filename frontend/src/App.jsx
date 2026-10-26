import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';

import ProtectedRoute from './components/common/ProtectedRoute';
import PermissionRoute from './components/common/PermissionRoute';
import MainLayout from './components/layout/MainLayout';
import TopProgressBar from './components/common/TopProgressBar';

// Lazy Loaded Pages for Instant Initial Loading & Code Splitting
const Landing = lazy(() => import('./pages/Landing/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const ProductList = lazy(() => import('./pages/Products/ProductList'));
const CategoryList = lazy(() => import('./pages/Categories/CategoryList'));
const SalesList = lazy(() => import('./pages/Sales/SalesList'));
const SalesDashboard = lazy(() => import('./pages/Sales/SalesDashboard'));
const SalesReturn = lazy(() => import('./pages/Sales/SalesReturn'));
const StockDashboard = lazy(() => import('./pages/Stock/StockDashboard'));
const VendorReturnManagement = lazy(() => import('./pages/Stock/VendorReturnManagement'));
const BorrowLedger = lazy(() => import('./pages/Borrow/BorrowLedger'));
const Reports = lazy(() => import('./pages/Reports/Reports'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdmin/SuperAdminDashboard'));
const Billing = lazy(() => import('./pages/Billing/Billing'));
const StoreManagement = lazy(() => import('./pages/SuperAdmin/StoreManagement'));
const StaffList = lazy(() => import('./pages/Users/StaffList'));
const NotificationHistory = lazy(() => import('./pages/Notifications/NotificationHistory'));
const VendorList = lazy(() => import('./pages/Vendors/VendorList'));
const CustomerList = lazy(() => import('./pages/Customers/CustomerList'));
const ActivityLogs = lazy(() => import('./pages/Settings/ActivityLogs'));

// Auth Pages
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));

import { useAppDispatch, useAppSelector } from './store/hooks';
import { hideToast } from './store/slices/notificationSlice';

// Sleek fast-loading placeholder for async routes
const PageLoader = () => (
  <div className="flex h-[60vh] w-full items-center justify-center">
    <div className="flex flex-col items-center gap-2.5">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-400">Loading module...</span>
    </div>
  </div>
);

const GlobalToast = () => {
  const toast = useAppSelector((state) => state.notifications.toast);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        dispatch(hideToast());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, dispatch]);

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl max-w-sm">
      <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border text-[10px] ${
        isError 
          ? 'bg-rose-50 border-rose-100 text-rose-500' 
          : 'bg-emerald-50 border-emerald-100 text-emerald-500'
      }`}>
        {isError ? '⚠️' : '✅'}
      </div>
      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
        {toast.msg}
      </p>
      <button 
        onClick={() => dispatch(hideToast())}
        className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-305 text-[10px] font-black cursor-pointer ml-auto"
      >
        ✕
      </button>
    </div>
  );
};

import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <TopProgressBar />
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            padding: '12px 18px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
      <GlobalToast />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Home & Auth Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-store" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Super Admin Platform Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Super Admin']} />}>
            <Route path="/superadmin" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/stores" element={<StoreManagement />} />
          </Route>

          {/* Protected ERP Modules Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Sales Manager', 'Purchase Manager', 'Employee', 'Purchase Employee', 'Sales Employee']} />}>
            <Route path="/dashboard" element={<MainLayout />}>
              <Route index element={<PermissionRoute permission="view_dashboard"><Dashboard /></PermissionRoute>} />
              <Route path="products" element={<PermissionRoute permission="view_products"><ProductList /></PermissionRoute>} />
              <Route path="categories" element={<PermissionRoute permission="view_categories"><CategoryList /></PermissionRoute>} />
              <Route path="vendors" element={<PermissionRoute permission="view_vendors"><VendorList /></PermissionRoute>} />
              <Route path="customers" element={<PermissionRoute permission="manage_customers"><CustomerList /></PermissionRoute>} />
              <Route path="purchase" element={<Navigate to="/dashboard/purchase/orders" replace />} />
              <Route path="purchase/orders" element={<PermissionRoute permission="view_purchases"><StockDashboard /></PermissionRoute>} />
              <Route path="sales" element={<PermissionRoute permission="view_sales"><SalesList /></PermissionRoute>} />
              <Route path="sales/returns" element={<PermissionRoute permission="view_sales"><SalesReturn /></PermissionRoute>} />
              <Route path="sales-dashboard" element={<PermissionRoute permission="view_sales"><SalesDashboard /></PermissionRoute>} />
              <Route path="stock" element={<PermissionRoute permission="view_stock"><StockDashboard /></PermissionRoute>} />
              <Route path="stock/in" element={<Navigate to="/dashboard/stock" replace />} />
              <Route path="stock/out" element={<Navigate to="/dashboard/stock" replace />} />
              <Route path="stock/adjustment" element={<PermissionRoute permission="adjust_stock"><StockDashboard /></PermissionRoute>} />
              <Route path="stock/history" element={<Navigate to="/dashboard/stock" replace />} />
              <Route path="stock/returns" element={<PermissionRoute permission="view_returns"><VendorList defaultView="returns" /></PermissionRoute>} />
              <Route path="stock/destroy" element={<PermissionRoute permission="destroy_stock"><StockDashboard /></PermissionRoute>} />
              <Route path="borrow" element={<PermissionRoute permission="view_borrow"><BorrowLedger /></PermissionRoute>} />
              <Route path="reports" element={<PermissionRoute permission="view_reports"><Reports /></PermissionRoute>} />
              <Route path="staff" element={<PermissionRoute permission="manage_users"><StaffList /></PermissionRoute>} />
              <Route path="billing" element={<PermissionRoute permission="view_billing"><Billing /></PermissionRoute>} />
              <Route path="notifications" element={<PermissionRoute permission="view_notifications"><NotificationHistory /></PermissionRoute>} />
              <Route path="activity-logs" element={<PermissionRoute permission="view_activity_logs"><ActivityLogs /></PermissionRoute>} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
