import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/axios';
import { Navigation2, Clock, MapPin, Car, Route } from 'lucide-react';

// Custom icons
const carIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const LiveTrackingMap = () => {
    const [activeTrips, setActiveTrips] = useState([]);
    const [hiddenTrips, setHiddenTrips] = useState(new Set());
    const [loading, setLoading] = useState(true);

    const [selectedRouteVehicleId, setSelectedRouteVehicleId] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [fetchingRoute, setFetchingRoute] = useState(false);
    const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);

    // Refetch route automatically if date changes and a vehicle is selected
    useEffect(() => {
        if (selectedRouteVehicleId) {
            handleShowRoute(selectedRouteVehicleId, true);
        }
    }, [routeDate]);

    const handleShowRoute = async (vehicleId, forceRefetch = false) => {
        if (selectedRouteVehicleId === vehicleId && !forceRefetch) {
            setSelectedRouteVehicleId(null);
            setRouteCoordinates([]);
            return;
        }

        setFetchingRoute(true);
        try {
            const res = await api.get(`/vehicles/history?vehicleId=${vehicleId}&date=${routeDate}`);
            if (res.data && res.data.length > 0) {
                const coords = res.data.map(h => [h.latitude, h.longitude]);
                setRouteCoordinates(coords);
                setSelectedRouteVehicleId(vehicleId);
                // Automatically ensure this vehicle is visible
                setHiddenTrips(prev => {
                    const next = new Set(prev);
                    next.delete(`v-${vehicleId}`); // Depends on how ID is mapped
                    return next;
                });
            } else {
                alert("Belum ada riwayat rute untuk kendaraan ini hari ini.");
            }
        } catch (err) {
            console.error('Failed to fetch route history', err);
            alert("Gagal memuat rute");
        } finally {
            setFetchingRoute(false);
        }
    };

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

    const toggleVisibility = (tripId) => {
        setHiddenTrips(prev => {
            const next = new Set(prev);
            if (next.has(tripId)) next.delete(tripId);
            else next.add(tripId);
            return next;
        });
    };

    // Center map on Padang, Indonesia
    const defaultCenter = [-0.9471, 100.4172]; 
    const visibleTrips = activeTrips.filter(t => !hiddenTrips.has(t.id));

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

                {visibleTrips.map((trip) => {
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

                {routeCoordinates.length > 0 && (
                    <Polyline 
                        positions={routeCoordinates} 
                        pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }} 
                    />
                )}

                <MapBoundsFitter trips={visibleTrips} routeCoords={routeCoordinates} />
            </MapContainer>

            {/* Dashboard Overlay */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200 min-w-[280px]">
                <h4 className="font-black text-slate-800 text-sm mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Status Armada (Live)
                    </span>
                </h4>
                
                <div className="mb-3 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Tanggal Rute Historis</label>
                    <input 
                        type="date" 
                        value={routeDate}
                        onChange={(e) => setRouteDate(e.target.value)}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeTrips.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center py-4">Belum ada data lokasi kendaraan</p>
                    ) : (
                        activeTrips.map(trip => (
                            <label key={trip.id} className="block p-3 bg-white border border-slate-100 shadow-sm rounded-lg hover:border-blue-300 transition-colors cursor-pointer">
                                <div className="flex items-start gap-3">
                                    <div className="pt-0.5">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={!hiddenTrips.has(trip.id)}
                                            onChange={() => toggleVisibility(trip.id)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-xs text-slate-800 mb-1 flex items-center justify-between">
                                            {trip.vehicle?.name || 'Unknown Vehicle'}
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleShowRoute(trip.vehicle.id);
                                                }}
                                                disabled={fetchingRoute}
                                                className={`p-1 rounded transition-colors ${
                                                    selectedRouteVehicleId === trip.vehicle?.id 
                                                    ? 'bg-blue-100 text-blue-600' 
                                                    : 'text-slate-400 hover:bg-slate-100 hover:text-blue-500'
                                                }`}
                                                title="Tampilkan rute perjalanan hari ini"
                                            >
                                                {fetchingRoute && selectedRouteVehicleId === trip.vehicle?.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Route size={14} />
                                                )}
                                            </button>
                                        </p>
                                        <p className="text-[10px] text-slate-500 flex justify-between items-center">
                                            <span>{trip.driver?.name || trip.user?.name || 'Sistem'}</span>
                                            {trip.status === 'BERLANGSUNG' ? (
                                                <span className="text-emerald-600 font-bold text-[9px] px-1.5 py-0.5 bg-emerald-50 rounded">Sedang Jalan</span>
                                            ) : (
                                                <span className="text-slate-500 font-bold text-[9px] px-1.5 py-0.5 bg-slate-100 rounded">Sedang Parkir</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </label>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// Component to automatically fit map bounds to markers
const MapBoundsFitter = ({ trips, routeCoords }) => {
    const map = useMap();
    
    useEffect(() => {
        const bounds = L.latLngBounds([]);
        let hasPoints = false;

        if (trips && trips.length > 0) {
            const validTrips = trips.filter(t => t.vehicle?.currentLat && t.vehicle?.currentLng);
            validTrips.forEach(t => {
                bounds.extend([t.vehicle.currentLat, t.vehicle.currentLng]);
                hasPoints = true;
            });
        }

        if (routeCoords && routeCoords.length > 0) {
            routeCoords.forEach(coord => {
                bounds.extend(coord);
                hasPoints = true;
            });
        }
        
        if (hasPoints) {
            // Add a little padding so markers aren't at the very edge
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [trips, routeCoords, map]);

    return null;
};

export default LiveTrackingMap;
