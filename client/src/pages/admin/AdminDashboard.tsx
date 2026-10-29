import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCheck,
  Activity,
  Users,
  Building2,
  Lock,
  Clock,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { VerificationCase } from '../../types';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'verification' | 'analytics' | 'audit'>('verification');

  // Verification Queue State
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [selectedCase, setSelectedCase] = useState<VerificationCase | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchVerificationQueue();
    fetchAnalytics();
    fetchAuditLogs();
  }, []);

  const fetchVerificationQueue = async () => {
    try {
      setLoadingCases(true);
      const res: any = await api.get('/verification/queue');
      if (res.success) {
        setCases(res.data);
        if (res.data.length > 0 && !selectedCase) {
          setSelectedCase(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load verification queue:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res: any = await api.get('/analytics/public-health');
      if (res.success) setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to load public health analytics:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res: any = await api.get('/audit-logs');
      if (res.success) setAuditLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleDecision = async (status: 'verified' | 'rejected' | 'needs_update') => {
    if (!selectedCase) return;
    try {
      setDecisionLoading(true);
      const res: any = await api.patch(`/verification/${selectedCase._id}/decision`, {
        status,
        decisionReason: decisionNotes || `Status updated to ${status} by administrator.`,
        reviewerNotes: `Reviewed by ${user?.name}`,
      });

      if (res.success) {
        alert(`Credential status updated: ${status.toUpperCase()}`);
        setDecisionNotes('');
        fetchVerificationQueue();
      }
    } catch (err: any) {
      alert(err.message || 'Decision failed');
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">Platform Governance & Verification</h1>
            <span className="badge-verified text-[11px]">
              <Lock className="w-3.5 h-3.5" />
              {user?.role.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Trust & verification queue, regional public-health metrics, and tamper-resistant audit trail.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 pb-px">
        <button
          onClick={() => setActiveTab('verification')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'verification'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Verification Queue ({cases.filter((c) => c.status === 'pending' || c.status === 'in_review').length})
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'analytics'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Regional Public Health Metrics
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          System Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Verification Queue */}
      {activeTab === 'verification' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Submitted Credentials</span>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {cases.length} Total Cases
              </span>
            </h2>

            {loadingCases ? (
              <div className="text-center py-8 text-xs text-slate-400">Loading cases...</div>
            ) : cases.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No verification cases in queue.</div>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => {
                  const isSelected = selectedCase?._id === c._id;
                  return (
                    <div
                      key={c._id}
                      onClick={() => setSelectedCase(c)}
                      className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{c.targetName}</span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            c.status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 capitalize">
                        Type: {c.targetType} &bull; Submitted by: {c.submittedBy?.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Decision Panel */}
          <div className="lg:col-span-2">
            {selectedCase ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      Category: {selectedCase.targetType}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedCase.targetName}</h3>
                    <div className="text-xs text-slate-500">
                      Applicant: {selectedCase.submittedBy?.name} ({selectedCase.submittedBy?.email})
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                      selectedCase.status === 'verified'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    Current State: {selectedCase.status}
                  </span>
                </div>

                {/* Submitted Documents Checklist */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Statutory Documents for Inspection
                  </h4>

                  <div className="space-y-2">
                    {selectedCase.documents.map((doc, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{doc.docType}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Document #: {doc.documentNumber} &bull; Valid: {doc.issueDate || '2024'} to {doc.expiryDate || '2029'}
                          </div>
                        </div>

                        <span className="badge-verified text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Authenticated Document
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decision Form */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Reviewer Decision Statement & Audit Notes
                  </label>
                  <textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Provide audit verification reason or corrective requirements..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium outline-none bg-white focus:border-indigo-500"
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleDecision('needs_update')}
                      disabled={decisionLoading}
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs border border-amber-200 transition-colors"
                    >
                      Request Information
                    </button>
                    <button
                      onClick={() => handleDecision('rejected')}
                      disabled={decisionLoading}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-xl text-xs border border-rose-200 transition-colors"
                    >
                      Reject Application
                    </button>
                    <button
                      onClick={() => handleDecision('verified')}
                      disabled={decisionLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
                    >
                      Approve & Grant Verified Badge
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                Select a verification case from the queue to inspect submitted licenses.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Regional Public Health Metrics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hospitals & Clinics</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {analytics.facilities.hospitals + analytics.facilities.clinics}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {analytics.facilities.hospitals} Hospitals, {analytics.facilities.clinics} Clinics
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pharmacies & Labs</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {analytics.facilities.pharmacies + analytics.facilities.diagnosticLabs}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {analytics.facilities.pharmacies} Medical Stores, {analytics.facilities.diagnosticLabs} Labs
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Regional Bed Vacancy</div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">
                    {analytics.beds.totalAvailable} <span className="text-xs text-slate-400">/ {analytics.beds.totalCapacity}</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-semibold mt-1">
                    {analytics.beds.occupancyRatePercentage}% Occupancy rate
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Total Appointments</div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">
                    {analytics.appointments.totalBookings}
                  </div>
                  <div className="text-[11px] text-indigo-700 font-semibold mt-1">
                    {analytics.appointments.completionRate}% Completion rate
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900">
                <strong>Data Privacy Notice:</strong> {analytics.notice}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">Loading public health analytics...</div>
          )}
        </div>
      )}

      {/* Tab 3: System Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Immutable System Audit Trail
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor & Role</th>
                  <th className="px-4 py-3">Action Performed</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {log.actorEmail || 'System'}
                      <span className="block text-[10px] text-slate-400 capitalize">{log.actorRole}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-700 font-mono text-[11px]">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.targetType || 'Platform'}</td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
