import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapHealthcareProvider {
  id: string;
  source: 'openstreetmap_overpass' | 'swasthya_verified_registry';
  sourceUrl?: string;
  name: string;
  category: 'hospital' | 'clinic' | 'pharmacy' | 'doctor' | 'lab';
  coordinates: {
    lat: number;
    lng: number;
  };
  distanceKm: number;
  address: {
    fullAddress: string;
  };
  phone?: string;
  website?: string;
  openingHours?: string;
  isVerifiedFacility: boolean;
  operationalData: {
    bedAvailability: {
      status: string;
      totalAvailable?: number;
      totalCapacity?: number;
      isStale?: boolean;
      note: string;
    };
    medicineStock: {
      status: string;
      note: string;
    };
    doctorSchedule: {
      status: string;
      note: string;
    };
    ambulanceService: {
      status: string;
      note: string;
    };
  };
}

interface HealthcareLeafletMapProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  providers: MapHealthcareProvider[];
  selectedProviderId?: string | null;
  onSelectProvider?: (provider: MapHealthcareProvider) => void;
  className?: string;
}

export const HealthcareLeafletMap: React.FC<HealthcareLeafletMapProps> = ({
  center,
  radiusKm,
  providers,
  selectedProviderId,
  onSelectProvider,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circleLayerRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: radiusKm <= 5 ? 13 : radiusKm <= 15 ? 11 : 9,
        scrollWheelZoom: true,
      });

      // Standard OSM Tile Layer with attribution
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Center and Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([center.lat, center.lng], radiusKm <= 3 ? 14 : radiusKm <= 10 ? 12 : 10);

    // Update Radius Circle
    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
    }

    circleLayerRef.current = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: '#0d9488',
      weight: 1.5,
      fillColor: '#14b8a6',
      fillOpacity: 0.08,
      dashArray: '6, 6',
    }).addTo(map);
  }, [center.lat, center.lng, radiusKm]);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // Center User Marker
    const userMarkerIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-5 h-5 rounded-full bg-indigo-600 border-2 border-white shadow-lg z-10"></div>
          <div class="absolute w-8 h-8 rounded-full bg-indigo-400 opacity-60 animate-ping"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([center.lat, center.lng], { icon: userMarkerIcon })
      .bindPopup(`<strong>Searched Location</strong><br/><span style="font-size:11px;">Search center point</span>`)
      .addTo(markersGroup);

    // Provider category color helper
    const getCategoryBadgeColor = (cat: string) => {
      switch (cat) {
        case 'hospital':
          return { bg: '#e11d48', label: 'HOSP' };
        case 'pharmacy':
          return { bg: '#059669', label: 'RX' };
        case 'lab':
          return { bg: '#7c3aed', label: 'LAB' };
        case 'doctor':
          return { bg: '#2563eb', label: 'DOC' };
        default:
          return { bg: '#0d9488', label: 'CLINIC' };
      }
    };

    providers.forEach((p) => {
      const { bg, label } = getCategoryBadgeColor(p.category);
      const isSelected = selectedProviderId === p.id;

      const markerHtml = `
        <div style="cursor:pointer; transform: scale(${isSelected ? 1.25 : 1}); transition: transform 0.2s;" title="${p.name}">
          <div style="background:${bg}; color:white; font-size:10px; font-weight:800; padding:2px 6px; border-radius:12px; border:2px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.3); text-align:center; white-space:nowrap;">
            ${label}
          </div>
          <div style="width:2px; height:6px; background:${bg}; margin:0 auto;"></div>
        </div>
      `;

      const providerIcon = L.divIcon({
        className: 'provider-custom-marker',
        html: markerHtml,
        iconSize: [40, 30],
        iconAnchor: [20, 28],
      });

      const marker = L.marker([p.coordinates.lat, p.coordinates.lng], { icon: providerIcon });

      // Bed availability badge html
      let bedBadgeHtml = '';
      if (p.operationalData?.bedAvailability?.status === 'Connected') {
        bedBadgeHtml = `
          <div style="margin-top:6px; padding:4px 8px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; font-size:11px; color:#047857;">
            <strong>Beds Available:</strong> ${p.operationalData.bedAvailability.totalAvailable} / ${p.operationalData.bedAvailability.totalCapacity}
            ${p.operationalData.bedAvailability.isStale ? '<span style="color:#b45309;">(Stale >12h)</span>' : ''}
          </div>
        `;
      } else {
        bedBadgeHtml = `
          <div style="margin-top:4px; font-size:10px; color:#64748b;">
            Bed telemetry: <em>${p.operationalData?.bedAvailability?.status || 'Not connected'}</em>
          </div>
        `;
      }

      const popupHtml = `
        <div style="font-family:inherit; min-width:210px; max-width:260px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:4px;">
            <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:${bg};">${p.category}</span>
            <span style="font-size:11px; font-weight:700; color:#0d9488;">${p.distanceKm} km</span>
          </div>
          <h4 style="font-size:14px; font-weight:bold; color:#0f172a; margin:0 0 4px 0; line-height:1.2;">
            ${p.name}
          </h4>
          <p style="font-size:11px; color:#475569; margin:0 0 6px 0;">
            ${p.address.fullAddress}
          </p>
          ${bedBadgeHtml}
          <div style="margin-top:8px; display:flex; gap:6px;">
            ${p.phone ? `<a href="tel:${p.phone}" style="flex:1; text-align:center; padding:4px 8px; background:#0d9488; color:white; border-radius:6px; font-size:11px; font-weight:bold; text-decoration:none;">Call</a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${p.coordinates.lat},${p.coordinates.lng}" target="_blank" rel="noopener noreferrer" style="flex:1; text-align:center; padding:4px 8px; background:#f1f5f9; color:#0f172a; border-radius:6px; font-size:11px; font-weight:600; text-decoration:none;">Directions</a>
          </div>
          <div style="margin-top:6px; font-size:9px; color:#94a3b8; text-align:right;">
            Source: ${p.source === 'swasthya_verified_registry' ? 'Swasthya Verified' : 'OpenStreetMap'}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onSelectProvider) onSelectProvider(p);
      });

      marker.addTo(markersGroup);
    });
  }, [providers, selectedProviderId, center.lat, center.lng]);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[460px] z-10" />
      {/* Legend Badge */}
      <div className="absolute bottom-3 left-3 z-[400] glass-panel px-3 py-2 rounded-xl text-xs space-y-1 shadow-md">
        <div className="font-bold text-slate-800 text-[11px] mb-1">Healthcare Map Layers</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
          <span className="text-slate-600 text-[10px]">Hospital</span>
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ml-1"></span>
          <span className="text-slate-600 text-[10px]">Clinic</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 ml-1"></span>
          <span className="text-slate-600 text-[10px]">Pharmacy</span>
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ml-1"></span>
          <span className="text-slate-600 text-[10px]">Doctor</span>
        </div>
      </div>
    </div>
  );
};
