import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  HeartPulse,
  Plus,
  Save,
  ShieldAlert,
  Users,
  AlertTriangle,
  Mail,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Bed, Organization } from '../../types';

export const HospitalAdminDashboard: React.FC = () => {
  const { user, activeWorkspace } = useAuth();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [hospitalInfo, setHospitalInfo] = useState<Organization | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Bed Modal / Row State
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState<number>(0);
  const [editAvail, setEditAvail] = useState<number>(0);
  const [editOccupied, setEditOccupied] = useState<number>(0);
  const [editCleaning, setEditCleaning] = useState<number>(0);
  const [editReserved, setEditReserved] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [bedError, setBedError] = useState<string | null>(null);

  // Invite Staff State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('hospital_doctor');
  const [inviteDepartment, setInviteDepartment] = useState('Cardiology');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchHospitalData();
  }, [activeWorkspace]);

  useEffect(() => {
    const handler = () => fetchHospitalData();
    window.addEventListener('swasthya:beds-updated', handler);
    return () => window.removeEventListener('swasthya:beds-updated', handler);
  }, [activeWorkspace]);

  const fetchHospitalData = async () => {
    try {
      setLoading(true);
      const orgId = activeWorkspace?.organizationId || user?.activeWorkspaceId;
      if (!orgId) return;

      const [orgRes, bedRes, staffRes]: any = await Promise.all([
        api.get(`/organizations/${orgId}`),
        api.get(`/beds?organizationId=${orgId}`),
        api.get(`/organizations/${orgId}/members`),
      ]);

      if (orgRes.success) setHospitalInfo(orgRes.data);
      if (bedRes.success) setBeds(bedRes.data);
      if (staffRes.success) setStaff(staffRes.data);
    } catch (err) {
      console.error('Failed to load hospital data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (bed: Bed) => {
    setEditingBedId(bed._id);
    setEditTotal(bed.totalCapacity);
    setEditAvail(bed.available);
    setEditOccupied(bed.occupied);
    setEditCleaning(bed.cleaning || 0);
    setEditReserved(bed.reserved || 0);
    setEditNotes(bed.notes || '');
    setBedError(null);
  };

  const handleSaveBed = async (bedId: string) => {
    setBedError(null);
    if (editAvail + editOccupied + editCleaning + editReserved > editTotal) {
      setBedError(`Total capacity (${editTotal}) is exceeded by the sum of categories (${editAvail + editOccupied + editCleaning + editReserved}).`);
      return;
    }

    try {
      setSaveLoading(true);
      const res: any = await api.put(`/beds/${bedId}`, {
        totalCapacity: editTotal,
        available: editAvail,
        occupied: editOccupied,
        cleaning: editCleaning,
        reserved: editReserved,
        notes: editNotes,
      });

      if (res.success) {
        setBeds((prev) =>
          prev.map((b) => (b._id === bedId ? { ...res.data, isStale: false, ageHours: 0 } : b))
        );
        setEditingBedId(null);
      }
    } catch (err: any) {
      setBedError(err.message || 'Failed to update bed');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = activeWorkspace?.organizationId || user?.activeWorkspaceId;
    if (!orgId) return;

    try {
      setInviteLoading(true);
      setInviteMessage(null);
      const res: any = await api.post(`/organizations/${orgId}/invite`, {
        email: inviteEmail,
        role: inviteRole,
        department: inviteDepartment,
      });

      if (res.success) {
        setInviteMessage(res.message);
        setInviteEmail('');
        fetchHospitalData();
      }
    } catch (err: any) {
      setInviteMessage(err.message || 'Staff invitation failed');
    } finally {
      setInviteLoading(false);
    }
  };

  const totalCap = beds.reduce((acc, b) => acc + b.totalCapacity, 0);
  const totalAvail = beds.reduce((acc, b) => acc + b.available, 0);
  const totalOcc = beds.reduce((acc, b) => acc + b.occupied, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">
              {hospitalInfo?.name || activeWorkspace?.organizationName || 'Hospital Command Center'}
            </h1>
            <span className="badge-verified text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Facility
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Emergency Helpline: <strong className="text-rose-600">{hospitalInfo?.emergencyHelpline || '108'}</strong> &bull; Total Registered Staff: {staff.length}
          </div>
        </div>

        <button
          onClick={() => setInviteModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          Invite Staff Member
        </button>
      </div>

      {/* Hospital Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bed Capacity</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalCap}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across all inpatient wards</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Available / Vacant</div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-1">{totalAvail}</div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-1">Ready for intake</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Occupied Beds</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-1">{totalOcc}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active admitted patients</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Occupancy Rate</div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-1">
            {totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0}%
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-1">Facility operational load</div>
        </div>
      </div>

      {/* Real-Time Hospital Bed Board */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-indigo-600" />
              Inpatient Bed Board & Live Ward Capacity
            </h2>
            <p className="text-xs text-slate-500">
              Update occupied, vacant, cleaning and reserved counts with real-time audit logging and stale data flags.
            </p>
          </div>
          <div className="text-xs text-slate-500 italic">
            *Updates reflect instantly on public search.
          </div>
        </div>

        {bedError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{bedError}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Ward Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Total Cap</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Occupied</th>
                <th className="px-4 py-3">Cleaning</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Last Sync</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {beds.map((bed) => {
                const isEditing = editingBedId === bed._id;
                return (
                  <tr key={bed._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 font-bold text-slate-900">{bed.ward}</td>
                    <td className="px-4 py-3.5 capitalize font-medium text-slate-600">{bed.category}</td>

                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={1}
                            value={editTotal}
                            onChange={(e) => setEditTotal(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded border border-slate-300 font-bold"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editAvail}
                            onChange={(e) => setEditAvail(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded border border-indigo-500 font-bold text-indigo-700"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editOccupied}
                            onChange={(e) => setEditOccupied(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded border border-slate-300 font-bold"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editCleaning}
                            onChange={(e) => setEditCleaning(parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-1 rounded border border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editReserved}
                            onChange={(e) => setEditReserved(parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-1 rounded border border-slate-300"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3.5 font-bold text-slate-800">{bed.totalCapacity}</td>
                        <td className="px-4 py-3.5 font-extrabold text-indigo-700 text-sm">{bed.available}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700">{bed.occupied}</td>
                        <td className="px-4 py-3.5 text-slate-500">{bed.cleaning}</td>
                        <td className="px-4 py-3.5 text-slate-500">{bed.reserved}</td>
                      </>
                    )}

                    <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                      <div>{new Date(bed.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      {bed.isStale && (
                        <span className="badge-stale text-[9px] px-1 py-0 mt-0.5 inline-block">
                          Stale (&gt;12h)
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSaveBed(bed._id)}
                            disabled={saveLoading}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[11px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingBedId(null)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(bed)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Directory */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Active Hospital Personnel & Affiliations
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <div key={member._id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 text-xs">
              <div className="font-bold text-slate-900 text-sm">{member.userId?.name}</div>
              <div className="text-indigo-700 font-semibold capitalize">{member.role.replace(/_/g, ' ')}</div>
              <div className="text-slate-500 text-[11px]">{member.userId?.email}</div>
              <div className="text-slate-400 text-[11px]">Dept: {member.department || 'General'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Invitation Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Invite Hospital Staff</h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-slate-400 font-bold p-1">
                ✕
              </button>
            </div>

            {inviteMessage && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold">
                {inviteMessage}
              </div>
            )}

            <form onSubmit={handleInviteStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Staff Member Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. nurse.rekha@swasthya.demo"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Assignment</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="hospital_doctor">Hospital Doctor / Clinician</option>
                  <option value="nurse">Staff Nurse</option>
                  <option value="bed_manager">Hospital Bed Manager</option>
                  <option value="hospital_receptionist">Hospital Receptionist</option>
                  <option value="hospital_staff">Operations Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={inviteDepartment}
                  onChange={(e) => setInviteDepartment(e.target.value)}
                  placeholder="e.g. Cardiology, Inpatient Care, ICU"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  {inviteLoading ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
