import React, { useState, useEffect } from 'react';
import { TestTube2, Search, MapPin, Phone, Clock, CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';
import { api } from '../services/api';
import { Organization } from '../types';

export const DirectoryLabsPage: React.FC = () => {
  const [labs, setLabs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const testCatalog = [
    { name: 'Complete Blood Count (CBC) + ESR', category: 'Hematology', price: '₹280', time: 'Same day (4 hours)', fasting: 'No fasting required' },
    { name: 'Lipid Profile (Cholesterol, HDL, LDL, Triglycerides)', category: 'Biochemistry', price: '₹450', time: 'Same day', fasting: '10-12 hours fasting required' },
    { name: 'HbA1c & Fasting Blood Glucose', category: 'Diabetology', price: '₹390', time: 'Same day', fasting: 'Overnight fasting' },
    { name: 'Liver Function Test (LFT) & Kidney Function (KFT)', category: 'Biochemistry', price: '₹750', time: '24 hours', fasting: '8 hours fasting recommended' },
    { name: 'Thyroid Profile (Total T3, T4, TSH)', category: 'Endocrinology', price: '₹400', time: 'Same day', fasting: 'Morning sample preferred' },
  ];

  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/organizations?type=diagnostic_lab');
      if (res.success) setLabs(res.data);
    } catch (err) {
      console.error('Failed to load labs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
          <TestTube2 className="w-8 h-8 text-indigo-600" />
          Diagnostic Labs & Pathology Centers
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          NABL-compliant partner laboratories with digital sample tracking and authorized patient report release.
        </p>
      </div>

      {/* Lab Centers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {labs.map((lab) => (
          <div
            key={lab._id}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{lab.name}</h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Accreditation: {lab.registrationNumber || 'LAB-MP-REW-2024'}
                </div>
              </div>
              <span className="badge-verified">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Center
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{lab.address.street}, {lab.address.area}, {lab.address.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{lab.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{lab.operatingHours}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {lab.services.map((svc) => (
                <span
                  key={svc}
                  className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[11px] font-medium border border-indigo-100"
                >
                  {svc}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Standard Test Catalog & Preparation Guidelines */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Popular Diagnostic Tests & Preparation</h2>
          <p className="text-xs text-slate-500">
            Transparent test pricing, sample turnaround estimates, and mandatory fasting instructions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Investigation / Test Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Estimated Price</th>
                <th className="px-4 py-3">Turnaround Time</th>
                <th className="px-4 py-3">Preparation & Fasting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testCatalog.map((t) => (
                <tr key={t.name} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{t.name}</td>
                  <td className="px-4 py-3.5 text-slate-600">{t.category}</td>
                  <td className="px-4 py-3.5 font-bold text-indigo-700">{t.price}</td>
                  <td className="px-4 py-3.5 text-slate-600">{t.time}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      {t.fasting}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-400 italic text-center pt-2">
          *Report timeframes are estimates. Diagnostic findings are only accessible to patients after authorized release by the pathologist.
        </p>
      </div>
    </div>
  );
};
