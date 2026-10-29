import React, { useState, useEffect } from 'react';
import { UserPlus, Calendar, Clock, CheckCircle2, Search, User, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Appointment, Doctor } from '../../types';

export const ReceptionistDashboard: React.FC = () => {
  const { user, activeWorkspace } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // New Walk-in Patient / Booking Form
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('11:00 AM');
  const [reason, setReason] = useState('OPD Walk-in Consultation');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceptionData();
  }, [activeWorkspace]);

  const fetchReceptionData = async () => {
    try {
      setLoading(true);
      const [apptsRes, docsRes]: any = await Promise.all([
        api.get('/appointments'),
        api.get('/doctors'),
      ]);

      if (apptsRes.success) setAppointments(apptsRes.data);
      if (docsRes.success) {
        setDoctors(docsRes.data);
        if (docsRes.data.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(docsRes.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load reception data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (apptId: string) => {
    try {
      const res: any = await api.patch(`/appointments/${apptId}/status`, {
        status: 'checked_in',
        notes: 'Patient checked in at OPD front desk',
      });
      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) => (a._id === apptId ? { ...a, status: 'checked_in' } : a))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  const handleBookWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBookingLoading(true);
      setBookingError(null);
      setBookingSuccess(null);

      // Check or create patient
      let targetPatientId = user?.id; // default or fallback

      const apptRes: any = await api.post('/appointments', {
        doctorId: selectedDoctorId,
        appointmentDate: new Date().toISOString().split('T')[0],
        timeSlot: selectedSlot,
        reason: `${patientName ? `[${patientName}] ` : ''}${reason}`,
      });

      if (apptRes.success) {
        setBookingSuccess(`Token #${apptRes.data.tokenNumber} issued successfully for ${apptRes.data.timeSlot}!`);
        setPatientName('');
        setPatientEmail('');
        setPatientPhone('');
        fetchReceptionData();
      }
    } catch (err: any) {
      setBookingError(err.message || 'Booking conflict or error');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">Hospital Front Desk & OPD Reception</h1>
            <span className="badge-verified text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Desk
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Facility:{' '}
            <strong className="text-slate-800">
              {activeWorkspace ? activeWorkspace.organizationName : 'Sanjay Gandhi Memorial Hospital'}
            </strong>{' '}
            &bull; Staff: {user?.name}
          </div>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200">
          Today's Date: {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
      </div>

      {/* Main Grid: Fast Walk-in Booking on left, Queue check-in on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fast Walk-in Booking Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Quick Walk-In Registration
          </h2>

          {bookingSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{bookingSuccess}</span>
            </div>
          )}

          {bookingError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {bookingError}
            </div>
          )}

          <form onSubmit={handleBookWalkIn} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Patient Name</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Ramesh Verma"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile Contact</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+91 98260 00000"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Assign Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:border-indigo-500"
              >
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.userId?.name} ({d.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Time Slot</label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:border-indigo-500"
              >
                <option value="10:00 AM">10:00 AM</option>
                <option value="10:30 AM">10:30 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="11:30 AM">11:30 AM</option>
                <option value="12:00 PM">12:00 PM</option>
                <option value="04:30 PM">04:30 PM</option>
                <option value="05:00 PM">05:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason / Symptoms</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Walk-in complaints"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={bookingLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
            >
              {bookingLoading ? 'Issuing Token...' : 'Generate OPD Token & Book'}
            </button>
          </form>
        </div>

        {/* Live Queue & Check-In Desk */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Live Patient Check-In Queue
              </h2>
              <p className="text-xs text-slate-500">Verify patient arrival and update queue position for clinicians.</p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700">
              {appointments.filter((a) => a.status === 'confirmed').length} Pending Check-in
            </span>
          </div>

          <div className="space-y-3">
            {appointments.map((appt) => (
              <div
                key={appt._id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">Token #{appt.tokenNumber}</span>
                    <span className="font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {appt.timeSlot}
                    </span>
                    <span className="capitalize font-semibold text-slate-500">({appt.status})</span>
                  </div>
                  <div className="font-semibold text-slate-800">
                    {appt.patientId?.name || 'Walk-in Patient'}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Doctor: {appt.doctorId?.userId?.name} ({appt.doctorId?.specialty}) &bull; Reason: {appt.reason}
                  </div>
                </div>

                <div>
                  {appt.status === 'confirmed' ? (
                    <button
                      onClick={() => handleCheckIn(appt._id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs"
                    >
                      Check-In Patient
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-[11px]">
                      Checked In & Sent to Doctor
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
