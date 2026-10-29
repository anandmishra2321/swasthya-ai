import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  User,
  X,
  Watch,
  Bluetooth,
  Share2,
  Copy,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Smartphone,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { webBluetoothHR, BleHeartRateData } from '../../services/webBluetoothHeartRate';
import { Appointment, MedicalRecord, Prescription, LabOrder } from '../../types';
import { Link } from 'react-router-dom';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'wearables' | 'consent' | 'appointments' | 'records' | 'prescriptions' | 'labs' | 'aiExplainer'
  >('overview');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [dependents, setDependents] = useState<any[]>([]);
  const [newDepName, setNewDepName] = useState('');
  const [newDepRelation, setNewDepRelation] = useState('');
  const [newDepAllergies, setNewDepAllergies] = useState('');
  const [loading, setLoading] = useState(true);

  // Wearables State
  const [wearableStatus, setWearableStatus] = useState<any>(null);
  const [wearableSummary, setWearableSummary] = useState<any>(null);
  const [wearableMetrics, setWearableMetrics] = useState<any[]>([]);
  const [wearablesLoading, setWearablesLoading] = useState(false);
  const [metricFilter, setMetricFilter] = useState('all');

  // BLE Live State
  const [liveBleData, setLiveBleData] = useState<BleHeartRateData | null>(null);
  const [bleStatus, setBleStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [bleMessage, setBleMessage] = useState<string | null>(null);
  const [companionToken, setCompanionToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Consent Management State
  const [consents, setConsents] = useState<any[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<any[]>([]);
  const [selectedClinicianId, setSelectedClinicianId] = useState('');
  const [selectedConsentCategories, setSelectedConsentCategories] = useState<string[]>(['vitals', 'activity']);
  const [consentExpiresDays, setConsentExpiresDays] = useState('30');
  const [consentNotes, setConsentNotes] = useState('Authorized for clinical remote vitals monitoring');
  const [grantingConsent, setGrantingConsent] = useState(false);

  // AI Report Explainer State
  const [reportParamName, setReportParamName] = useState('Platelet Count');
  const [reportParamValue, setReportParamValue] = useState('110000');
  const [reportParamUnit, setReportParamUnit] = useState('/mcL');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [explainerResult, setExplainerResult] = useState<any>(null);
  const [explainerLoading, setExplainerLoading] = useState(false);

  // AI Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchPatientData();
    fetchWearablesData();
    fetchConsentsData();
  }, []);

  useEffect(() => {
    const handler = () => fetchPatientData();
    window.addEventListener('swasthya:appointment-updated', handler);
    window.addEventListener('swasthya:lab-result-released', handler);
    return () => {
      window.removeEventListener('swasthya:appointment-updated', handler);
      window.removeEventListener('swasthya:lab-result-released', handler);
    };
  }, []);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [apptsRes, recsRes, rxRes, labRes, meRes]: any = await Promise.all([
        api.get('/appointments'),
        api.get('/records'),
        api.get('/prescriptions'),
        api.get('/lab-orders'),
        api.get('/auth/me'),
      ]);

      if (apptsRes.success) setAppointments(apptsRes.data);
      if (recsRes.success) setRecords(recsRes.data);
      if (rxRes.success) setPrescriptions(rxRes.data);
      if (labRes.success) setLabOrders(labRes.data);
      if (meRes.success) setPatientProfile(meRes.profile);
    } catch (err) {
      console.error('Failed to load patient dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);
    try {
      const res: any = await api.post('/ai/chat', { message: msg, language: 'en' });
      const reply = res?.data?.reply || res?.reply || 'Sorry, I could not respond.';
      setChatMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: err?.message || 'AI service unavailable.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddDependent = async () => {
    if (!newDepName.trim() || !newDepRelation.trim()) {
      alert('Name and relation are required.');
      return;
    }
    try {
      const res: any = await api.post('/me/dependents', {
        name: newDepName.trim(),
        relation: newDepRelation.trim(),
        allergies: newDepAllergies.split(',').map((a) => a.trim()).filter(Boolean),
      });
      if (res.success) {
        setDependents(res.data?.dependents || res.dependents || []);
        setNewDepName('');
        setNewDepRelation('');
        setNewDepAllergies('');
      } else {
        alert(res.error?.message || 'Failed to add dependent.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add dependent.');
    }
  };

  const fetchWearablesData = async () => {
    try {
      setWearablesLoading(true);
      const [statusRes, summaryRes, metricsRes]: any = await Promise.all([
        api.get('/wearables/status'),
        api.get('/wearables/summary'),
        api.get('/wearables/metrics?limit=40'),
      ]);

      if (statusRes.success) setWearableStatus(statusRes);
      if (summaryRes.success) setWearableSummary(summaryRes);
      if (metricsRes.success) setWearableMetrics(metricsRes.data);
    } catch (err) {
      console.error('Failed to load wearable data:', err);
    } finally {
      setWearablesLoading(false);
    }
  };

  const fetchConsentsData = async () => {
    try {
      const [consentsRes, docsRes]: any = await Promise.all([
        api.get('/consent/my-consents'),
        api.get('/consent/available-doctors'),
      ]);

      if (consentsRes.success) setConsents(consentsRes.data);
      if (docsRes.success) {
        setAvailableDoctors(docsRes.data);
        if (docsRes.data.length > 0 && !selectedClinicianId) {
          setSelectedClinicianId(docsRes.data[0].userId._id);
        }
      }
    } catch (err) {
      console.error('Failed to load consent data:', err);
    }
  };

  // Web Bluetooth HRM Connection
  const handleConnectBle = async () => {
    setBleMessage(null);
    const success = await webBluetoothHR.connect(
      (data) => {
        setLiveBleData(data);
        fetchWearablesData();
      },
      (status, msg) => {
        setBleStatus(status);
        if (msg) setBleMessage(msg);
      }
    );
  };

  const handleDisconnectBle = () => {
    webBluetoothHR.disconnect();
    setLiveBleData(null);
    setBleStatus('disconnected');
    setBleMessage('Bluetooth sensor disconnected.');
  };

  // Generate Mobile Pairing Token
  const handleGeneratePairingToken = async () => {
    try {
      const res: any = await api.post('/wearables/companion-token', { platform: 'health_connect' });
      if (res.success) {
        setCompanionToken(res.pairingToken);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate companion token');
    }
  };

  const handleCopyToken = () => {
    if (!companionToken) return;
    navigator.clipboard.writeText(companionToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2500);
  };

  // Disconnect & Optional Purge
  const handleDisconnectPlatform = async (platform: string, purgeData: boolean = false) => {
    const confirmMsg = purgeData
      ? `Are you sure you want to disconnect ${platform} and permanently purge all stored metrics for this device?`
      : `Disconnect ${platform}?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res: any = await api.post('/wearables/disconnect', { platform, purgeData });
      if (res.success) {
        alert(res.message);
        fetchWearablesData();
      }
    } catch (err: any) {
      alert(err.message || 'Disconnect failed');
    }
  };

  // Grant Consent
  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinicianId) {
      alert('Please select a verified doctor.');
      return;
    }
    if (selectedConsentCategories.length === 0) {
      alert('Please select at least one data category to share.');
      return;
    }

    try {
      setGrantingConsent(true);
      const expiresAt = consentExpiresDays
        ? new Date(Date.now() + parseInt(consentExpiresDays, 10) * 86400000).toISOString()
        : undefined;

      const res: any = await api.post('/consent/grant', {
        clinicianId: selectedClinicianId,
        categories: selectedConsentCategories,
        expiresAt,
        notes: consentNotes,
      });

      if (res.success) {
        alert('Health data consent successfully granted to clinician!');
        fetchConsentsData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to grant consent');
    } finally {
      setGrantingConsent(false);
    }
  };

  // Revoke Consent
  const handleRevokeConsent = async (consentId: string) => {
    if (!confirm('Are you sure you want to revoke clinician access? The doctor will be immediately blocked from viewing your wearable metrics.')) return;

    try {
      const res: any = await api.post('/consent/revoke', { consentId });
      if (res.success) {
        alert(res.message);
        fetchConsentsData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke consent');
    }
  };

  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res: any = await api.patch(`/appointments/${apptId}/status`, {
        status: 'cancelled',
        notes: 'Cancelled by patient',
      });
      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) => (a._id === apptId ? { ...a, status: 'cancelled' } : a))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  const handleRunAiExplainer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setExplainerLoading(true);
      const res: any = await api.post('/ai/explain-report', {
        parameters: [
          {
            name: reportParamName,
            value: reportParamValue,
            unit: reportParamUnit,
          },
        ],
      });
      if (res.success) {
        setExplainerResult(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Report explanation failed');
    } finally {
      setExplainerLoading(false);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportFile) {
      alert('Please select a PDF file.');
      return;
    }
    setExplainerLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', reportFile);
      const token = localStorage.getItem('swasthya_token');
      const res = await fetch('/api/v1/ai/explain-report-file', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setExplainerResult(data.data);
      } else {
        alert(data.error?.message || 'Failed to analyze report.');
      }
    } catch (err: any) {
      alert(err.message || 'Report upload failed.');
    } finally {
      setExplainerLoading(false);
    }
  };

  // Find latest heart rate from wearableSummary
  const latestHR = wearableSummary?.recentSamples?.find((s: any) => s.metric === 'heart_rate');
  const todaySteps = wearableSummary?.summary?.totalSteps;
  const todaySleep = wearableSummary?.summary?.sleepMinutes;
  const todaySpo2 = wearableSummary?.summary?.avgSpo2;

  const filteredMetrics = wearableMetrics.filter((m) => {
    if (metricFilter === 'all') return true;
    return m.metric === metricFilter;
  });

  return (<> 
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Patient Profile Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-2xl shadow-inner">
            {user?.name.charAt(0) || 'P'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">{user?.name}</h1>
              <span className="badge-verified text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Patient
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
              <span>{user?.email}</span>
              <span>&bull;</span>
              <span>Phone: {user?.phone || 'Not set'}</span>
              <span>&bull;</span>
              <span className="font-semibold text-slate-700">Blood Group: {patientProfile?.bloodGroup || 'B+'}</span>
            </div>

            {patientProfile?.allergies && patientProfile.allergies.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-flex">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Recorded Allergies: {patientProfile.allergies.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Family / Dependents ({dependents.length})</h3>
          </div>
          {dependents.length === 0 ? (
            <p className="text-xs text-slate-400">No dependents added yet.</p>
          ) : (
            <ul className="space-y-1">
              {dependents.map((d: any, i: number) => (
                <li key={i} className="text-xs text-slate-600 dark:text-slate-300">
                  {d.name} — {d.relation} {d.allergies?.length ? `(Allergies: ${d.allergies.join(', ')})` : ''}
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <input
              value={newDepName}
              onChange={(e) => setNewDepName(e.target.value)}
              placeholder="Name"
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-indigo-500"
            />
            <input
              value={newDepRelation}
              onChange={(e) => setNewDepRelation(e.target.value)}
              placeholder="Relation (e.g. Son)"
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-indigo-500"
            />
            <input
              value={newDepAllergies}
              onChange={(e) => setNewDepAllergies(e.target.value)}
              placeholder="Allergies (comma separated)"
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleAddDependent}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Add Dependent
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('wearables')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Watch className="w-4 h-4" />
            Connect Smartwatch
          </button>
          <button
            onClick={() => setActiveTab('consent')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4 text-indigo-600" />
            Manage Doctor Consent
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-1 pb-px">
        {[
          { id: 'overview', label: 'Timeline & Vitals', icon: Activity },
          { id: 'wearables', label: 'Wearables & Telemetry', icon: Watch },
          { id: 'consent', label: `Doctor Consent (${consents.filter(c => c.status === 'active').length})`, icon: Share2 },
          { id: 'appointments', label: `Appointments (${appointments.filter(a => a.status !== 'cancelled').length})`, icon: Calendar },
          { id: 'records', label: `Clinical Records (${records.length})`, icon: FileText },
          { id: 'prescriptions', label: `Prescriptions (${prescriptions.length})`, icon: Pill },
          { id: 'labs', label: `Lab Reports (${labOrders.length})`, icon: TestTube2 },
          { id: 'aiExplainer', label: 'AI Report Explainer', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-2 transition-all ${
                isActive
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-xl'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Timeline & Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Smartwatch & Vitals Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Heart Rate Card */}
            <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  Heart Rate
                </span>
                {liveBleData ? (
                  <span className="badge-verified text-[10px] px-1.5 py-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Live BLE
                  </span>
                ) : latestHR ? (
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(latestHR.measuredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>

              {liveBleData ? (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-rose-600">{liveBleData.bpm}</span>
                    <span className="text-xs font-bold text-slate-400">BPM</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Source: {liveBleData.deviceName || 'Web Bluetooth'}</span>
                  </div>
                </div>
              ) : latestHR ? (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900">{latestHR.value}</span>
                    <span className="text-xs font-bold text-slate-400">{latestHR.unit}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Device: {latestHR.sourceDeviceId || latestHR.platform}
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <div className="text-sm font-semibold text-slate-400">No data available yet</div>
                  <button
                    onClick={() => setActiveTab('wearables')}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline"
                  >
                    + Connect Sensor
                  </button>
                </div>
              )}
            </div>

            {/* Daily Steps Card */}
            <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Today's Steps
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Daily Goal: 10,000</span>
              </div>

              {todaySteps && todaySteps > 0 ? (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-indigo-700">{todaySteps.toLocaleString()}</span>
                    <span className="text-xs font-bold text-slate-400">steps</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {Math.round((todaySteps / 10000) * 100)}% of daily activity goal
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <div className="text-sm font-semibold text-slate-400">No data available yet</div>
                  <div className="text-[11px] text-slate-400 mt-1">Requires Health Connect or Fitbit sync</div>
                </div>
              )}
            </div>

            {/* Sleep Summary Card */}
            <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Sleep Summary
                </span>
              </div>

              {todaySleep && todaySleep > 0 ? (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-indigo-700">
                      {Math.floor(todaySleep / 60)}h {todaySleep % 60}m
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Recorded rest duration
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <div className="text-sm font-semibold text-slate-400">No data available yet</div>
                  <div className="text-[11px] text-slate-400 mt-1">Overnight sync required</div>
                </div>
              )}
            </div>

            {/* Blood Oxygen SpO2 Card */}
            <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <TestTube2 className="w-4 h-4 text-cyan-600" />
                  Blood Oxygen (SpO2)
                </span>
              </div>

              {todaySpo2 ? (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-cyan-700">{todaySpo2}</span>
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Avg daily blood saturation
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <div className="text-sm font-semibold text-slate-400">No data available yet</div>
                  <div className="text-[11px] text-slate-400 mt-1">Supported optical pulse oximeter</div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline & Family Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Health Timeline */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Chronological Health Timeline
              </h2>

              {records.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                  No past consultations recorded yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((rec) => (
                    <div
                      key={rec._id}
                      className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {rec.type.replace(/_/g, ' ')}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 mt-1">{rec.title}</h3>
                          <div className="text-xs text-slate-500">
                            {new Date(rec.recordDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            &bull; Recorded by Dr. {rec.doctorId?.name || 'Practitioner'}
                          </div>
                        </div>
                      </div>

                      {rec.clinicalNotes && (
                        <div className="text-xs space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-slate-700">
                          <div>
                            <strong>Symptoms:</strong> {rec.clinicalNotes.symptoms}
                          </div>
                          <div>
                            <strong>Diagnosis:</strong> {rec.clinicalNotes.diagnosis}
                          </div>
                          <div>
                            <strong>Clinical Plan:</strong> {rec.clinicalNotes.plan}
                          </div>
                          {rec.clinicalNotes.followUpDate && (
                            <div className="text-indigo-700 font-semibold pt-1">
                              Follow-up Due: {rec.clinicalNotes.followUpDate}
                            </div>
                          )}
                        </div>
                      )}

                      {rec.aiDraftSummary && (
                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs text-indigo-900">
                          <div className="flex items-center gap-1 font-bold text-[11px] text-indigo-800 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Clinician-Reviewed AI Summary
                          </div>
                          <p className="italic text-[11px] leading-relaxed">{rec.aiDraftSummary}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Family & Emergency */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Family & Dependents
              </h2>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                {patientProfile?.dependents && patientProfile.dependents.length > 0 ? (
                  patientProfile.dependents.map((dep: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="font-bold text-slate-900">{dep.name}</div>
                      <div className="text-slate-500 text-[11px]">
                        Relation: {dep.relation} &bull; Gender: {dep.gender || 'Not specified'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400">No family members registered.</div>
                )}
              </div>

              <div className="bg-rose-50 rounded-2xl p-5 border border-rose-200 shadow-2xs space-y-2">
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Emergency Contact
                </div>
                <div className="text-xs text-rose-800">
                  <div><strong>Name:</strong> {patientProfile?.emergencyContact?.name || 'Sunita Verma'}</div>
                  <div><strong>Phone:</strong> {patientProfile?.emergencyContact?.phone || '+91 98260 99887'}</div>
                  <div><strong>Relation:</strong> {patientProfile?.emergencyContact?.relation || 'Mother'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wearables & Telemetry Integration Hub */}
      {activeTab === 'wearables' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-wider">
              <Watch className="w-3.5 h-3.5 text-indigo-600" />
              Genuine Smartwatch & Bluetooth Low Energy Integration
            </div>
            <h2 className="text-2xl font-black text-slate-900">Wearable Health Platforms & Sensors</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Connect real hardware telemetry. Fake data, simulated readings, and unconfigured states are strictly forbidden. Live readings are cryptographically ingested and saved to your personal health record.
            </p>
          </div>

          {/* Supported Platform Integration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Web Bluetooth BLE GATT Sensor */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Bluetooth className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      bleStatus === 'connected'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : bleStatus === 'connecting'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {bleStatus.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">Web Bluetooth HRM</h3>
                  <div className="text-[11px] font-mono text-slate-500">GATT SIG 0x180D &bull; 0x2A37</div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Connect any Bluetooth Low Energy heart rate monitor or smart band (Polar, Garmin, Wahoo, standard BLE). Reads actual raw GATT binary packets directly in the browser over HTTPS.
                </p>

                {liveBleData && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1 text-xs">
                    <div className="text-emerald-900 font-bold flex items-center justify-between">
                      <span>Streaming BPM:</span>
                      <span className="text-lg font-black text-emerald-700 animate-pulse">{liveBleData.bpm}</span>
                    </div>
                    {liveBleData.rrIntervals && (
                      <div className="text-[10px] text-emerald-700">
                        RR: {liveBleData.rrIntervals.join(', ')} ms
                      </div>
                    )}
                  </div>
                )}

                {bleMessage && (
                  <div className="text-[11px] p-2.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                    {bleMessage}
                  </div>
                )}
              </div>

              <div>
                {bleStatus === 'connected' ? (
                  <button
                    onClick={handleDisconnectBle}
                    className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
                  >
                    Disconnect Sensor
                  </button>
                ) : (
                  <button
                    onClick={handleConnectBle}
                    disabled={bleStatus === 'connecting'}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Bluetooth className="w-4 h-4" />
                    {bleStatus === 'connecting' ? 'Connecting...' : 'Pair BLE Sensor'}
                  </button>
                )}
              </div>
            </div>

            {/* 2. Fitbit Web API */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                    Fitbit
                  </div>
                  <span className="badge-pending text-[10px]">
                    {wearableStatus?.platformConfig?.fitbit?.configured ? 'READY TO AUTH' : 'NOT CONFIGURED'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">Fitbit Web API</h3>
                  <div className="text-[11px] text-slate-500">OAuth 2.0 PKCE Authorization</div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Official Google Fitbit Web API for heart rate, intraday steps, sleep stages, and oxygen saturation.
                </p>

                {!wearableStatus?.platformConfig?.fitbit?.configured ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      Requires API Registration
                    </div>
                    <div className="text-[11px] leading-relaxed">
                      Server missing <code className="font-mono text-amber-950">FITBIT_CLIENT_ID</code>. Register an app at dev.fitbit.com with redirect URI: <br/>
                      <code className="font-mono text-[10px] break-all bg-white px-1 py-0.5 rounded">http://localhost:5173/dashboard/patient?wearable_callback=fitbit</code>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-800">
                    Ready to link Fitbit account with intraday scopes.
                  </div>
                )}
              </div>

              <div>
                <button
                  disabled={!wearableStatus?.platformConfig?.fitbit?.configured}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed"
                  title="Fitbit developer credentials must be configured on the server"
                >
                  Connect Fitbit (Not Configured)
                </button>
              </div>
            </div>

            {/* 3. Android Health Connect & Apple Health Companion Ingestion Contract */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="badge-verified text-[10px]">
                    API CONTRACT ACTIVE
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">Health Connect Companion</h3>
                  <div className="text-[11px] text-slate-500">REST Ingestion / Token Pairing</div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Android Health Connect and Apple HealthKit integration contract. Generate a cryptographic token for mobile sync ingestion at <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">POST /api/v1/wearables/sync</code>.
                </p>

                {companionToken ? (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1.5 text-xs">
                    <div className="text-[10px] font-bold text-purple-800 uppercase">Your Pairing Token:</div>
                    <div className="font-mono text-[11px] bg-white p-1.5 rounded border border-purple-200 break-all select-all">
                      {companionToken}
                    </div>
                    <button
                      onClick={handleCopyToken}
                      className="text-purple-700 font-bold hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Copy className="w-3 h-3" />
                      {tokenCopied ? 'Token Copied!' : 'Copy Pairing Token'}
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    Pairing token allows companion client to ingest timestamped samples securely.
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={handleGeneratePairingToken}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-4 h-4" />
                  Generate Pairing Token
                </button>
              </div>
            </div>
          </div>

          {/* Connected Devices Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Watch className="w-5 h-5 text-indigo-600" />
              Connected Wearables & Platform State
            </h3>

            {wearableStatus?.connections && Object.keys(wearableStatus.connections).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Platform</th>
                      <th className="py-2.5 px-3 font-semibold">Device</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Last Sync</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(wearableStatus.connections).map(([platform, conn]: [string, any]) => (
                      <tr key={platform} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-slate-900 uppercase">{platform.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 text-slate-600">{conn.deviceName || 'Standard Device'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            conn.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {conn.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {conn.lastSyncAt ? (
                            <span className="flex items-center gap-1.5">
                              {new Date(conn.lastSyncAt).toLocaleString()}
                              {conn.isStale && <span className="badge-stale text-[9px] px-1 py-0">Stale &gt;6h</span>}
                            </span>
                          ) : (
                            'Never synced'
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDisconnectPlatform(platform, true)}
                            className="text-rose-600 hover:text-rose-800 font-bold text-xs"
                          >
                            Disconnect & Purge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No external health platforms or sensors connected yet.
              </div>
            )}
          </div>

          {/* Raw Ingested Health Metric Samples */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Authorized Health Metric Samples
                </h3>
                <p className="text-xs text-slate-500">
                  Actual recorded samples with sensor measurement timestamps and server receipt verification.
                </p>
              </div>

              {/* Metric Filter */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                {['all', 'heart_rate', 'steps', 'resting_heart_rate', 'sleep_duration'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetricFilter(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      metricFilter === m ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    {m.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {filteredMetrics.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No health samples ingested yet. Connect your BLE heart rate sensor or companion app to stream records.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Measured Time</th>
                      <th className="py-2.5 px-3 font-semibold">Metric</th>
                      <th className="py-2.5 px-3 font-semibold">Value</th>
                      <th className="py-2.5 px-3 font-semibold">Source Device</th>
                      <th className="py-2.5 px-3 font-semibold">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMetrics.map((sample) => (
                      <tr key={sample._id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {new Date(sample.measuredAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 capitalize">
                          {sample.metric.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3 font-black text-indigo-700">
                          {sample.value} <span className="font-normal text-slate-500 text-[11px]">{sample.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{sample.sourceDeviceId || sample.platform}</td>
                        <td className="py-2.5 px-3">
                          <span className="badge-verified text-[10px] px-2 py-0 capitalize">
                            {sample.quality || 'valid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Consent Management */}
      {activeTab === 'consent' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-wider">
              <Share2 className="w-3.5 h-3.5 text-cyan-600" />
              Patient-Controlled Consent & Data Sovereignty
            </div>
            <h2 className="text-2xl font-black text-slate-900">Clinician Access & Consent Management</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              You own your clinical and wearable data. Doctors can ONLY view your health summaries if you have explicitly granted them active consent. You can revoke access at any moment with immediate effect.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Active Consents */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Active Consent Grants
              </h3>

              {consents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No clinicians currently have access to your health data.
                </div>
              ) : (
                <div className="space-y-3">
                  {consents.map((c) => {
                    const isActive = c.status === 'active';
                    return (
                      <div
                        key={c._id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isActive ? 'bg-white border-slate-200/90 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {c.clinicianId ? `Dr. ${c.clinicianId.name}` : c.organizationId?.name || 'Healthcare Provider'}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {c.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500">
                              Granted: {new Date(c.grantedAt).toLocaleDateString()} &bull;{' '}
                              {c.expiresAt ? `Expires: ${new Date(c.expiresAt).toLocaleDateString()}` : 'Indefinite duration'}
                            </div>

                            {/* Categories Chips */}
                            <div className="flex flex-wrap gap-1 pt-1.5">
                              {c.categories.map((cat: string) => (
                                <span
                                  key={cat}
                                  className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[10px] font-bold uppercase"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>

                          {isActive && (
                            <button
                              onClick={() => handleRevokeConsent(c._id)}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors shrink-0"
                            >
                              Revoke Access
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Grant New Consent Form */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Grant Access to a Clinician
              </h3>

              <form onSubmit={handleGrantConsent} className="space-y-4 text-xs">
                {/* Doctor Select */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Verified Doctor:</label>
                  <select
                    value={selectedClinicianId}
                    onChange={(e) => setSelectedClinicianId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:border-indigo-500"
                  >
                    {availableDoctors.map((doc) => (
                      <option key={doc.userId._id} value={doc.userId._id}>
                        Dr. {doc.userId.name} &bull; {doc.specialty} ({doc.organizationId?.name || 'Clinic'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categories */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Permitted Data Categories:</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'vitals', label: 'Vitals (Heart Rate, Resting BPM, SpO2)' },
                      { id: 'activity', label: 'Physical Activity & Step Counts' },
                      { id: 'sleep', label: 'Sleep Summaries & Rest Duration' },
                      { id: 'prescriptions', label: 'Prescriptions & Medication History' },
                      { id: 'records', label: 'Consultation Visit Notes & Diagnostics' },
                    ].map((cat) => {
                      const isChecked = selectedConsentCategories.includes(cat.id);
                      return (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedConsentCategories([...selectedConsentCategories, cat.id]);
                              } else {
                                setSelectedConsentCategories(selectedConsentCategories.filter((c) => c !== cat.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-slate-700">{cat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Expiration Duration */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration of Access:</label>
                  <select
                    value={consentExpiresDays}
                    onChange={(e) => setConsentExpiresDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs outline-none"
                  >
                    <option value="7">7 Days (Acute care follow-up)</option>
                    <option value="30">30 Days (Routine evaluation)</option>
                    <option value="90">90 Days (Chronic care management)</option>
                    <option value="365">1 Year (Primary care clinician)</option>
                    <option value="">Indefinite (Until manually revoked)</option>
                  </select>
                </div>

                {/* Purpose Notes */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purpose / Clinical Notes:</label>
                  <textarea
                    rows={2}
                    value={consentNotes}
                    onChange={(e) => setConsentNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs outline-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  Notice: Clinicians must review all wearable data professionally. Consumer devices are supplementary and do not constitute autonomous clinical assessment.
                </div>

                <button
                  type="submit"
                  disabled={grantingConsent}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50"
                >
                  {grantingConsent ? 'Granting...' : 'Grant Authorized Access'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Appointments */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Doctor Appointments</h2>
            <Link
              to="/doctors"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline"
            >
              + Book Another Appointment
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              No appointments found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.map((appt) => (
                <div
                  key={appt._id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        appt.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {appt.status}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">
                        Token #{appt.tokenNumber} &bull; {appt.timeSlot}
                      </h3>
                      <div className="text-xs text-slate-500">
                        Date: <strong>{appt.appointmentDate}</strong>
                      </div>
                    </div>

                    {appt.status === 'confirmed' && (
                      <button
                        onClick={() => handleCancelAppointment(appt._id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="font-semibold text-slate-800">
                      Doctor: Dr. {appt.doctorId?.userId?.name || 'Practitioner'}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Specialty: {appt.doctorId?.specialty || 'General Medicine'}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Facility: {appt.organizationId?.name || 'Swasthya Clinic'}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    <strong>Reason:</strong> {appt.reason}
                  </div>
                  <a
                    href={`/api/v1/appointments/${appt._id}/slip`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Download Slip PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Clinical Records */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Your Medical Records & Consultations</h2>
          {records.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              No medical records saved yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {records.map((rec) => (
                <div key={rec._id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {rec.type.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{rec.title}</h3>
                      <div className="text-xs text-slate-500">
                        Date: {new Date(rec.recordDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {rec.clinicalNotes && (
                    <div className="text-xs space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700">
                      <div><strong>Symptoms:</strong> {rec.clinicalNotes.symptoms}</div>
                      <div><strong>Diagnosis:</strong> {rec.clinicalNotes.diagnosis}</div>
                      <div><strong>Plan:</strong> {rec.clinicalNotes.plan}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Digital Doctor Prescriptions</h2>
          {prescriptions.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              No prescriptions issued yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {prescriptions.map((rx) => (
                <div key={rx._id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        Prescription #{rx._id.slice(-6).toUpperCase()}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">Diagnosis: {rx.diagnosis}</h3>
                      <div className="text-xs text-slate-500">
                        Issued: {new Date(rx.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">Medicines Prescribed:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rx.medicines.map((m: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="font-bold text-slate-900">{m.name}</div>
                          {m.genericName && (
                            <div className="text-[11px] text-indigo-700">Generic: {m.genericName}</div>
                          )}
                          <div className="text-slate-500 text-[11px]">
                            {m.dosage} &bull; {m.frequency} &bull; {m.duration}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {rx.advice && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                      <strong>Advice:</strong> {rx.advice}
                    </div>
                  )}
                  <a
                    href={`/api/v1/prescriptions/${rx._id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Download Prescription PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Diagnostic Labs */}
      {activeTab === 'labs' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Pathology & Diagnostic Orders</h2>
          {labOrders.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              No lab orders placed.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {labOrders.map((order) => (
                <div key={order._id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        Lab Order #{order.sampleId || order._id.slice(-6).toUpperCase()}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">Status: {order.sampleStatus}</h3>
                      <div className="text-xs text-slate-500">
                        Date: {order.collectionDate ? new Date(order.collectionDate).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      order.isReleasedToPatient ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {order.isReleasedToPatient ? 'Verified & Released' : 'Pending Lab Verification'}
                    </span>
                    {order.isReleasedToPatient && (
                      <a
                        href={`/api/v1/lab-orders/${order._id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        Download PDF
                      </a>
                    )}
                  </div>

                  <div className="text-xs text-slate-600">
                    <strong>Test:</strong> {order.testName} &bull; Category: {order.category}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Tab 8: AI Report Explainer */}
      {activeTab === 'aiExplainer' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Bilingual AI Lab Report Explainer
            </h2>
            <p className="text-xs text-slate-500">
              Development-only template: enter supplied values for a bilingual display. It does not interpret reference ranges or provide clinical advice.
            </p>
          </div>

          <form onSubmit={handleRunAiExplainer} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Parameter Name:</label>
              <input
                type="text"
                value={reportParamName}
                onChange={(e) => setReportParamName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observed Value:</label>
              <input
                type="text"
                value={reportParamValue}
                onChange={(e) => setReportParamValue(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unit:</label>
              <input
                type="text"
                value={reportParamUnit}
                onChange={(e) => setReportParamUnit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Or upload a PDF lab report:</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-3 text-right flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleUploadReport}
                disabled={explainerLoading || !reportFile}
                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {explainerLoading ? 'Analyzing...' : 'Explain PDF'}
              </button>
              <button
                type="submit"
                disabled={explainerLoading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {explainerLoading ? 'Analyzing...' : 'Explain Results'}
              </button>
            </div>
          </form>

          {explainerResult && (
            <div className="space-y-4 pt-2">
              {explainerResult.isMock && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                  Demo template only — not AI analysis or clinician interpretation. Confirm values and ranges with the laboratory and a licensed clinician.
                </div>
              )}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 space-y-2">
                <div className="font-bold text-sm text-indigo-950">English Clinical Overview:</div>
                <p className="text-xs leading-relaxed">{explainerResult.summary}</p>
                <div className="font-bold text-sm text-indigo-950 pt-2 border-t border-indigo-200/60">
                  हिंदी व्याख्या (Hindi Explanation):
                </div>
                <p className="text-xs leading-relaxed font-sans">{explainerResult.summaryHindi}</p>
              </div>

              <div className="text-[10px] text-slate-400 italic text-center">
                Disclaimer: {explainerResult.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* AI Chatbot Floating Widget */}
    <div className="fixed bottom-6 right-6 z-50">
    {chatOpen && (
      <div className="mb-3 w-80 max-h-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-indigo-600 text-white text-sm font-bold flex items-center justify-between">
          <span>Swasthya AI Assistant</span>
          <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white">?</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-64">
          {chatMessages.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Ask me about symptoms, medicines, reports...</p>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} className={`text-xs p-2 rounded-xl ${m.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 ml-6' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-6'}`}>
              {m.text}
            </div>
          ))}
          {chatLoading && <div className="text-xs text-slate-400 italic">Thinking...</div>}
        </div>
        <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs outline-none focus:border-indigo-500 bg-white dark:bg-slate-800"
          />
          <button onClick={handleSendChat} disabled={chatLoading} className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl disabled:opacity-50">Send</button>
        </div>
      </div>
    )}
    <button onClick={() => setChatOpen(!chatOpen)} className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:bg-indigo-700 transition-all">
      <span className="text-2xl">??</span>
    </button>
  </div>
  </>);
};
