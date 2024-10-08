import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import { instrument } from "@socket.io/admin-ui";
import User from "../models/User";
import { verify } from "jsonwebtoken";
import { promisify } from "util";

let io: SocketIO;

const verifyToken = promisify(verify);

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  if (process.env.SOCKET_ADMIN && JSON.parse(process.env.SOCKET_ADMIN)) {
    User.findByPk(1).then(
      (adminUser) => {
        if (adminUser) {
          instrument(io, {
            auth: {
              type: "basic",
              username: adminUser.email,
              password: process.env.SOCKET_ADMIN_PASSWORD // Use uma variável de ambiente para a senha
            },
            mode: "production",
          });
        }
      }
    );
  }
  
  const workspaces = io.of(/^\/\w+$/);
  workspaces.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error("Authentication error: Token required");
      }
      const decoded = await verifyToken(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  workspaces.on("connection", socket => {
    logger.info(`Client connected to namespace ${socket.nsp.name}`);

    socket.on("joinChatBox", (ticketId: string) => {
      socket.join(ticketId);
    });

    socket.on("joinNotification", () => {
      socket.join("notification");
    });

    socket.on("joinTickets", (status: string) => {
      socket.join(status);
    });

    socket.on("joinTicketsLeave", (status: string) => {
      socket.leave(status);
    });

    socket.on("joinChatBoxLeave", (ticketId: string) => {
      socket.leave(ticketId);
    });

    socket.on("disconnect", () => {
      logger.info(`Client disconnected from namespace ${socket.nsp.name}`);
    });
  });

  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};
