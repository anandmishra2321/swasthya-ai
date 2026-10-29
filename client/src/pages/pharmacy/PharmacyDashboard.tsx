import React, { useState, useEffect } from 'react';
import { Pill, AlertTriangle, Clock, Plus, Search, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PharmacyItem } from '../../types';

export const PharmacyDashboard: React.FC = () => {
  const { user, activeWorkspace } = useAuth();
  const [inventory, setInventory] = useState<PharmacyItem[]>([]);
  const [alerts, setAlerts] = useState<any>({ lowStockCount: 0, nearExpiryCount: 0 });
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'lowStock' | 'nearExpiry'>('all');
  const [loading, setLoading] = useState(true);

  // Add Item Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [brand, setBrand] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('tablet');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [price, setPrice] = useState(50);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, [activeWorkspace, filterMode]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      let query = '';
      if (filterMode === 'lowStock') query = '?lowStockOnly=true';
      if (filterMode === 'nearExpiry') query = '?nearExpiryOnly=true';

      const res: any = await api.get(`/inventory${query}`);
      if (res.success) {
        setInventory(res.data);
        if (res.alerts) setAlerts(res.alerts);
      }
    } catch (err) {
      console.error('Failed to load pharmacy inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    try {
      const res: any = await api.put(`/inventory/${itemId}`, { quantity: newQty });
      if (res.success) {
        setInventory((prev) =>
          prev.map((item) => (item._id === itemId ? { ...item, quantity: newQty } : item))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update stock');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      const res: any = await api.post('/inventory', {
        medicineName: medName,
        genericName,
        brand: brand || 'Generic',
        strength,
        dosageForm,
        batchNumber,
        expiryDate,
        quantity,
        price,
      });

      if (res.success) {
        setAddModalOpen(false);
        setMedName('');
        setGenericName('');
        setStrength('');
        setBatchNumber('');
        setExpiryDate('');
        fetchInventory();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add batch to inventory');
    } finally {
      setAddLoading(false);
    }
  };

  const filtered = inventory.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.medicineName.toLowerCase().includes(q) ||
      item.genericName.toLowerCase().includes(q) ||
      item.batchNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">
              {activeWorkspace?.organizationName || 'Pharmacy & Medical Store Operations'}
            </h1>
            <span className="badge-verified text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Licensed Pharmacy
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Batch-level expiry management, Jan Aushadhi generic availability, and dispensing audit log.
          </div>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Medicine Batch
        </button>
      </div>

      {/* Alert Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterMode('all')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterMode === 'all' ? 'border-indigo-600 bg-indigo-50/40 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Active Batches</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{inventory.length}</div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-1">Live in store inventory</div>
        </div>

        <div
          onClick={() => setFilterMode('lowStock')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterMode === 'lowStock' ? 'border-rose-600 bg-rose-50/40 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Low Stock Alerts
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">{alerts.lowStockCount || 0}</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">Items below safety threshold</div>
        </div>

        <div
          onClick={() => setFilterMode('nearExpiry')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterMode === 'nearExpiry' ? 'border-amber-600 bg-amber-50/40 shadow-2xs' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            Near Expiry / Expired
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">{alerts.nearExpiryCount || 0}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Expiring within 60 days</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by medicine name, generic salt composition, or batch number..."
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-indigo-500 shadow-2xs"
        />
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Pill className="w-5 h-5 text-indigo-600" />
          Medicine Stock Catalogue
        </h2>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Loading medicine batches...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">No medicine items found.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Medicine & Generic Name</th>
                  <th className="px-4 py-3">Strength & Form</th>
                  <th className="px-4 py-3">Batch Number</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Stock Qty</th>
                  <th className="px-4 py-3 text-right">Adjust Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{item.medicineName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.genericName} ({item.brand})</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {item.strength} &bull; <span className="capitalize">{item.dosageForm}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">{item.batchNumber}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{item.expiryDate}</div>
                      {item.isNearExpiry && (
                        <span className="badge-pending text-[9px] px-1.5 py-0 mt-0.5 inline-block">
                          Near Expiry
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">₹{item.price.toFixed(2)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-extrabold ${item.isLowStock ? 'text-rose-600' : 'text-indigo-700'}`}>
                        {item.quantity}
                      </span>
                      {item.isLowStock && (
                        <span className="block text-[10px] text-rose-600 font-bold uppercase">
                          Low Stock Alert!
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleUpdateQuantity(item._id, Math.max(0, item.quantity - 5))}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded flex items-center justify-center text-xs"
                          title="Dispense 5 units"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleUpdateQuantity(item._id, item.quantity + 20)}
                          className="w-7 h-7 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold rounded flex items-center justify-center text-xs"
                          title="Restock 20 units"
                        >
                          +20
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Medicine Batch Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add Medicine Batch</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 font-bold p-1">✕</button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand / Trade Name</label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="e.g. Paracetamol 650mg (Dolo)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Generic / Salt</label>
                  <input
                    type="text"
                    required
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder="e.g. Paracetamol"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Strength</label>
                  <input
                    type="text"
                    required
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g. 650mg"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={dosageForm}
                    onChange={(e) => setDosageForm(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none bg-white focus:border-indigo-500"
                  >
                    <option value="tablet">Tablet</option>
                    <option value="syrup">Syrup</option>
                    <option value="capsule">Capsule</option>
                    <option value="injection">Injection</option>
                    <option value="ointment">Ointment</option>
                    <option value="powder">Powder (ORS)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="BAT-2024-001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {addLoading ? 'Adding...' : 'Save Medicine Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
