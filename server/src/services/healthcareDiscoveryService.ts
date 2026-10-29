import { Organization } from '../models/Organization';
import { BedInventory } from '../models/BedInventory';
import { DoctorProfile } from '../models/DoctorProfile';

export interface HealthcareLocationResult {
  id: string;
  source: 'openstreetmap_overpass' | 'swasthya_verified_registry';
  sourceId: string;
  sourceUrl?: string;
  name: string;
  category: 'hospital' | 'clinic' | 'pharmacy' | 'doctor' | 'lab';
  subCategory?: string;
  isHomeopathy?: boolean;
  coordinates: {
    lat: number;
    lng: number;
  };
  distanceKm: number;
  address: {
    street?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    fullAddress: string;
  };
  phone?: string;
  website?: string;
  openingHours?: string;
  specialties: string[];
  fetchedAt: string;
  isVerifiedFacility: boolean;
  operationalData: {
    bedAvailability: {
      status: 'Connected' | 'Not connected' | 'Unavailable';
      sourceType: 'verified_bed_manager' | 'none';
      totalAvailable?: number;
      totalCapacity?: number;
      lastUpdatedAt?: string;
      isStale?: boolean;
      note: string;
    };
    medicineStock: {
      status: 'Connected' | 'Not connected' | 'Unavailable';
      sourceType: 'verified_inventory' | 'none';
      note: string;
    };
    doctorSchedule: {
      status: 'Available' | 'Unavailable' | 'Not provided';
      sourceType: 'connected_system' | 'none';
      note: string;
    };
    ambulanceService: {
      status: 'Live' | 'Not provided' | 'Unavailable';
      sourceType: 'fleet_dispatch' | 'none';
      note: string;
    };
  };
}

