declare global {
  interface Window {
    google: any;
  }
}
import React, { useEffect, useRef } from 'react';
import { MapHealthcareProvider } from './HealthcareLeafletMap';

interface Props {
  center: { lat: number; lng: number };
  radiusKm: number;
  providers: MapHealthcareProvider[];
  selectedProviderId?: string | null;
  onSelectProvider?: (p: MapHealthcareProvider) => void;
  className?: string;
}

export const HealthcareGoogleMap: React.FC<Props> = ({ center, radiusKm, providers, selectedProviderId, onSelectProvider, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if (window.google?.maps) { init(); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => init();
    document.head.appendChild(script);

    function init() {
      if (!containerRef.current || mapRef.current) return;
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: radiusKm <= 3 ? 14 : radiusKm <= 10 ? 12 : 10,
        mapTypeControl: true,
        streetViewControl: false,
      });
      render();
    }
  }, []);

  const render = () => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    // clear markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    new window.google.maps.Circle({
      strokeColor: '#4f46e5',
      strokeOpacity: 0.6,
      strokeWeight: 1,
      fillColor: '#4f46e5',
      fillOpacity: 0.06,
      map,
      center,
      radius: radiusKm * 1000,
    });

    providers.forEach((p) => {
      const color = p.category === 'hospital' ? '#dc2626' : p.category === 'pharmacy' ? '#059669' : p.category === 'doctor' ? '#2563eb' : '#4f46e5';
      const marker = new window.google.maps.Marker({
        position: { lat: p.coordinates.lat, lng: p.coordinates.lng },
        map,
        title: p.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      const info = new window.google.maps.InfoWindow({
        content: `<div style="max-width:220px;"><strong>${p.name}</strong><br/>${p.address.fullAddress}<br/>${p.distanceKm} km</div>`,
      });
      marker.addListener('click', () => {
        info.open(map, marker);
        if (onSelectProvider) onSelectProvider(p);
      });
      markersRef.current.push(marker);
    });

    map.setCenter(center);
  };

  useEffect(() => {
    if (mapRef.current) render();
  }, [center.lat, center.lng, radiusKm, providers]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return <div className="p-6 text-center text-slate-500">Set VITE_GOOGLE_MAPS_API_KEY for Google Maps.</div>;
  }

  return <div ref={containerRef} className={`w-full h-full min-h-[460px] rounded-2xl ${className}`} />;
};

export default HealthcareGoogleMap;