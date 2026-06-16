import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/axios';
import { Navigation2, Clock, MapPin, Car } from 'lucide-react';

// Custom icons
const carIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const LiveTrackingMap = () => {
    const [activeTrips, setActiveTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLocations = async () => {
        try {
            const res = await api.get('/vehicles/active-tracking');
            setActiveTrips(res.data);
        } catch (err) {
            console.error('Failed to fetch active tracking', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
        // Auto refresh every 10 seconds
        const interval = setInterval(fetchLocations, 10000);
        return () => clearInterval(interval);
    }, []);

    // Center map on Padang, Indonesia
    const defaultCenter = [-0.9471, 100.4172]; 

    return (
        <div className="w-full h-[600px] bg-slate-50 relative rounded-2xl overflow-hidden shadow-inner border border-slate-200">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            )}
            
            <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {activeTrips.map((trip) => {
                    const lat = trip.vehicle?.currentLat;
                    const lng = trip.vehicle?.currentLng;
                    
                    if (!lat || !lng) return null; // Skip if no GPS data yet

                    const driverName = trip.driver?.name || trip.user?.name || 'Sistem';
                    const lastUpdate = trip.vehicle?.lastLocationUpdate ? new Date(trip.vehicle.lastLocationUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';

                    return (
                        <Marker key={trip.id} position={[lat, lng]} icon={carIcon}>
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[200px]">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b pb-2 mb-2">
                                        <Car size={16} className="text-blue-600"/> 
                                        {trip.vehicle?.name} ({trip.vehicle?.plateNumber})
                                    </h3>
                                    <div className="space-y-1.5 text-xs text-slate-600">
                                        <p className="flex items-start gap-2">
                                            <span className="bg-blue-100 p-1 rounded-md text-blue-600"><Navigation2 size={12} /></span>
                                            <span className="flex-1 mt-0.5 font-medium">Driver: {driverName}</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <span className="bg-emerald-100 p-1 rounded-md text-emerald-600"><MapPin size={12} /></span>
                                            <span className="flex-1 mt-0.5">Tujuan: {trip.destination}</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <span className="bg-amber-100 p-1 rounded-md text-amber-600"><Clock size={12} /></span>
                                            <span className="flex-1 mt-0.5 italic">Update: {lastUpdate}</span>
                                        </p>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                <MapBoundsFitter trips={activeTrips} />
            </MapContainer>

            {/* Dashboard Overlay */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200 min-w-[250px]">
                <h4 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Status Armada (Live)
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeTrips.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center py-4">Tidak ada perjalanan aktif saat ini</p>
                    ) : (
                        activeTrips.map(trip => (
                            <div key={trip.id} className="p-3 bg-white border border-slate-100 shadow-sm rounded-lg hover:border-blue-300 transition-colors cursor-default">
                                <p className="font-bold text-xs text-slate-800 mb-1">{trip.vehicle?.name || 'Unknown Vehicle'}</p>
                                <p className="text-[10px] text-slate-500 flex justify-between">
                                    <span>{trip.driver?.name || trip.user?.name || 'Sistem'}</span>
                                    {trip.vehicle?.currentLat ? (
                                        <span className="text-emerald-600 font-bold">Online</span>
                                    ) : (
                                        <span className="text-amber-500 font-bold">Menunggu GPS...</span>
                                    )}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// Component to automatically fit map bounds to markers
const MapBoundsFitter = ({ trips }) => {
    const map = useMap();
    
    useEffect(() => {
        if (!trips || trips.length === 0) return;
        
        const validTrips = trips.filter(t => t.vehicle?.currentLat && t.vehicle?.currentLng);
        if (validTrips.length === 0) return;

        const bounds = L.latLngBounds(validTrips.map(t => [t.vehicle.currentLat, t.vehicle.currentLng]));
        
        // Add a little padding so markers aren't at the very edge
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }, [trips, map]);

    return null;
};

export default LiveTrackingMap;
