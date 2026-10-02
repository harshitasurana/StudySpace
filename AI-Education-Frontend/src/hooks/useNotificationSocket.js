import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import apiClient, { tokenStore } from '../services/apiClient';

/**
 * Live delivery for the notification bell — the backend already emits a
 * real socket.io event (`io.to('user_<id>').emit('notification', ...)`,
 * see notification_service.js's createNotification) every time a
 * notification is created, but nothing on the frontend ever listened for
 * it; the bell only ever showed whatever was there on page load. This is
 * that missing listener.
 *
 * Auth: the socket handshake sends the same short-lived access token
 * every REST call already carries (see socket.manager.js — it verifies
 * this exact token server-side and joins the room for the token's own
 * subject, never a client-asserted id). If there's no token yet (not
 * logged in), this simply doesn't connect — Topbar only renders once
 * authenticated, so in practice a token is already set by the time this
 * mounts.
 *
 * `onNotification` fires once per real event with the raw payload
 * notification_service.js emits: { id, user_notification_id, type,
 * title, message, channel, ... }. The caller owns turning that into
 * whatever shape it renders (see Topbar.jsx).
 */
const useNotificationSocket = (onNotification) => {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return undefined;

    const socket = io(apiClient.defaults.baseURL, {
      auth: { token },
      withCredentials: true,
    });

    socket.on('notification', (payload) => {
      callbackRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
};

export default useNotificationSocket;
