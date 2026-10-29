import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  MapPin,
  Search,
  Navigation,
  Compass,
  Filter,
  Layers,
  Phone,
  Globe,
  Clock,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Info,
  RefreshCw,
  X,
  ChevronRight,
  ExternalLink,
  Map as MapIcon,
  List as ListIcon,
  Stethoscope,
  Pill,
  TestTube2,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import { HealthcareLeafletMap, MapHealthcareProvider } from '../components/HealthcareLeafletMap';
import { HealthcareGoogleMap } from '../components/HealthcareGoogleMap';

const RADIUS_OPTIONS = [1, 3, 5, 10, 25, 50, 100];

export const DiscoveryPage: React.FC = () => {
  // Center: Default Rewa, Madhya Pradesh
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 24.5362,
    lng: 81.3037,
  });
  const [locationName, setLocationName] = useState('Rewa, Madhya Pradesh');
  const [radiusKm, setRadiusKm] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [geocodeQuery, setGeocodeQuery] = useState('');
  const [geocodeSuggestions, setGeocodeSuggestions] = useState<any[]>([]);
  const [showGeocodeDropdown, setShowGeocodeDropdown] = useState(false);

  // Results & Loading
  const [providers, setProviders] = useState<MapHealthcareProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'both' | 'map' | 'list'>('both');

  // Selected Detail Modal
  const [selectedProvider, setSelectedProvider] = useState<MapHealthcareProvider | null>(null);

  // Geolocation & Follow
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [followLocation, setFollowLocation] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [center.lat, center.lng, radiusKm, selectedCategory]);

  // Clean up location watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchProviders = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      let typesParam = '';
      if (selectedCategory !== 'all') {
        typesParam = `&types=${selectedCategory}`;
      }

      const res: any = await api.get(
        `/healthcare/search?lat=${center.lat}&lng=${center.lng}&radiusKm=${radiusKm}${typesParam}${
          searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
        }`
      );

      if (res.success) {
        setProviders(res.data);
        setMetadata(res.metadata);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load healthcare facilities:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        const { latitude, longitude } = pos.coords;
        setCenter({ lat: latitude, lng: longitude });
        setLocationName(`Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      },
      (err) => {
        setGeoLocating(false);
        let msg = 'Failed to retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please enter a city, town, or PIN code manually.';
        }
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Auto-fetch current location on first load
  useEffect(() => {
    if (navigator.geolocation) {
      handleUseMyLocation();
    }
  }, []);

  const handleToggleFollow = () => {
    if (followLocation) {
      // Disable
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setFollowLocation(false);
    } else {
      if (!navigator.geolocation) {
        setGeoError('Geolocation not supported');
        return;
      }
      setGeoError(null);
      setFollowLocation(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          // Movement threshold ~50 meters (0.0005 deg)
          if (
            Math.abs(latitude - center.lat) > 0.0005 ||
            Math.abs(longitude - center.lng) > 0.0005
          ) {
            setCenter({ lat: latitude, lng: longitude });
            setLocationName(`Following Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
        },
        (err) => {
          console.warn('Watch location error:', err);
          setFollowLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  };

  const handleGeocodeSearch = async (val: string) => {
    setGeocodeQuery(val);
    if (val.trim().length < 2) {
      setGeocodeSuggestions([]);
      setShowGeocodeDropdown(false);
      return;
    }

    try {
      const res: any = await api.get(`/healthcare/geocode?q=${encodeURIComponent(val)}`);
      if (res.success && res.data.length > 0) {
        setGeocodeSuggestions(res.data);
        setShowGeocodeDropdown(true);
      }
    } catch {
      // quiet fail for typing suggestions
    }
  };

  const handleSelectGeocode = (item: any) => {
    setCenter({ lat: item.lat, lng: item.lng });
    setLocationName(item.displayName);
    setGeocodeQuery('');
    setShowGeocodeDropdown(false);
  };

  const filteredList = providers.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.address.fullAddress.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
              Verified Multi-Source Healthcare Discovery
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Real Nearby Healthcare Provider Discovery
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Real-world mapped search across India with OpenStreetMap Overpass and verified clinical registry. Strict boundary protection: bed, stock, and schedule telemetry shown only when actively connected.
            </p>
          </div>

          {/* Quick Location Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleUseMyLocation}
              disabled={geoLocating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 ${geoLocating ? 'animate-spin' : ''}`} />
              {geoLocating ? 'Locating...' : 'Use My Location'}
            </button>

            <button
              onClick={handleToggleFollow}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                followLocation
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Compass className={`w-4 h-4 ${followLocation ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`} />
              {followLocation ? 'Following Active' : 'Follow Location'}
            </button>
          </div>
        </div>

        {geoError && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{geoError}</span>
          </div>
        )}
      </div>

      {/* Control Bar: Geocoder Search, Radius, Categories */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Geocoder Search Bar */}
        <div className="md:col-span-5 relative">
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            Search City, Town, Locality or PIN Code
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={geocodeQuery}
              onChange={(e) => handleGeocodeSearch(e.target.value)}
              placeholder="e.g. Rewa, Civil Lines, Bhopal, 486001..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {showGeocodeDropdown && geocodeSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
              {geocodeSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectGeocode(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/60 transition-colors flex items-start gap-2 text-xs text-slate-800"
                >
                  <MapPin className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">{item.displayName.split(',')[0]}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{item.displayName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Radius Selector */}
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            Search Radius
          </label>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs overflow-x-auto">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  radiusKm === r
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="md:col-span-4 flex items-end justify-between sm:justify-end gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('both')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          <button
            onClick={fetchProviders}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Services', icon: Layers },
            { id: 'hospital', label: 'Hospitals', icon: Building2 },
            { id: 'clinic', label: 'Clinics', icon: Stethoscope },
            { id: 'pharmacy', label: 'Pharmacies', icon: Pill },
            { id: 'doctor', label: 'Doctors', icon: User },
            { id: 'lab', label: 'Diagnostic Labs', icon: TestTube2 },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Text Filter Input */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name or specialty..."
            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Freshness & Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
        <div className="flex items-center gap-2">
          <span>Center: <strong className="text-slate-800">{locationName}</strong></span>
          <span>&bull;</span>
          <span>Found: <strong className="text-indigo-700">{filteredList.length} providers</strong> within {radiusKm} km</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Sources: OpenStreetMap Overpass &bull; Swasthya Verified DB</span>
          {metadata?.cached && <span className="badge-neutral text-[10px]">Cached TTL</span>}
        </div>
      </div>

      {/* Main Content Area: Split / Map / List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Leaflet Map */}
        {(viewMode === 'both' || viewMode === 'map') && (
          <div className={viewMode === 'both' ? 'lg:col-span-7' : 'lg:col-span-12'}>
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
              <HealthcareGoogleMap
                center={center}
                radiusKm={radiusKm}
                providers={filteredList}
                selectedProviderId={selectedProvider?.id}
                onSelectProvider={(p) => setSelectedProvider(p)}
                className="h-[580px]"
              />
            ) : (
              <HealthcareLeafletMap
                center={center}
                radiusKm={radiusKm}
                providers={filteredList}
                selectedProviderId={selectedProvider?.id}
                onSelectProvider={(p) => setSelectedProvider(p)}
                className="h-[580px]"
              />
            )}
          </div>
        )}

        {/* Providers List View */}
        {(viewMode === 'both' || viewMode === 'list') && (
          <div className={`${viewMode === 'both' ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>
            {loading ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                Querying geospatial healthcare registries...
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-2">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">No healthcare providers found</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Try expanding the search radius ({radiusKm} km) or selecting "All Services".
                </p>
                <button
                  onClick={() => setRadiusKm(25)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                >
                  Expand to 25 km
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {filteredList.map((provider) => {
                  const isSelected = selectedProvider?.id === provider.id;
                  const isHospital = provider.category === 'hospital';
                  const bedsData = provider.operationalData.bedAvailability;

                  return (
                    <div
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider)}
                      className={`spatial-card p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/60 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              {provider.category}
                            </span>
                            {provider.isVerifiedFacility && (
                              <span className="badge-verified text-[10px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified Registry
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-indigo-700 ml-auto sm:ml-0">
                              {provider.distanceKm} km away
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {provider.name}
                          </h3>

                          <p className="text-xs text-slate-500 line-clamp-1">
                            {provider.address.fullAddress}
                          </p>
                        </div>
                      </div>

                      {/* Operational Telemetry Boundaries */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                        {/* Bed Availability */}
                        <div className="p-2 rounded-lg bg-slate-50/80 border border-slate-100">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase">
                            Bed Availability
                          </div>
                          {bedsData.status === 'Connected' ? (
                            <div className="font-bold text-emerald-700 flex items-center gap-1">
                              <span>{bedsData.totalAvailable} / {bedsData.totalCapacity} Vacant</span>
                              {bedsData.isStale && <span className="badge-stale text-[9px] px-1 py-0">Stale</span>}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic">Not connected</div>
                          )}
                        </div>

                        {/* Direct Action */}
                        <div className="flex items-center justify-end gap-1.5">
                          {provider.phone && (
                            <a
                              href={`tel:${provider.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                              title="Call Facility"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${provider.coordinates.lat},${provider.coordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                            title="Directions"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Provider Detailed Slide-over Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                    {selectedProvider.category}
                  </span>
                  {selectedProvider.isVerifiedFacility && (
                    <span className="badge-verified text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                  <span className="text-xs font-bold text-indigo-700">{selectedProvider.distanceKm} km away</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedProvider.name}</h2>
              </div>
              <button
                onClick={() => setSelectedProvider(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>{selectedProvider.address.fullAddress}</span>
              </div>

              {selectedProvider.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-600 shrink-0" />
                  <a href={`tel:${selectedProvider.phone}`} className="font-bold text-indigo-700 hover:underline">
                    {selectedProvider.phone}
                  </a>
                </div>
              )}

              {selectedProvider.openingHours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Hours: {selectedProvider.openingHours}</span>
                </div>
              )}
            </div>

            {/* Operational Boundary Status Grid */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Operational Telemetry Boundaries
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Bed Vacancy</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedProvider.operationalData.bedAvailability.status === 'Connected' ? (
                      <span className="text-emerald-700">
                        {selectedProvider.operationalData.bedAvailability.totalAvailable} /{' '}
                        {selectedProvider.operationalData.bedAvailability.totalCapacity} Vacant
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Not connected</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {selectedProvider.operationalData.bedAvailability.note}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Medicine Inventory</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedProvider.operationalData.medicineStock.status === 'Connected' ? (
                      <span className="text-emerald-700">Connected</span>
                    ) : (
                      <span className="text-slate-400 italic">Not connected</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {selectedProvider.operationalData.medicineStock.note}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 italic">
                Source Attribution: {selectedProvider.source === 'swasthya_verified_registry' ? 'Swasthya Healthcare Verified Database' : 'OpenStreetMap Overpass Registry'} (ID: {selectedProvider.id})
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {selectedProvider.phone && (
                <a
                  href={`tel:${selectedProvider.phone}`}
                  className="flex-1 py-3 text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Call Provider
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedProvider.coordinates.lat},${selectedProvider.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4" />
                Get Directions
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