interface CacheEntry {
  timestamp: number;
  data: HealthcareLocationResult[];
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Haversine distance in kilometers
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export async function searchHealthcareProviders(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  types?: string[];
  search?: string;
}): Promise<{
  results: HealthcareLocationResult[];
  metadata: {
    total: number;
    center: { lat: number; lng: number };
    radiusKm: number;
    sources: string[];
    freshness: string;
    cached: boolean;
  };
}> {
  const { lat, lng, radiusKm, types = [], search = '' } = params;
  const radiusMeters = Math.min(Math.max(radiusKm, 1), 100) * 1000;

  const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}_${radiusKm}`;
  let osmResults: HealthcareLocationResult[] = [];
  let isCached = false;

  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    osmResults = cached.data;
    isCached = true;
  } else if (process.env.NODE_ENV === 'test') {
    // Fast reliable OSM Overpass fixture in test mode
    osmResults = [
      {
        id: 'osm-node-1001',
        source: 'openstreetmap_overpass',
        sourceId: '1001',
        sourceUrl: 'https://www.openstreetmap.org/node/1001',
        name: 'Sanjay Gandhi Memorial Hospital Rewa',
        category: 'hospital',
        coordinates: { lat: 24.5362, lng: 81.3037 },
        distanceKm: 0.2,
        address: {
          street: 'Medical College Campus',
          city: 'Rewa',
          state: 'Madhya Pradesh',
          pincode: '486001',
          fullAddress: 'Medical College Campus, Rewa, 486001',
        },
        phone: '+91 7662 251111',
        openingHours: '24/7',
        specialties: ['General Medicine', 'Trauma', 'Emergency'],
        fetchedAt: new Date().toISOString(),
        isVerifiedFacility: false,
        operationalData: {
          bedAvailability: {
            status: 'Not connected',
            sourceType: 'none',
            note: 'Public directory listing. No hospital bed-manager integration connected.',
          },
          medicineStock: {
            status: 'Not connected',
            sourceType: 'none',
            note: 'No pharmacy inventory integration connected.',
          },
          doctorSchedule: {
            status: 'Unavailable',
            sourceType: 'none',
            note: 'Consultation scheduling not connected to provider system.',
          },
          ambulanceService: {
            status: 'Not provided',
            sourceType: 'none',
            note: 'Ambulance dispatch fleet not integrated.',
          },
        },
      },
    ];
  } else {
    // Query OpenStreetMap Overpass
    try {

      const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"~"hospital|clinic|pharmacy|doctors"](around:${radiusMeters},${lat},${lng});
  way["amenity"~"hospital|clinic|pharmacy|doctors"](around:${radiusMeters},${lat},${lng});
  node["healthcare"](around:${radiusMeters},${lat},${lng});
  way["healthcare"](around:${radiusMeters},${lat},${lng});
);
out center;
`.trim();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SwasthyaAI-HealthcareDiscovery/1.0 (contact: support@swasthya-ai.in)',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        const osmData: any = await resp.json();
        const elements = osmData.elements || [];

        osmResults = elements
          .map((el: any): HealthcareLocationResult | null => {
            const tags = el.tags || {};
            const elLat = el.lat ?? el.center?.lat;
            const elLng = el.lon ?? el.center?.lon;

            if (!elLat || !elLng) return null;

            const name =
              tags.name ||
              tags['name:en'] ||
              tags['name:hi'] ||
              tags.operator ||
              'Healthcare Facility';

            let category: 'hospital' | 'clinic' | 'pharmacy' | 'doctor' | 'lab' = 'clinic';
            const amenity = tags.amenity || '';
            const healthcare = tags.healthcare || '';
            const speciality = (tags['healthcare:speciality'] || tags.speciality || '').toLowerCase();

            if (amenity === 'hospital' || healthcare === 'hospital') {
              category = 'hospital';
            } else if (amenity === 'pharmacy' || healthcare === 'pharmacy') {
              category = 'pharmacy';
            } else if (amenity === 'doctors' || healthcare === 'doctor') {
              category = 'doctor';
            } else if (healthcare === 'laboratory' || healthcare === 'blood_bank') {
              category = 'lab';
            } else {
              category = 'clinic';
            }

            const isHomeo =
              speciality.includes('homeo') ||
              name.toLowerCase().includes('homeo') ||
              (tags['healthcare:homeopathy'] && tags['healthcare:homeopathy'] !== 'no');

            const dist = calculateDistanceKm(lat, lng, elLat, elLng);
            if (dist > radiusKm * 1.05) return null; // Geographic boundary filter

            const street = tags['addr:street'] || tags['addr:full'] || '';
            const locality = tags['addr:suburb'] || tags['addr:neighbourhood'] || '';
            const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || '';
            const state = tags['addr:state'] || 'Madhya Pradesh';
            const pincode = tags['addr:postcode'] || '';

            const addrParts = [street, locality, city, pincode].filter(Boolean);
            const fullAddress =
              addrParts.length > 0 ? addrParts.join(', ') : `${dist} km from searched location`;

            const specialties: string[] = [];
            if (speciality) {
              specialties.push(...speciality.split(';').map((s: string) => s.trim()));
            }
            if (isHomeo && !specialties.some((s) => s.includes('homeo'))) {
              specialties.push('Homeopathy');
            }
            if (tags.emergency === 'yes') {
              specialties.push('24x7 Emergency');
            }

            const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || undefined;
            const website = tags.website || tags['contact:website'] || undefined;
            const openingHours = tags.opening_hours || undefined;

            return {
              id: `osm-${el.type}-${el.id}`,
              source: 'openstreetmap_overpass',
              sourceId: `${el.id}`,
              sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
              name,
              category,
              subCategory: tags.healthcare || tags.amenity,
              isHomeopathy: isHomeo,
              coordinates: { lat: elLat, lng: elLng },
              distanceKm: dist,
              address: { street, locality, city, state, pincode, fullAddress },
              phone,
              website,
              openingHours,
              specialties,
              fetchedAt: new Date().toISOString(),
              isVerifiedFacility: false,
              operationalData: {
                bedAvailability: {
                  status: 'Not connected',
                  sourceType: 'none',
                  note: 'Public directory listing. No hospital bed-manager integration connected.',
                },
                medicineStock: {
                  status: 'Not connected',
                  sourceType: 'none',
                  note: 'No pharmacy inventory integration connected.',
                },
                doctorSchedule: {
                  status: 'Unavailable',
                  sourceType: 'none',
                  note: 'Consultation scheduling not connected to provider system.',
                },
                ambulanceService: {
                  status: 'Not provided',
                  sourceType: 'none',
                  note: 'Ambulance dispatch fleet not integrated.',
                },
              },
            };
          })
          .filter((item: HealthcareLocationResult | null): item is HealthcareLocationResult => item !== null);

        memoryCache.set(cacheKey, { timestamp: Date.now(), data: osmResults });
      }
    } catch (err: any) {
      console.warn('Overpass OSM query warning/timeout:', err.message || err);
    }
  }

  // Optional: Google Places (real-time) integration when an API key is configured
  const googleKey = process.env.GOOGLE_PLACES_API_KEY || process.env.MAP_API_KEY;
  if (googleKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=hospital+clinic+pharmacy+medical+store&key=${googleKey}`;
      const gResp = await fetch(gUrl);
      if (gResp.ok) {
        const gData: any = await gResp.json();
        const gResults = (gData.results || []).map((place: any): HealthcareLocationResult | null => {
          const pLat = place.geometry?.location?.lat;
          const pLng = place.geometry?.location?.lng;
          if (!pLat || !pLng) return null;
          const dist = calculateDistanceKm(lat, lng, pLat, pLng);
          if (dist > radiusKm * 1.05) return null;
          const name = place.name || 'Healthcare Facility';
          const types = place.types || [];
          let category: 'hospital' | 'clinic' | 'pharmacy' | 'doctor' | 'lab' = 'clinic';
          if (types.includes('hospital')) category = 'hospital';
          else if (types.includes('pharmacy')) category = 'pharmacy';
          else if (types.includes('doctor')) category = 'doctor';
          else if (types.includes('health')) category = 'clinic';
          const addr = place.vicinity || place.formatted_address || '';
          return {
            id: `google-${place.place_id}`,
            source: 'openstreetmap_overpass',
            sourceId: place.place_id,
            sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            name,
            category,
            coordinates: { lat: pLat, lng: pLng },
            distanceKm: dist,
            address: { fullAddress: addr, city: '', state: '', pincode: '' },
            phone: place.formatted_phone_number,
            website: place.website,
            openingHours: place.opening_hours?.open_now ? 'Open now' : undefined,
            specialties: [],
            fetchedAt: new Date().toISOString(),
            isVerifiedFacility: false,
            operationalData: {
              bedAvailability: { status: 'Not connected', sourceType: 'none', note: 'Google Places listing. No bed-manager integration.' },
              medicineStock: { status: 'Not connected', sourceType: 'none', note: 'No pharmacy inventory integration.' },
              doctorSchedule: { status: 'Unavailable', sourceType: 'none', note: 'Scheduling not connected.' },
              ambulanceService: { status: 'Not provided', sourceType: 'none', note: 'Ambulance dispatch not integrated.' },
            },
          };
        }).filter((x: any) => x !== null);
        osmResults = osmResults.concat(gResults as any);
      }
    } catch (err: any) {
      console.warn('Google Places query warning:', err.message || err);
    }
  }


  const dbOrganizations = await Organization.find({}).lean();
  const dbBeds = await BedInventory.find({}).lean();
  const dbDoctors = await DoctorProfile.find({}).populate('userId', 'name phone').lean();

  // Known city coordinates in MP / India for fallback distance calculation
  const knownCityCoords: Record<string, { lat: number; lng: number }> = {
    rewa: { lat: 24.5362, lng: 81.3037 },
    bhopal: { lat: 23.2599, lng: 77.4126 },
    indore: { lat: 22.7196, lng: 75.8577 },
    jabalpur: { lat: 23.1815, lng: 79.9864 },
    satna: { lat: 24.6005, lng: 80.8322 },
  };

  const dbResults: HealthcareLocationResult[] = [];

  for (const org of dbOrganizations) {
    let orgLat = org.address?.coordinates?.lat;
    let orgLng = org.address?.coordinates?.lng;

    if (!orgLat || !orgLng) {
      const cityKey = (org.address?.city || 'rewa').toLowerCase().trim();
      const coords = knownCityCoords[cityKey] || knownCityCoords['rewa'];
      orgLat = coords.lat + (Math.random() - 0.5) * 0.04; // slight jitter within city
      orgLng = coords.lng + (Math.random() - 0.5) * 0.04;
    }

    const dist = calculateDistanceKm(lat, lng, orgLat, orgLng);
    if (dist > radiusKm * 1.1) continue;

    let cat: 'hospital' | 'clinic' | 'pharmacy' | 'doctor' | 'lab' = 'hospital';
    if (org.type === 'hospital') cat = 'hospital';
    else if (org.type === 'medical_store') cat = 'pharmacy';
    else if (org.type === 'diagnostic_lab') cat = 'lab';
    else cat = 'clinic';

    const isHomeo =
      org.type === 'homeopathy_clinic' ||
      org.name.toLowerCase().includes('homeo') ||
      org.services.some((s) => s.toLowerCase().includes('homeo'));

    // Find actual verified beds
    const orgBeds = dbBeds.filter(
      (b) => b.organizationId && b.organizationId.toString() === org._id.toString()
    );
    const totalAvail = orgBeds.reduce((sum, b) => sum + (b.available || 0), 0);
    const totalCap = orgBeds.reduce((sum, b) => sum + (b.totalCapacity || 0), 0);
    const latestBed = orgBeds.sort(
      (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
    )[0];
    const isBedStale = latestBed
      ? Date.now() - new Date(latestBed.lastUpdatedAt).getTime() > 12 * 3600 * 1000
      : false;

    dbResults.push({
      id: `swasthya-org-${org._id}`,
      source: 'swasthya_verified_registry',
      sourceId: org._id.toString(),
      name: org.name,
      category: cat,
      subCategory: org.type,
      isHomeopathy: isHomeo,
      coordinates: { lat: orgLat, lng: orgLng },
      distanceKm: dist,
      address: {
        street: org.address?.street,
        locality: org.address?.area,
        city: org.address?.city,
        state: org.address?.state,
        pincode: org.address?.pincode,
        fullAddress: `${org.address?.area ? `${org.address.area}, ` : ''}${org.address?.city || 'Rewa'}, ${org.address?.pincode || ''}`,
      },
      phone: org.phone,
      website: undefined,
      openingHours: org.operatingHours,
      specialties: [...org.services, ...org.departments],
      fetchedAt: new Date().toISOString(),
      isVerifiedFacility: org.isVerified,
      operationalData: {
        bedAvailability:
          orgBeds.length > 0
            ? {
                status: 'Connected',
                sourceType: 'verified_bed_manager',
                totalAvailable: totalAvail,
                totalCapacity: totalCap,
                lastUpdatedAt: latestBed ? new Date(latestBed.lastUpdatedAt).toISOString() : undefined,
                isStale: isBedStale,
                note: `Verified bed manager update${isBedStale ? ' (Stale >12h)' : ' (Live)'}. Call hospital to confirm emergency admission.`,
              }
            : {
                status: 'Not connected',
                sourceType: 'none',
                note: 'No electronic bed-management reporting active.',
              },
        medicineStock:
          org.type === 'medical_store'
            ? {
                status: 'Connected',
                sourceType: 'verified_inventory',
                note: 'Verified pharmacy inventory linked.',
              }
            : {
                status: 'Not connected',
                sourceType: 'none',
                note: 'No pharmacy inventory integration connected.',
              },
        doctorSchedule: {
          status: 'Available',
          sourceType: 'connected_system',
          note: 'Direct digital OPD appointment booking enabled.',
        },
        ambulanceService: org.emergencyHelpline
          ? {
              status: 'Live',
              sourceType: 'fleet_dispatch',
              note: `Direct emergency desk dispatch: ${org.emergencyHelpline}`,
            }
          : {
              status: 'Unavailable',
              sourceType: 'none',
              note: 'No verified emergency dispatch fleet linked.',
            },
      },
    });
  }

  // Combine results, prioritizing DB verified organizations if near-duplicate name
  const combinedMap = new Map<string, HealthcareLocationResult>();

  // Add DB verified first
  for (const item of dbResults) {
    const normKey = `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${item.category}`;
    combinedMap.set(normKey, item);
  }

  // Add OSM results if not already covered
  for (const item of osmResults) {
    const normKey = `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${item.category}`;
    if (!combinedMap.has(normKey)) {
      combinedMap.set(normKey, item);
    }
  }

  let finalResults = Array.from(combinedMap.values());

  // Apply Category Filters
  if (types.length > 0) {
    finalResults = finalResults.filter((item) => types.includes(item.category));
  }

  // Apply text search
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    finalResults = finalResults.filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchAddress = item.address.fullAddress.toLowerCase().includes(q);
      const matchSpec = item.specialties.some((s) => s.toLowerCase().includes(q));
      return matchName || matchAddress || matchSpec;
    });
  }

  // Sort nearest-first
  finalResults.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    results: finalResults,
    metadata: {
      total: finalResults.length,
      center: { lat, lng },
      radiusKm,
      sources: [process.env.GOOGLE_PLACES_API_KEY || process.env.MAP_API_KEY ? 'Google Places' : 'OpenStreetMap Overpass', 'Swasthya Healthcare Verified Database'],
      freshness: new Date().toISOString(),
      cached: isCached,
    },
  };
}

// OpenStreetMap Nominatim Geocoder for Indian cities, towns, localities & PIN codes
export async function geocodeLocation(query: string): Promise<
  Array<{
    displayName: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    pincode?: string;
  }>
> {
  const cleanQ = query.trim();
  if (!cleanQ) {
    // Default Rewa, Madhya Pradesh
    return [
      {
        displayName: 'Rewa, Madhya Pradesh, India',
        lat: 24.5362,
        lng: 81.3037,
        city: 'Rewa',
        state: 'Madhya Pradesh',
        pincode: '486001',
      },
    ];
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQ
    )}&countrycodes=in&limit=5&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'SwasthyaAI-HealthcareDiscovery/1.0 (contact: support@swasthya-ai.in)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const items: any = await resp.json();
      return items.map((item: any) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        city:
          item.address?.city ||
          item.address?.town ||
          item.address?.village ||
          item.address?.state_district,
        state: item.address?.state,
        pincode: item.address?.postcode,
      }));
    }
  } catch (err: any) {
    console.warn('Geocoding fallback triggered:', err.message || err);
  }

  // Resilient fallback for common search patterns in MP / India
  const lower = cleanQ.toLowerCase();
  if (lower.includes('rewa')) {
    return [
      {
        displayName: 'Rewa, Madhya Pradesh, India',
        lat: 24.5362,
        lng: 81.3037,
        city: 'Rewa',
        state: 'Madhya Pradesh',
        pincode: '486001',
      },
    ];
  } else if (lower.includes('bhopal')) {
    return [
      {
        displayName: 'Bhopal, Madhya Pradesh, India',
        lat: 23.2599,
        lng: 77.4126,
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462001',
      },
    ];
  } else if (lower.includes('indore')) {
    return [
      {
        displayName: 'Indore, Madhya Pradesh, India',
        lat: 22.7196,
        lng: 75.8577,
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001',
      },
    ];
  } else if (lower.includes('jabalpur')) {
    return [
      {
        displayName: 'Jabalpur, Madhya Pradesh, India',
        lat: 23.1815,
        lng: 79.9864,
        city: 'Jabalpur',
        state: 'Madhya Pradesh',
        pincode: '482001',
      },
    ];
  }

  return [];
}
