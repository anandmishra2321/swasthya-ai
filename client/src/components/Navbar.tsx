import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Building2, FileText, LogOut, Menu, Pill, Stethoscope, X, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { QuickDemoLogin } from './QuickDemoLogin';
import { LanguageToggle } from './LanguageToggle';
import { WorkspaceSwitcherModal } from './WorkspaceSwitcherModal';
import { ThemeToggle } from './ThemeToggle';
import { NotificationCenter } from './NotificationCenter';
import { getDashboardPath } from '../config/roles';

export const Navbar: React.FC = () => {
  const { user, logout, activeWorkspace } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/70 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-slate-100 leading-none flex items-center gap-1.5">
                    <span>Swasthya</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">AI</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                    Smart Rewa Healthcare
                  </div>
                </div>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  to="/discovery"
                  className="px-3 py-2 rounded-lg text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/20 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1.5"
                >
                  <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Nearby Discovery
                </Link>
                <Link
                  to="/hospitals"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  {t('nav.hospitals')}
                </Link>
                <Link
                  to="/doctors"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  {t('nav.doctors')}
                </Link>
                <Link
                  to="/pharmacies"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  {t('nav.pharmacies')}
                </Link>
                <Link
                  to="/labs"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  {t('nav.labs')}
                </Link>
              </nav>
            </div>

            {/* Right side controls */}
            <div className="hidden lg:flex items-center gap-2">
              <QuickDemoLogin />
              <LanguageToggle />
              <ThemeToggle />

              {user ? (
                <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-700">
                  {/* Live notification bell */}
                  <NotificationCenter />

                  {/* Workspace selector button */}
                  <button
                    onClick={() => setWorkspaceModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Switch clinical or administrative workspace"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="max-w-[130px] truncate">
                      {activeWorkspace ? activeWorkspace.organizationName : 'Personal Workspace'}
                    </span>
                  </button>

                  {/* Dashboard link */}
                  <Link
                    to={getDashboardPath(user.role)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                  >
                    {t('nav.dashboard')}
                  </Link>

                  {/* Profile info & Logout */}
                  <div className="flex items-center gap-2 pl-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[100px] truncate">
                      {user.name}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors"
                  >
                    {t('nav.signIn')}
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu hamburger */}
            <div className="flex lg:hidden items-center gap-1">
              <ThemeToggle />
              {user && <NotificationCenter />}
              <LanguageToggle />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
            <div className="pb-2">
              <QuickDemoLogin />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/discovery"
                onClick={() => setMobileMenuOpen(false)}
                className="col-span-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-sm font-bold flex items-center gap-2"
              >
                <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Nearby Healthcare Discovery
              </Link>
              <Link
                to="/hospitals"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t('nav.hospitals')}
              </Link>
              <Link
                to="/doctors"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Stethoscope className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t('nav.doctors')}
              </Link>
              <Link
                to="/pharmacies"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Pill className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t('nav.pharmacies')}
              </Link>
              <Link
                to="/labs"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t('nav.labs')}
              </Link>
            </div>

            {user ? (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <Link
                  to={getDashboardPath(user.role)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-2.5 text-center font-bold text-sm bg-indigo-600 text-white rounded-xl"
                >
                  Go to {t('nav.dashboard')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full py-2 text-center text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 py-2 text-center text-sm font-semibold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  {t('nav.signIn')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 py-2 text-center text-sm font-semibold bg-indigo-600 text-white rounded-lg"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <WorkspaceSwitcherModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
      />
    </>
  );
};
