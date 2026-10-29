import React, { useState, useEffect } from 'react';
import { TestTube2, CheckCircle2, Clock, AlertCircle, Plus, Sparkles, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LabOrder } from '../../types';

export const LabDashboard: React.FC = () => {
  const { user, activeWorkspace } = useAuth();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Order for Result Entry / Release
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultsList, setResultsList] = useState<Array<{ parameter: string; value: string; unit: string; referenceRange: string; isAbnormal: boolean }>>([
    { parameter: 'Hemoglobin', value: '13.8', unit: 'g/dL', referenceRange: '13.0 - 17.0', isAbnormal: false },
  ]);
  const [techNotes, setTechNotes] = useState('Analysis verified on automated biochemistry analyzer.');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchLabOrders();
  }, [activeWorkspace]);

  useEffect(() => {
    const handler = () => fetchLabOrders();
    window.addEventListener('swasthya:lab-result-released', handler);
    return () => window.removeEventListener('swasthya:lab-result-released', handler);
  }, [activeWorkspace]);

  const fetchLabOrders = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/lab-orders');
      if (res.success) {
        setOrders(res.data);
        if (res.data.length > 0 && !selectedOrder) {
          setSelectedOrder(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load lab orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const res: any = await api.patch(`/lab-orders/${orderId}/status`, { status });
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, sampleStatus: status as any } : o))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      setActionLoading(true);
      setActionMessage(null);
      const res: any = await api.patch(`/lab-orders/${selectedOrder._id}/results`, {
        results: resultsList,
        technicianNotes: techNotes,
      });

      if (res.success) {
        setActionMessage('Test results recorded successfully and marked as Completed.');
        fetchLabOrders();
      }
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to save results');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseReport = async (orderId: string) => {
    if (!confirm('Authorize and release this report to the patient?')) return;

    try {
      setActionLoading(true);
      const res: any = await api.patch(`/lab-orders/${orderId}/release`, {});
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, isReleasedToPatient: true } : o))
        );
        if (selectedOrder?._id === orderId) {
          setSelectedOrder({ ...selectedOrder, isReleasedToPatient: true });
        }
        alert('Report has been authorized and published to patient portal.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to release report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddResultRow = () => {
    setResultsList([
      ...resultsList,
      { parameter: '', value: '', unit: '', referenceRange: '', isAbnormal: false },
    ]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">
              {activeWorkspace?.organizationName || 'Diagnostic Pathology & Lab Operations'}
            </h1>
            <span className="badge-verified text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              NABL Verified
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pathologist validation suite with gated report release control.
          </div>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200">
          Pending Releases: {orders.filter((o) => !o.isReleasedToPatient).length}
        </div>
      </div>

      {/* Main Grid: Orders Queue on left, Result Entry / Release on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sample Orders Queue */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TestTube2 className="w-5 h-5 text-indigo-600" />
              Sample Orders Queue
            </h2>
            <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              {orders.length} Total
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading samples...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No lab test orders found.</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {orders.map((order) => {
                const isSelected = selectedOrder?._id === order._id;
                return (
                  <div
                    key={order._id}
                    onClick={() => {
                      setSelectedOrder(order);
                      if (order.results && order.results.length > 0) {
                        setResultsList(order.results);
                      }
                    }}
                    className={`p-4 rounded-2xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {order.sampleId}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          order.isReleasedToPatient
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {order.isReleasedToPatient ? 'Released' : 'Pending Sign-Off'}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 mt-1">{order.testName}</div>
                    <div className="text-[11px] text-slate-500">
                      Patient: <strong>{order.patientId?.name || 'Walk-in'}</strong> &bull; Status: <span className="capitalize font-semibold">{order.sampleStatus}</span>
                    </div>

                    {/* Status Step Buttons */}
                    <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-slate-200/60" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleUpdateStatus(order._id, 'collected')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded"
                      >
                        Collected
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order._id, 'processing')}
                        className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[10px] font-bold rounded"
                      >
                        Processing
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order._id, 'completed')}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded"
                      >
                        Completed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Results Entry & Release Command Panel */}
        <div className="lg:col-span-2 space-y-6">
          {selectedOrder ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="text-xs text-slate-400 font-mono">Sample: {selectedOrder.sampleId}</div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedOrder.testName}</h3>
                  <div className="text-xs text-slate-500">
                    Patient: {selectedOrder.patientId?.name} ({selectedOrder.patientId?.email})
                  </div>
                </div>

                {/* THE RELEASE BUTTON */}
                <div>
                  {selectedOrder.isReleasedToPatient ? (
                    <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Report Released to Patient
                    </div>
                  ) : (
                    <button
                      onClick={() => handleReleaseReport(selectedOrder._id)}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 animate-pulse"
                    >
                      <Send className="w-4 h-4" />
                      Authorize & Release to Patient
                    </button>
                  )}
                </div>
              </div>

              {actionMessage && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold">
                  {actionMessage}
                </div>
              )}

              {/* Form to enter parameter values */}
              <form onSubmit={handleSaveResults} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Structured Test Results
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddResultRow}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Parameter
                  </button>
                </div>

                <div className="space-y-2">
                  {resultsList.map((res, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <div className="col-span-4">
                        <input
                          type="text"
                          required
                          placeholder="Parameter Name (e.g. Hemoglobin)"
                          value={res.parameter}
                          onChange={(e) => {
                            const updated = [...resultsList];
                            updated[i].parameter = e.target.value;
                            setResultsList(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="text"
                          required
                          placeholder="Value (14.2)"
                          value={res.value}
                          onChange={(e) => {
                            const updated = [...resultsList];
                            updated[i].value = e.target.value;
                            setResultsList(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-extrabold text-indigo-800 outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Unit (g/dL)"
                          value={res.unit}
                          onChange={(e) => {
                            const updated = [...resultsList];
                            updated[i].unit = e.target.value;
                            setResultsList(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-none"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Range (13.0 - 17.0)"
                          value={res.referenceRange}
                          onChange={(e) => {
                            const updated = [...resultsList];
                            updated[i].referenceRange = e.target.value;
                            setResultsList(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-none"
                        />
                      </div>

                      <div className="col-span-1 flex items-center justify-center">
                        <label className="flex items-center gap-1 cursor-pointer" title="Flag abnormal">
                          <input
                            type="checkbox"
                            checked={res.isAbnormal}
                            onChange={(e) => {
                              const updated = [...resultsList];
                              updated[i].isAbnormal = e.target.checked;
                              setResultsList(updated);
                            }}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pathologist / Technician Remarks</label>
                  <textarea
                    rows={2}
                    value={techNotes}
                    onChange={(e) => setTechNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="text-right pt-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                  >
                    Save & Validate Results
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
              Select a sample order from the queue to enter test results and manage report release.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
