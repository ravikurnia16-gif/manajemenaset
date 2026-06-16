import { io } from 'socket.io-client';

// Construct the WebSocket URL based on the current environment.
// If the app is in production (e.g. deployed), it usually runs on the same origin.
// In development with Vite, backend is typically on port 3000.
const SOCKET_URL = import.meta.env.PROD 
    ? window.location.origin 
    : 'http://localhost:3000';

const socket = io(SOCKET_URL, {
    autoConnect: true,
});

export default socket;
