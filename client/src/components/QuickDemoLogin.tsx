import React, { useState } from 'react';
import { UserCheck, Sparkles, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DEMO_ACCOUNTS = [
  { label: 'Patient (Rahul Verma)', email: 'patient@swasthya.demo', role: 'patient', badge: 'Self-Service' },
  { label: 'Hospital Doctor (Dr. Sunita Sharma)', email: 'doctor.sharma@swasthya.demo', role: 'hospital_doctor', badge: 'Cardiologist' },
  { label: 'Hospital Admin (Dr. R.K. Mishra)', email: 'hospital.admin@swasthya.demo', role: 'hospital_admin', badge: 'SGM Hospital' },
  { label: 'Hospital Bed Manager (Amit Patel)', email: 'bed.manager@swasthya.demo', role: 'bed_manager', badge: 'Capacity Ops' },
  { label: 'Hospital Receptionist (Pooja Tiwari)', email: 'hospital.reception@swasthya.demo', role: 'hospital_receptionist', badge: 'OPD Front Desk' },
  { label: 'Private Doctor (Dr. Manoj Gupta)', email: 'private.doctor@swasthya.demo', role: 'private_doctor', badge: 'Clinic OPD' },
  { label: 'Homeopathy Doctor (Dr. Vivek Saxena)', email: 'homeo.doctor@swasthya.demo', role: 'homeopathy_doctor', badge: 'Arogya Homeo' },
  { label: 'Pharmacy Owner / Pharmacist (Suresh)', email: 'pharmacy.owner@swasthya.demo', role: 'medical_store_owner', badge: 'Inventory & Rx' },
  { label: 'Diagnostic Lab Admin / Tech (Dr. Sandeep)', email: 'lab.admin@swasthya.demo', role: 'lab_admin', badge: 'Release Gating' },
  { label: 'Verification Admin (Neha Chaurasia)', email: 'verify.admin@swasthya.demo', role: 'verification_admin', badge: 'Credential Audit' },
  { label: 'Public Health Admin (Dr. K.P. Sen)', email: 'publichealth.admin@swasthya.demo', role: 'public_health_admin', badge: 'Regional Trends' },
  { label: 'Platform Super Admin', email: 'superadmin@swasthya.demo', role: 'platform_super_admin', badge: 'System Wide' },
];

export const QuickDemoLogin: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);

  const handleDemoSelect = async (email: string) => {
    try {
      setLoadingEmail(email);
      const user = await login(email, 'Password123!');
      setIsOpen(false);

      // Route to correct dashboard based on role
      routeUser(user.role);
    } catch (err) {
      alert('Demo login failed. Please ensure the backend is running and seeded.');
    } finally {
      setLoadingEmail(null);
    }
  };

  const routeUser = (role: string) => {
    switch (role) {
      case 'patient':
        navigate('/dashboard/patient');
        break;
      case 'hospital_doctor':
      case 'private_doctor':
      case 'homeopathy_doctor':
        navigate('/dashboard/doctor');
        break;
      case 'hospital_admin':
      case 'bed_manager':
        navigate('/dashboard/hospital');
        break;
      case 'hospital_receptionist':
      case 'clinic_receptionist':
        navigate('/dashboard/receptionist');
        break;
      case 'medical_store_owner':
      case 'pharmacist':
        navigate('/dashboard/pharmacy');
        break;
      case 'lab_admin':
      case 'lab_tech':
        navigate('/dashboard/lab');
        break;
      case 'verification_admin':
      case 'platform_super_admin':
      case 'public_health_admin':
        navigate('/dashboard/admin');
        break;
      default:
        navigate('/dashboard/patient');
    }
  };

  if (!import.meta.env.DEV) return null;

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-xs"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" style={{ animationDuration: '4s' }} />
        <span>One-Click Demo Roles</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              Switch Demo Persona
            </span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">Password123!</span>
          </div>

          <div className="max-h-80 overflow-y-auto py-1 divide-y divide-slate-50">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                disabled={loadingEmail !== null}
                onClick={() => handleDemoSelect(acc.email)}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-900">
                    {acc.label}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{acc.email}</div>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 group-hover:bg-indigo-200/60 group-hover:text-indigo-900">
                  {acc.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
