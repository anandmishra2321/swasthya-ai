import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Pill,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  User,
  Watch,
  HeartPulse,
  Activity,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Appointment } from '../../types';

export const DoctorDashboard: React.FC = () => {
  const { user, activeWorkspace } = useAuth();
  const [activeTab, setActiveTab] = useState<'queue' | 'remote_monitoring'>('queue');

  // OPD Consultation Queue State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // Consultation Suite State
  const [symptoms, setSymptoms] = useState('');
  const [examination, setExamination] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [plan, setPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [aiDraft, setAiDraft] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Prescription State
  const [medicines, setMedicines] = useState<
    Array<{ name: string; genericName: string; dosage: string; frequency: string; duration: string; instructions: string }>
  >([
    { name: '', genericName: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
  ]);
  const [rxSuccess, setRxSuccess] = useState<any>(null);
  const [rxAllergyWarning, setRxAllergyWarning] = useState<string | null>(null);

  // Consented Remote Monitoring State
  const [consentedPatients, setConsentedPatients] = useState<any[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientMetricsData, setPatientMetricsData] = useState<any | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, [activeWorkspace]);

  useEffect(() => {
    const handler = () => fetchAppointments();
    window.addEventListener('swasthya:appointment-updated', handler);
    return () => window.removeEventListener('swasthya:appointment-updated', handler);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeTab === 'remote_monitoring') {
      fetchConsentedPatients();
    }
  }, [activeTab, activeWorkspace]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/appointments');
      if (res.success) {
        setAppointments(res.data);
        if (res.data.length > 0 && !selectedAppt) {
          setSelectedAppt(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsentedPatients = async () => {
    try {
      setMonitoringLoading(true);
      const res: any = await api.get('/clinician/patients');
      if (res.success) {
        setConsentedPatients(res.data);
        if (res.data.length > 0 && !selectedPatientId) {
          handleSelectConsentedPatient(res.data[0].patientId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load consented patients:', err);
    } finally {
      setMonitoringLoading(false);
    }
  };

  const handleSelectConsentedPatient = async (patientId: string) => {
    try {
      setSelectedPatientId(patientId);
      setMetricsLoading(true);
      const res: any = await api.get(`/clinician/patients/${patientId}/metrics`);
      if (res.success) {
        setPatientMetricsData(res);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to fetch patient telemetry. Active consent check may have failed.');
      setPatientMetricsData(null);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleStatusChange = async (apptId: string, status: string) => {
    try {
      const res: any = await api.patch(`/appointments/${apptId}/status`, { status });
      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) => (a._id === apptId ? { ...a, status: status as any } : a))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleGenerateAiDraft = async () => {
    try {
      setDraftLoading(true);
      const res: any = await api.post('/records/ai-draft', {
        symptoms,
        examination,
        diagnosis,
        plan,
      });
      if (res.success) {
        setAiDraft(res.draft);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate AI draft');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;

    try {
      setSavingNote(true);
      const res: any = await api.post('/records', {
        patientId: selectedAppt.patientId._id,
        type: 'visit_note',
        title: `OPD Consultation - ${diagnosis || 'General Checkup'}`,
        clinicalNotes: {
          symptoms,
          examination,
          diagnosis,
          plan,
          followUpDate,
        },
        aiDraftSummary: aiDraft,
        aiApprovedByDoctor: !!aiDraft,
      });

      if (res.success) {
        setNoteSuccess(true);
        setTimeout(() => setNoteSuccess(false), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddMedicineRow = () => {
    setMedicines([
      ...medicines,
      { name: '', genericName: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
    ]);
  };

  const handleRemoveMedicineRow = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;

    try {
      setRxAllergyWarning(null);
      const validMeds = medicines.filter((m) => m.name.trim() !== '');
      if (validMeds.length === 0) {
        alert('Please add at least one medicine.');
        return;
      }

      const res: any = await api.post('/prescriptions', {
        patientId: selectedAppt.patientId._id,
        appointmentId: selectedAppt._id,
        diagnosis: diagnosis || 'Clinical Management',
        medicines: validMeds,
        advice: plan,
        followUpDate,
      });

      if (res.success) {
        setRxSuccess(res.data);
        if (res.allergyWarningTriggered) {
          setRxAllergyWarning(res.allergyDetails);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate prescription');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Clinician Workspace Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">{user?.name}</h1>
            <span className="badge-verified text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Clinician
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Active Workspace:{' '}
            <strong className="text-slate-800">
              {activeWorkspace ? activeWorkspace.organizationName : 'Independent Private Practice'}
            </strong>{' '}
            &bull; Role: {user?.role.replace(/_/g, ' ')}
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Today's OPD Queue ({appointments.filter((a) => a.status === 'confirmed').length})
          </button>
          <button
            onClick={() => setActiveTab('remote_monitoring')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'remote_monitoring'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Watch className="w-3.5 h-3.5" />
            Consented Remote Monitoring
          </button>
        </div>
      </div>

      {/* Mode 1: Today's OPD Queue & Clinical Consultation Suite */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Queue */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Today's Consultation Queue
              </h2>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {appointments.length} Scheduled
              </span>
            </div>

            {loading ? (
              <div className="text-center py-8 text-xs text-slate-400">Loading queue...</div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No appointments scheduled today.</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {appointments.map((appt) => {
                  const isSelected = selectedAppt?._id === appt._id;
                  return (
                    <div
                      key={appt._id}
                      onClick={() => setSelectedAppt(appt)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          Token #{appt.tokenNumber} &bull; {appt.patientId?.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize font-medium">
                          {appt.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <Clock className="w-3 h-3 text-indigo-600" />
                        <span>{appt.timeSlot}</span>
                        <span>&bull;</span>
                        <span className="truncate">{appt.reason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Active Consultation Suite */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAppt ? (
              <>
                {/* Active Patient Details Banner */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      In Consultation
                    </span>
                    <h2 className="text-xl font-black text-slate-900 mt-1">
                      {selectedAppt.patientId?.name}
                    </h2>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Token #{selectedAppt.tokenNumber} &bull; Slot: {selectedAppt.timeSlot} &bull; Date: {selectedAppt.appointmentDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStatusChange(selectedAppt._id, 'completed')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedAppt._id, 'no_show')}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs"
                    >
                      No Show
                    </button>
                  </div>
                </div>

                {/* Clinical Notes Form */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Clinical Visit Notes
                  </h3>

                  <form onSubmit={handleSaveConsultation} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Chief Symptoms:</label>
                      <input
                        type="text"
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        placeholder="e.g. Fever 101F for 3 days, dry cough, bodyache..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Clinical Examination:</label>
                      <textarea
                        rows={2}
                        value={examination}
                        onChange={(e) => setExamination(e.target.value)}
                        placeholder="e.g. Chest clear, throat congested, vitals stable..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Working Diagnosis:</label>
                        <input
                          type="text"
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          placeholder="e.g. Acute Viral Upper Respiratory Infection"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Follow-up Date:</label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Management Plan:</label>
                      <textarea
                        rows={2}
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        placeholder="e.g. Hydration, antipyretics, review if fever persists >48h..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* AI Draft Review */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          AI Clinical Summary Co-Pilot
                        </span>
                        <button
                          type="button"
                          onClick={handleGenerateAiDraft}
                          disabled={draftLoading}
                          className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline"
                        >
                          {draftLoading ? 'Generating...' : 'Draft Summary'}
                        </button>
                      </div>

                      {aiDraft && (
                        <p className="text-[11px] text-indigo-800 italic bg-white p-2.5 rounded-lg border border-indigo-200">
                          {aiDraft}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {noteSuccess && (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          Clinical Note Saved!
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={savingNote}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all ml-auto"
                      >
                        {savingNote ? 'Saving...' : 'Save Consultation Note'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Digital Prescription Form */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-indigo-600" />
                      Digital Rx & Generic Medicine Prescriptions
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddMedicineRow}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Medicine
                    </button>
                  </div>

                  <form onSubmit={handleSavePrescription} className="space-y-3 text-xs">
                    <div className="space-y-2">
                      {medicines.map((med, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="col-span-4">
                            <input
                              type="text"
                              placeholder="Brand / Generic Name (Paracetamol)"
                              value={med.name}
                              onChange={(e) => {
                                const updated = [...medicines];
                                updated[idx].name = e.target.value;
                                setMedicines(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="text"
                              placeholder="Dosage (500mg)"
                              value={med.dosage}
                              onChange={(e) => {
                                const updated = [...medicines];
                                updated[idx].dosage = e.target.value;
                                setMedicines(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="text"
                              placeholder="Freq (1-0-1)"
                              value={med.frequency}
                              onChange={(e) => {
                                const updated = [...medicines];
                                updated[idx].frequency = e.target.value;
                                setMedicines(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              placeholder="Instructions (After food)"
                              value={med.instructions}
                              onChange={(e) => {
                                const updated = [...medicines];
                                updated[idx].instructions = e.target.value;
                                setMedicines(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                            />
                          </div>
                          <div className="col-span-1 flex items-center justify-center">
                            {medicines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicineRow(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-right pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                      >
                        Issue Digital Prescription
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                Please select a patient from today's queue to begin consultation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Consented Remote Patient Monitoring */}
      {activeTab === 'remote_monitoring' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
              Strict Patient Consent-Gated Remote Telemetry
            </div>
            <h2 className="text-2xl font-black text-slate-900">Consented Patient Remote Monitoring</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Below are patients who have explicitly authorized you or your clinical facility to view their continuous vitals, activity, and sleep telemetry. Every request is verified server-side and recorded in the audit trail.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Consented Patients List */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  Consented Patients ({consentedPatients.length})
                </h3>
                <button
                  onClick={fetchConsentedPatients}
                  disabled={monitoringLoading}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${monitoringLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {monitoringLoading ? (
                <div className="text-center py-8 text-xs text-slate-400">Verifying authorization...</div>
              ) : consentedPatients.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                  <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No patients have actively granted consent to your profile yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[580px] overflow-y-auto">
                  {consentedPatients.map((p) => {
                    const isSelected = selectedPatientId === p.patientId;
                    return (
                      <div
                        key={p.patientId}
                        onClick={() => handleSelectConsentedPatient(p.patientId)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          {p.wearableConnected ? (
                            <span className="badge-verified text-[10px] px-1.5 py-0">
                              {p.connectedPlatform || 'Connected'}
                            </span>
                          ) : (
                            <span className="badge-neutral text-[10px] px-1.5 py-0">No Device</span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                          <span>Phone: {p.phone || 'Not shared'}</span>
                          {p.latestHeartRate && (
                            <span className="font-bold text-rose-600 flex items-center gap-1">
                              <HeartPulse className="w-3 h-3" />
                              {p.latestHeartRate.value} BPM
                            </span>
                          )}
                        </div>

                        {/* Granted Categories */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.grantedCategories.map((cat: string) => (
                            <span
                              key={cat}
                              className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[9px] font-bold uppercase"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Selected Consented Patient Telemetry Detail */}
            <div className="lg:col-span-8 space-y-6">
              {metricsLoading ? (
                <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                  Loading cryptographic health telemetry...
                </div>
              ) : patientMetricsData ? (
                <>
                  {/* Patient Header & Consent Proof */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900">{patientMetricsData.patient.name}</h3>
                        <span className="badge-verified text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Consent Active
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        <span>Age: {patientMetricsData.patient.age || 'Not set'}</span>
                        <span>&bull;</span>
                        <span>Blood Group: {patientMetricsData.patient.bloodGroup || 'O+'}</span>
                        <span>&bull;</span>
                        <span>
                          Device: {patientMetricsData.connection?.deviceName || patientMetricsData.connection?.platform || 'Direct Ingestion'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <div className="text-slate-400 font-semibold uppercase text-[10px]">Telemetry Freshness</div>
                      {patientMetricsData.connection?.lastSyncAt ? (
                        <div className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                          {new Date(patientMetricsData.connection.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {patientMetricsData.connection.isStale && (
                            <span className="badge-stale text-[9px] px-1 py-0">Stale &gt;6h</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No sync recorded</span>
                      )}
                    </div>
                  </div>

                  {/* Vitals Telemetry Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <HeartPulse className="w-4 h-4 text-rose-500" />
                        Latest Heart Rate
                      </div>
                      {patientMetricsData.metrics.find((m: any) => m.metric === 'heart_rate') ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-rose-600">
                            {patientMetricsData.metrics.find((m: any) => m.metric === 'heart_rate').value}
                          </span>
                          <span className="text-xs font-bold text-slate-400">BPM</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 pt-1">No samples recorded</div>
                      )}
                    </div>

                    <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        Today's Physical Activity
                      </div>
                      {patientMetricsData.dailySummaries?.[0]?.totalSteps ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-indigo-700">
                            {patientMetricsData.dailySummaries[0].totalSteps.toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-slate-400">steps</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 pt-1">No steps logged</div>
                      )}
                    </div>

                    <div className="spatial-card bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        Rest & Sleep
                      </div>
                      {patientMetricsData.dailySummaries?.[0]?.sleepMinutes ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-indigo-700">
                            {Math.floor(patientMetricsData.dailySummaries[0].sleepMinutes / 60)}h{' '}
                            {patientMetricsData.dailySummaries[0].sleepMinutes % 60}m
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 pt-1">No sleep data</div>
                      )}
                    </div>
                  </div>

                  {/* Raw Ingested Sensor Stream Table */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Timestamped Sensor Readings (Permitted Categories)
                    </h4>

                    {patientMetricsData.metrics.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No continuous telemetry samples found for consented categories.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-2 px-3 font-semibold">Sensor Measured Time</th>
                              <th className="py-2 px-3 font-semibold">Metric</th>
                              <th className="py-2 px-3 font-semibold">Reading</th>
                              <th className="py-2 px-3 font-semibold">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {patientMetricsData.metrics.map((s: any) => (
                              <tr key={s._id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono text-slate-600">
                                  {new Date(s.measuredAt).toLocaleString()}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900 capitalize">
                                  {s.metric.replace(/_/g, ' ')}
                                </td>
                                <td className="py-2 px-3 font-black text-indigo-700">
                                  {s.value} <span className="font-normal text-slate-400 text-[11px]">{s.unit}</span>
                                </td>
                                <td className="py-2 px-3 text-slate-500">{s.sourceDeviceId || s.platform}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Mandatory Clinical Disclaimer */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      Clinical Safety & Regulatory Boundary Notice:
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      {patientMetricsData.clinicalNotice}
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                  Select a consented patient from the left column to monitor their health telemetry.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
