import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, Clock, MapPin, Phone, Search, ShieldAlert, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Organization, Bed } from '../types';
import { useLanguage } from '../context/LanguageContext';

export const DirectoryHospitalsPage: React.FC = () => {
  const { t } = useLanguage();
  const [hospitals, setHospitals] = useState<Organization[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedCity]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hospRes, bedRes]: any = await Promise.all([
        api.get(`/organizations?type=hospital${selectedCity ? `&city=${selectedCity}` : ''}`),
        api.get('/beds'),
      ]);

      if (hospRes.success) setHospitals(hospRes.data);
      if (bedRes.success) setBeds(bedRes.data);
    } catch (err) {
      console.error('Failed to load hospitals:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHospitals = hospitals.filter((h) => {
    const q = search.toLowerCase();
    const matchName = h.name.toLowerCase().includes(q) || h.address.area.toLowerCase().includes(q);
    return matchName;
  });

  const getBedsForHospital = (hospitalId: string) => {
    return beds.filter((b) => b.organizationId._id === hospitalId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-indigo-600" />
            Hospitals & Real-Time Reported Beds
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Verified healthcare facilities with timestamped bed vacancies and capacity breakdown.
          </p>
        </div>

        {/* City Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">City:</label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 outline-none"
          >
            <option value="">All Regions</option>
            <option value="Rewa">Rewa</option>
            <option value="Bhopal">Bhopal</option>
            <option value="Indore">Indore</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by hospital name, area, or specialized trauma service..."
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-indigo-500 shadow-2xs"
        />
      </div>

      {/* Hospital Cards List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading verified facilities...</div>
      ) : filteredHospitals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No hospitals found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredHospitals.map((hospital) => {
            const hospitalBeds = getBedsForHospital(hospital._id);
            const totalCap = hospitalBeds.reduce((acc, b) => acc + b.totalCapacity, 0);
            const totalAvail = hospitalBeds.reduce((acc, b) => acc + b.available, 0);

            return (
              <div
                key={hospital._id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  {/* Left: Info */}
                  <div className="space-y-3 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{hospital.name}</h2>
                      {hospital.isVerified && (
                        <span className="badge-verified">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      )}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {hospital.registrationNumber || 'REG-ACTIVE'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        {hospital.address.street ? `${hospital.address.street}, ` : ''}{hospital.address.area}, {hospital.address.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-indigo-600" />
                        {hospital.phone}
                      </span>
                      {hospital.emergencyHelpline && (
                        <span className="flex items-center gap-1 font-bold text-rose-600">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Emergency: {hospital.emergencyHelpline}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Operating Hours: <span className="font-medium text-slate-700">{hospital.operatingHours}</span>
                    </p>

                    {/* Services Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {hospital.services.map((svc) => (
                        <span
                          key={svc}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right: Bed Capacity Breakdown */}
                  <div className="lg:w-96 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Reported Bed Status
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold text-indigo-700">{totalAvail}</span>
                        <span className="text-xs text-slate-400 font-medium"> / {totalCap} Vacant</span>
                      </div>
                    </div>

                    {/* Ward breakdown list */}
                    <div className="space-y-2">
                      {hospitalBeds.map((bed) => {
                        const isStale = bed.isStale;
                        return (
                          <div
                            key={bed._id}
                            className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <span>{bed.ward}</span>
                                {isStale && (
                                  <span className="badge-stale text-[9px] px-1.5 py-0" title="Not updated in >12h">
                                    Stale
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 capitalize">
                                Category: {bed.category} &bull; Updated {new Date(bed.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-indigo-700 text-sm">{bed.available}</span>
                              <span className="text-slate-400 text-[10px]"> / {bed.totalCapacity}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-500 italic text-center pt-1">
                      Call hospital emergency desk to confirm before transferring critical patients.
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
