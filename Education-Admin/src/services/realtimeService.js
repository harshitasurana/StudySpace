import { io } from "socket.io-client";

let socket = null;
const eventHandlers = new Map();

const getSocketBaseUrl = () => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
  return baseURL.replace(/\/api\/?$/, "");
};

export const connectRealtime = () => {
  if (socket) return socket;

  socket = io(getSocketBaseUrl(), {
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
    autoConnect: true,
  });

  return socket;
};

export const disconnectRealtime = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  eventHandlers.clear();
};

export const onRealtimeEvent = (event, handler) => {
  const s = connectRealtime();
  s.on(event, handler);

  if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
  eventHandlers.get(event).add(handler);

  return () => {
    s.off(event, handler);
    eventHandlers.get(event)?.delete(handler);
  };
};

/**
 * Whether a broadcast feature-status change concerns the current admin session.
 * The backend is single-tenant now, so every change is relevant.
 */
export const isRelevantFeatureChange = () => true;
