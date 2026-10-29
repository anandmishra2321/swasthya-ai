import React, { useState, useEffect } from 'react';
import { Pill, Search, MapPin, Phone, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Organization } from '../types';

export const DirectoryPharmaciesPage: React.FC = () => {
  const [stores, setStores] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Sample medicine stock lookup preview
  const [medicineQuery, setMedicineQuery] = useState('');
  const [sampleInventory, setSampleInventory] = useState([
    { name: 'Paracetamol 650mg (Dolo-650)', generic: 'Paracetamol', form: 'Tablet', inStock: true, qty: 450, price: '₹33.50/strip' },
    { name: 'Telmisartan 40mg (Telma 40)', generic: 'Telmisartan', form: 'Tablet', inStock: true, qty: 120, price: '₹110.00/strip' },
    { name: 'Azithromycin 500mg (Azee 500)', generic: 'Azithromycin', form: 'Tablet', inStock: true, qty: 8, price: '₹119.50/strip' },
    { name: 'Oral Rehydration Salts (Electral)', generic: 'WHO Formula ORS', form: 'Powder', inStock: true, qty: 300, price: '₹22.00/sachet' },
  ]);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/organizations?type=medical_store');
      if (res.success) setStores(res.data);
    } catch (err) {
      console.error('Failed to load pharmacies:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = stores.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.address.area.toLowerCase().includes(q);
  });

  const filteredMeds = sampleInventory.filter((m) => {
    const q = medicineQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.generic.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            <Pill className="w-8 h-8 text-indigo-600" />
            Medical Stores & Jan Aushadhi Pharmacies
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Check real-time stock availability of essential generic and prescription medicines across Rewa.
          </p>
        </div>
      </div>

      {/* Live Medicine Search Widget */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Fast Medicine Stock Availability Check</h2>
            <p className="text-xs text-slate-300">Search generic and branded medicines in stock at registered stores.</p>
          </div>
          <div className="text-[11px] font-mono bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded">
            Live Retail Sync (Demo)
          </div>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={medicineQuery}
            onChange={(e) => setMedicineQuery(e.target.value)}
            placeholder="Type medicine name or generic composition (e.g. Paracetamol, Telmisartan)..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-400"
          />
        </div>

        {/* Stock results table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Medicine & Generic Form</th>
                <th className="px-4 py-2.5">Dosage Form</th>
                <th className="px-4 py-2.5">Price</th>
                <th className="px-4 py-2.5">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredMeds.map((med) => (
                <tr key={med.name} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{med.name}</div>
                    <div className="text-[11px] text-slate-400">{med.generic}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{med.form}</td>
                  <td className="px-4 py-3 font-semibold text-indigo-300">{med.price}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      In Stock ({med.qty} units)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pharmacies List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Registered Pharmacies & Dispensaries</h2>
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading stores...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStores.map((store) => (
              <div
                key={store._id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{store.name}</h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Licence: {store.registrationNumber || 'DL-20-44910-MP'}
                    </div>
                  </div>
                  {store.isVerified && (
                    <span className="badge-verified">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{store.address.street}, {store.address.area}, {store.address.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{store.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{store.operatingHours}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                  {store.services.map((svc) => (
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
        )}
      </div>
    </div>
  );
};
