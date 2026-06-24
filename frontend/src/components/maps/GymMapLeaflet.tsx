'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CITY_COORDS: Record<string, [number, number]> = {
  bangalore: [12.9716, 77.5946], bengaluru: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777], 'navi mumbai': [19.033, 73.0297],
  delhi: [28.6139, 77.209], 'new delhi': [28.6139, 77.209],
  chennai: [13.0827, 80.2707], hyderabad: [17.385, 78.4867],
  kolkata: [22.5726, 88.3639], pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714], jaipur: [26.9124, 75.7873],
  surat: [21.1702, 72.8311], lucknow: [26.8467, 80.9462],
  kanpur: [26.4499, 80.3319], nagpur: [21.1458, 79.0882],
  indore: [22.7196, 75.8577], thane: [19.2183, 72.9781],
  bhopal: [23.2599, 77.4126], visakhapatnam: [17.6868, 83.2185],
  patna: [25.5941, 85.1376], vadodara: [22.3072, 73.1812],
  ghaziabad: [28.6692, 77.4538], ludhiana: [30.901, 75.8573],
  agra: [27.1767, 78.0081], nashik: [20.0059, 73.7897],
  faridabad: [28.4089, 77.3178], meerut: [28.9845, 77.7064],
  rajkot: [22.3039, 70.8022], varanasi: [25.3176, 82.9739],
  srinagar: [34.0837, 74.7973], aurangabad: [19.8762, 75.3433],
  amritsar: [31.634, 74.8723], ranchi: [23.3441, 85.3096],
  coimbatore: [11.0168, 76.9558], jabalpur: [23.1815, 79.9864],
  vijayawada: [16.5062, 80.648], jodhpur: [26.2389, 73.0243],
  madurai: [9.9252, 78.1198], raipur: [21.2514, 81.6296],
  chandigarh: [30.7333, 76.7794], kochi: [9.9312, 76.2673],
  thiruvananthapuram: [8.5241, 76.9366], guwahati: [26.1445, 91.7362],
  mysuru: [12.2958, 76.6394], mysore: [12.2958, 76.6394],
  hubli: [15.3647, 75.124], hubballi: [15.3647, 75.124],
  salem: [11.6643, 78.146], warangal: [17.9689, 79.5941],
  tiruchirappalli: [10.7905, 78.7047], tiruppur: [11.1085, 77.3411],
  mangalore: [12.9141, 74.856], mangaluru: [12.9141, 74.856],
  solapur: [17.6805, 75.9064], gwalior: [26.2183, 78.1828],
  noida: [28.5355, 77.391], gurugram: [28.4595, 77.0266], gurgaon: [28.4595, 77.0266],
  bhubaneswar: [20.2961, 85.8245], dehradun: [30.3165, 78.0322],
  shimla: [31.1048, 77.1734], jammu: [32.7357, 74.87],
  kota: [25.2138, 75.8648], bikaner: [28.0229, 73.3119],
  tirupati: [13.6288, 79.4192], vellore: [12.9165, 79.1325],
  allahabad: [25.4358, 81.8463], prayagraj: [25.4358, 81.8463],
  udaipur: [24.5854, 73.7125], ajmer: [26.4499, 74.6399],
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  PENDING: '#f59e0b',
  SUSPENDED: '#ef4444',
  INACTIVE: '#94a3b8',
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Free',
  PROFESSIONAL: 'Pro',
  ENTERPRISE: 'Enterprise',
};

function createMarkerIcon(color: string, size = 14) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });
}

interface GymMapLeafletProps {
  gyms: any[];
}

export default function GymMapLeaflet({ gyms }: GymMapLeafletProps) {
  useEffect(() => {
    // Ensure Leaflet CSS variables are available
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    if (!document.head.querySelector('link[href*="leaflet"]')) {
      document.head.appendChild(link);
    }
  }, []);

  const mappedGyms = gyms
    .map((gym) => {
      const key = gym.city?.toLowerCase().trim();
      const coords = CITY_COORDS[key];
      if (!coords) return null;
      // Slight jitter so overlapping cities don't stack exactly
      return {
        ...gym,
        lat: coords[0] + (Math.random() - 0.5) * 0.06,
        lng: coords[1] + (Math.random() - 0.5) * 0.06,
      };
    })
    .filter(Boolean) as any[];

  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      className="gym-map-container"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <ZoomControl position="bottomright" />
      {mappedGyms.map((gym) => (
        <Marker
          key={gym.id}
          position={[gym.lat, gym.lng]}
          icon={createMarkerIcon(STATUS_COLORS[gym.status] ?? '#94a3b8', 14)}
        >
          <Popup className="gym-popup">
            <div className="gym-popup-body">
              <p className="gym-popup-title">{gym.name}</p>
              <p className="gym-popup-location">{gym.city}, {gym.state}</p>
              <div className="gym-popup-badges">
                <span
                  className="gym-popup-badge"
                  style={{ '--badge-color': STATUS_COLORS[gym.status] ?? '#94a3b8' } as React.CSSProperties}
                >{gym.status}</span>
                <span
                  className="gym-popup-badge"
                  style={{ '--badge-color': '#f97316' } as React.CSSProperties}
                >{PLAN_LABELS[gym.subscriptionPlan] ?? gym.subscriptionPlan}</span>
              </div>
              <p className="gym-popup-members">
                {gym._count?.members ?? 0} members
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
