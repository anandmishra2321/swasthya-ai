import React, { useState, useEffect } from 'react';
import { Stethoscope, Calendar, Clock, DollarSign, CheckCircle2, User, Search, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Doctor } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const DirectoryDoctorsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [homeopathyFilter, setHomeopathyFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('10:00 AM');
  const [reason, setReason] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctors();
  }, [specialtyFilter, homeopathyFilter]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      let query = '';
      if (specialtyFilter) query += `specialty=${encodeURIComponent(specialtyFilter)}&`;
      if (homeopathyFilter) query += `homeopathy=${homeopathyFilter}&`;

      const res: any = await api.get(`/doctors?${query}`);
      if (res.success) setDoctors(res.data);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    const q = search.toLowerCase();
    const name = doc.userId?.name?.toLowerCase() || '';
    const spec = doc.specialty?.toLowerCase() || '';
    const org = doc.organizationId?.name?.toLowerCase() || '';
    return name.includes(q) || spec.includes(q) || org.includes(q);
  });

  const handleOpenBooking = (doctor: Doctor) => {
    if (!user) {
      navigate('/login?redirect=/doctors');
      return;
    }
    setSelectedDoctor(doctor);
    setBookingSuccess(null);
    setBookingError(null);
    setReason('');
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;

    try {
      setBookingLoading(true);
      setBookingError(null);

      const res: any = await api.post('/appointments', {
        doctorId: selectedDoctor._id,
        appointmentDate: bookingDate,
        timeSlot: selectedSlot,
        reason: reason.trim() || 'General Medical Consultation',
      });

      if (res.success) {
        setBookingSuccess(res.data);
      }
    } catch (err: any) {
      setBookingError(err.message || 'Appointment booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-8 h-8 text-indigo-600" />
            Doctors & Specialist Consultations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Book verified appointments at Sanjay Gandhi Memorial Hospital or independent clinics.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 outline-none"
          >
            <option value="">All Specialties</option>
            <option value="Cardiology">Cardiology</option>
            <option value="General Medicine">General Medicine</option>
            <option value="Diabetology">Diabetology</option>
            <option value="Homeopathy">Homeopathy</option>
          </select>

          <select
            value={homeopathyFilter}
            onChange={(e) => setHomeopathyFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 outline-none"
          >
            <option value="">All Practices</option>
            <option value="false">Allopathy Only</option>
            <option value="true">Homeopathy Only</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by doctor name, specialty, or clinic..."
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-indigo-500 shadow-2xs"
        />
      </div>

      {/* Doctor Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading specialist directory...</div>
      ) : filteredDoctors.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No doctors found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => (
            <div
              key={doc._id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                    {doc.userId?.name?.charAt(0) || 'D'}
                  </div>
                  {doc.isHomeopathy ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Homeopathy Practitioner
                    </span>
                  ) : (
                    <span className="badge-verified">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Specialist
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-lg text-slate-900 leading-snug">
                    {doc.userId?.name}
                  </h3>
                  <div className="text-indigo-700 font-semibold text-xs mt-0.5">
                    {doc.specialty}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {doc.qualifications.join(', ')} &bull; {doc.experienceYears} Years Exp
                  </div>
                </div>

                {doc.organizationId && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                    <span className="font-semibold block text-slate-900">{doc.organizationId.name}</span>
                    <span className="text-slate-500 text-[11px]">{doc.organizationId.address.area}, {doc.organizationId.address.city}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{doc.consultationHours}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Consultation: ₹{doc.consultationFee}</span>
                  </div>
                </div>

                {doc.isHomeopathy && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg leading-tight border border-amber-200/60">
                    *Homeopathy is complementary constitutional care. Not a substitute for emergency medicine.
                  </p>
                )}
              </div>

              <div className="pt-5 mt-4 border-t border-slate-100">
                <button
                  onClick={() => handleOpenBooking(doc)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Book Appointment Slot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Appointment Booking Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Book with {selectedDoctor.userId?.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedDoctor.specialty} &bull; {selectedDoctor.organizationId?.name}</p>
              </div>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {bookingSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Appointment Confirmed!</h4>
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 max-w-xs mx-auto border border-slate-200">
                  <div><strong>Date:</strong> {bookingSuccess.appointmentDate}</div>
                  <div><strong>Time Slot:</strong> {bookingSuccess.timeSlot}</div>
                  <div><strong>Token Number:</strong> #{bookingSuccess.tokenNumber}</div>
                  <div><strong>Status:</strong> Confirmed (Demo)</div>
                </div>
                <button
                  onClick={() => setSelectedDoctor(null)}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="space-y-4">
                {bookingError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Appointment Date</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Available Time Slot</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '04:30 PM', '05:00 PM'].map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                          selectedSlot === slot
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Visit</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Chest checkup, routine BP follow-up, viral fever..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDoctor(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
                  >
                    {bookingLoading ? 'Checking Slot...' : 'Confirm Booking'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
