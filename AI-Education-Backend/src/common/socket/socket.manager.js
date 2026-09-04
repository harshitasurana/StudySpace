import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { logInfo, logError } from "../utils/logger.js";

let io;

// Every notification-delivering room is named user_<id> — joining one
// means "receive this real person's private notifications" (see
// notification_service.js's createNotification, which emits into exactly
// this room). Previously this trusted whatever userId the client handed
// over in the handshake with no proof at all — dormant while nothing on
// the frontend actually connected, but the moment a real client does,
// that's an open door to join ANY other user's room by just claiming
// their id. Verifying the same JWT every REST auth check already
// verifies (auth_middleware.js's authenticate) closes it: the room
// joined is always the one the token's own subject actually owns, never
// client-asserted.
const resolveVerifiedUserId = (socket) => {
  const token = socket.handshake.auth?.token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id ?? null;
  } catch {
    return null;
  }
};

// Same allowlist app.js's own CORS middleware uses for REST routes — kept
// in sync by hand. A wildcard origin ("*") is invalid together with
// credentials: true (the CORS spec forbids pairing them, and browsers
// enforce this by rejecting the response outright), which is why every
// socket.io polling request was failing with a CORS error the moment a
// real client tried to connect with a token.
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:4200', 'http://localhost:3000'];

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true
    },
  });

  io.on("connection", (socket) => {
    logInfo("Socket User connected:", { socketId: socket.id });

    const userId = resolveVerifiedUserId(socket);

    if (userId) {
      socket.join(`user_${userId}`);
      logInfo(`User ${userId} joined room user_${userId}`);
    } else {
      logInfo("Socket connected without a valid token — no private room joined", { socketId: socket.id });
    }

    socket.on("disconnect", () => {
      logInfo("Socket User disconnected:", { socketId: socket.id });
    });
  });
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
