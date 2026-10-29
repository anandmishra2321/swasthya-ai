import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { TiltEffect } from './components/TiltEffect';
import { DemoBanner } from './components/DemoBanner';
import { Navbar } from './components/Navbar';
import { getDashboardPath, getRoleLabel, rolesForPath, ALL_ROLES } from './config/roles';
import type { UserRole } from './types';

/**
 * Route-level code splitting. The 3D hero and the Leaflet map are the two
 * heaviest dependencies in the app, so every page is loaded on demand instead
 * of shipping one multi-hundred-kilobyte bundle.
 */
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const DirectoryHospitalsPage = lazy(() =>
  import('./pages/DirectoryHospitalsPage').then((m) => ({ default: m.DirectoryHospitalsPage }))
);
const DirectoryDoctorsPage = lazy(() =>
  import('./pages/DirectoryDoctorsPage').then((m) => ({ default: m.DirectoryDoctorsPage }))
);
const DirectoryPharmaciesPage = lazy(() =>
  import('./pages/DirectoryPharmaciesPage').then((m) => ({ default: m.DirectoryPharmaciesPage }))
);
const DirectoryLabsPage = lazy(() =>
  import('./pages/DirectoryLabsPage').then((m) => ({ default: m.DirectoryLabsPage }))
);
const DiscoveryPage = lazy(() => import('./pages/DiscoveryPage').then((m) => ({ default: m.DiscoveryPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() =>
  import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);

const PatientDashboard = lazy(() =>
  import('./pages/patient/PatientDashboard').then((m) => ({ default: m.PatientDashboard }))
);
const DoctorDashboard = lazy(() =>
  import('./pages/doctor/DoctorDashboard').then((m) => ({ default: m.DoctorDashboard }))
);
const HospitalAdminDashboard = lazy(() =>
  import('./pages/hospital/HospitalAdminDashboard').then((m) => ({ default: m.HospitalAdminDashboard }))
);
const ReceptionistDashboard = lazy(() =>
  import('./pages/receptionist/ReceptionistDashboard').then((m) => ({ default: m.ReceptionistDashboard }))
);
const PharmacyDashboard = lazy(() =>
  import('./pages/pharmacy/PharmacyDashboard').then((m) => ({ default: m.PharmacyDashboard }))
);
const LabDashboard = lazy(() => import('./pages/lab/LabDashboard').then((m) => ({ default: m.LabDashboard })));
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const RoleWorkspacePage = lazy(() =>
  import('./pages/workspace/RoleWorkspacePage').then((m) => ({ default: m.RoleWorkspacePage }))
);

const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center gap-3 py-24 text-slate-500" role="status" aria-live="polite">
    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
    <span className="text-sm font-medium">Loading workspace…</span>
  </div>
);

const SessionCheck: React.FC = () => (
  <div className="flex items-center justify-center gap-3 py-24 text-slate-500" role="status" aria-live="polite">
    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
    <span className="text-sm font-medium">Verifying session…</span>
  </div>
);

/** Explains, rather than hides, a role that opened the wrong console. */
const NotAuthorised: React.FC<{ allowed: UserRole[] }> = ({ allowed }) => {
  const { user } = useAuth();
  const own = getDashboardPath(user?.role);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7 text-amber-600" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">This console is not assigned to your role</h1>
      <p className="mt-2 text-sm text-slate-600">
        You are signed in as <strong>{getRoleLabel(user?.role)}</strong>. This workspace is restricted to:{' '}
        <strong>{allowed.map((r) => getRoleLabel(r)).join(', ')}</strong>.
      </p>
      <Link
        to={own}
        className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
      >
        Go to my console
      </Link>
    </div>
  );
};

/**
 * Auth + role gate. `allowedRoles` is derived from the role registry so the
 * client guard can never drift from the declared routing table.
 */
const GuardedRoute: React.FC<{ roles: UserRole[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <SessionCheck />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <NotAuthorised allowed={roles} />;
  }

  return <>{children}</>;
};

/** Sends a signed-in user to whichever console their role owns. */
const DashboardIndex: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <SessionCheck />;
  return <Navigate to={getDashboardPath(user?.role)} replace />;
};

export const App: React.FC = () => {
  // Fall back to the full role list if a path ever lacks a registry entry.
  const roles = (path: string) => {
    const found = rolesForPath(path);
    return found.length > 0 ? found : ALL_ROLES;
  };

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SocketProvider>
            <BrowserRouter>
              <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-200">
                 <TiltEffect />
                {/* Top Demo Disclaimer & Emergency Helpline */}
                <DemoBanner />

                {/* Main Navigation Bar */}
                <Navbar />

                {/* Application Views */}
                <main className="flex-1">
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      {/* Public Directories & Landing */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/discovery" element={<DiscoveryPage />} />
                      <Route path="/hospitals" element={<DirectoryHospitalsPage />} />
                      <Route path="/doctors" element={<DirectoryDoctorsPage />} />
                      <Route path="/pharmacies" element={<DirectoryPharmaciesPage />} />
                      <Route path="/labs" element={<DirectoryLabsPage />} />

                      {/* Authentication Flows */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/verify-email" element={<VerifyEmailPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />

                      {/* Role-consoles. Access lists come from config/roles.ts */}
                      <Route path="/dashboard" element={<DashboardIndex />} />

                      <Route
                        path="/dashboard/patient"
                        element={
                          <GuardedRoute roles={roles('/dashboard/patient')}>
                            <PatientDashboard />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/doctor"
                        element={
                          <GuardedRoute roles={roles('/dashboard/doctor')}>
                            <DoctorDashboard />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/hospital"
                        element={
                          <GuardedRoute roles={roles('/dashboard/hospital')}>
                            <HospitalAdminDashboard />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/receptionist"
                        element={
                          <GuardedRoute roles={roles('/dashboard/receptionist')}>
                            <ReceptionistDashboard />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/pharmacy"
                        element={
                          <GuardedRoute roles={roles('/dashboard/pharmacy')}>
                            <PharmacyDashboard />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/lab"
                        element={
                          <GuardedRoute roles={roles('/dashboard/lab')}>
                            <LabDashboard />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/admin"
                        element={
                          <GuardedRoute roles={roles('/dashboard/admin')}>
                            <AdminDashboard />
                          </GuardedRoute>
                        }
                      />

                      {/* Shared role workspace for roles without a bespoke console */}
                      <Route
                        path="/dashboard/hospital-staff"
                        element={
                          <GuardedRoute roles={roles('/dashboard/hospital-staff')}>
                            <RoleWorkspacePage />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/clinic-admin"
                        element={
                          <GuardedRoute roles={roles('/dashboard/clinic-admin')}>
                            <RoleWorkspacePage />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/ambulance"
                        element={
                          <GuardedRoute roles={roles('/dashboard/ambulance')}>
                            <RoleWorkspacePage />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/nurse"
                        element={
                          <GuardedRoute roles={roles('/dashboard/nurse')}>
                            <RoleWorkspacePage />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/doctor-assistant"
                        element={
                          <GuardedRoute roles={roles('/dashboard/doctor-assistant')}>
                            <RoleWorkspacePage />
                          </GuardedRoute>
                        }
                      />
                      <Route
                        path="/dashboard/support"
                        element={
                          <GuardedRoute roles={roles('/dashboard/support')}>
                            <RoleWorkspacePage />
                          </GuardedRoute>
                        }
                      />

                      {/* Fallback */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </main>
              </div>
            </BrowserRouter>
          </SocketProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
