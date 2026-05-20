import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import logger from '../utils/logger';
import prisma from '../config/database';

interface UserInfo {
  userId: string;
  username: string;
  role: string;
}

interface SessionUser extends UserInfo {
  cursor: { x: number; y: number };
  isDrawing: boolean;
  lastActive: Date;
}

interface CollabSession {
  id: string;
  name: string;
  materialId?: string;
  users: Map<string, SessionUser>;
  createdAt: Date;
}

export class SocketService {
  private io: Server;
  private sessions: Map<string, CollabSession> = new Map();
  private userSocketMap: Map<string, string> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.initializeMiddleware();
    this.initializeEventHandlers();
  }

  private initializeMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('未提供认证令牌'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as any;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, username: true, role: true },
        });

        if (!user) {
          return next(new Error('用户不存在'));
        }

        (socket as any).user = user;
        this.userSocketMap.set(user.id, socket.id);
        next();
      } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('认证失败'));
      }
    });
  }

  private initializeEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user as UserInfo;
      logger.info(`User connected: ${user.username} (${user.userId})`);

      socket.on('join_session', async (data: { sessionId: string; sessionName: string; materialId?: string }) => {
        await this.handleJoinSession(socket, user, data);
      });

      socket.on('leave_session', (data: { sessionId: string }) => {
        this.handleLeaveSession(socket, user, data.sessionId);
      });

      socket.on('cursor_move', (data: { sessionId: string; x: number; y: number }) => {
        this.handleCursorMove(socket, user, data);
      });

      socket.on('draw_start', (data: { sessionId: string; x: number; y: number; tool: string }) => {
        this.handleDrawStart(socket, user, data);
      });

      socket.on('draw_move', (data: { sessionId: string; x: number; y: number }) => {
        this.handleDrawMove(socket, user, data);
      });

      socket.on('draw_end', (data: { sessionId: string; pathData: any }) => {
        this.handleDrawEnd(socket, user, data);
      });

      socket.on('path_update', (data: { sessionId: string; pathId: string; pathData: any }) => {
        this.handlePathUpdate(socket, user, data);
      });

      socket.on('path_delete', (data: { sessionId: string; pathId: string }) => {
        this.handlePathDelete(socket, user, data);
      });

      socket.on('undo', (data: { sessionId: string }) => {
        this.handleUndo(socket, user, data);
      });

      socket.on('redo', (data: { sessionId: string }) => {
        this.handleRedo(socket, user, data);
      });

      socket.on('send_message', (data: { sessionId: string; message: string }) => {
        this.handleSendMessage(socket, user, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket, user);
      });
    });
  }

  private async handleJoinSession(socket: Socket, user: UserInfo, data: { sessionId: string; sessionName: string; materialId?: string }) {
    const { sessionId, sessionName, materialId } = data;
    
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        name: sessionName,
        materialId,
        users: new Map(),
        createdAt: new Date(),
      };
      this.sessions.set(sessionId, session);
    }

    const sessionUser: SessionUser = {
      ...user,
      cursor: { x: 0, y: 0 },
      isDrawing: false,
      lastActive: new Date(),
    };

    session.users.set(user.userId, sessionUser);
    socket.join(sessionId);

    const userList = Array.from(session.users.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      role: u.role,
      cursor: u.cursor,
      isDrawing: u.isDrawing,
    }));

    socket.to(sessionId).emit('user_joined', {
      user: { userId: user.userId, username: user.username, role: user.role },
      users: userList,
    });

    socket.emit('session_joined', {
      sessionId,
      users: userList,
    });

    logger.info(`User ${user.username} joined session ${sessionId}`);
  }

  private handleLeaveSession(socket: Socket, user: UserInfo, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.users.delete(user.userId);
      socket.leave(sessionId);

      socket.to(sessionId).emit('user_left', {
        userId: user.userId,
        username: user.username,
      });

      if (session.users.size === 0) {
        this.sessions.delete(sessionId);
        logger.info(`Session ${sessionId} closed - no users remaining`);
      }

      logger.info(`User ${user.username} left session ${sessionId}`);
    }
  }

  private handleCursorMove(socket: Socket, user: UserInfo, data: { sessionId: string; x: number; y: number }) {
    const { sessionId, x, y } = data;
    const session = this.sessions.get(sessionId);
    
    if (session && session.users.has(user.userId)) {
      const sessionUser = session.users.get(user.userId)!;
      sessionUser.cursor = { x, y };
      sessionUser.lastActive = new Date();

      socket.to(sessionId).emit('cursor_moved', {
        userId: user.userId,
        username: user.username,
        x,
        y,
      });
    }
  }

  private handleDrawStart(socket: Socket, user: UserInfo, data: { sessionId: string; x: number; y: number; tool: string }) {
    const { sessionId, x, y, tool } = data;
    const session = this.sessions.get(sessionId);
    
    if (session && session.users.has(user.userId)) {
      const sessionUser = session.users.get(user.userId)!;
      sessionUser.isDrawing = true;
      sessionUser.lastActive = new Date();

      socket.to(sessionId).emit('peer_draw_start', {
        userId: user.userId,
        username: user.username,
        x,
        y,
        tool,
      });
    }
  }

  private handleDrawMove(socket: Socket, user: UserInfo, data: { sessionId: string; x: number; y: number }) {
    const { sessionId, x, y } = data;
    const session = this.sessions.get(sessionId);
    
    if (session && session.users.has(user.userId)) {
      const sessionUser = session.users.get(user.userId)!;
      sessionUser.cursor = { x, y };
      sessionUser.lastActive = new Date();

      socket.to(sessionId).emit('peer_draw_move', {
        userId: user.userId,
        x,
        y,
      });
    }
  }

  private handleDrawEnd(socket: Socket, user: UserInfo, data: { sessionId: string; pathData: any }) {
    const { sessionId, pathData } = data;
    const session = this.sessions.get(sessionId);
    
    if (session && session.users.has(user.userId)) {
      const sessionUser = session.users.get(user.userId)!;
      sessionUser.isDrawing = false;
      sessionUser.lastActive = new Date();

      socket.to(sessionId).emit('peer_draw_end', {
        userId: user.userId,
        pathData,
      });
    }
  }

  private handlePathUpdate(socket: Socket, user: UserInfo, data: { sessionId: string; pathId: string; pathData: any }) {
    const { sessionId, pathId, pathData } = data;
    
    socket.to(sessionId).emit('peer_path_update', {
      userId: user.userId,
      pathId,
      pathData,
    });
  }

  private handlePathDelete(socket: Socket, user: UserInfo, data: { sessionId: string; pathId: string }) {
    const { sessionId, pathId } = data;
    
    socket.to(sessionId).emit('peer_path_delete', {
      userId: user.userId,
      pathId,
    });
  }

  private handleUndo(socket: Socket, user: UserInfo, data: { sessionId: string }) {
    const { sessionId } = data;
    
    socket.to(sessionId).emit('peer_undo', {
      userId: user.userId,
    });
  }

  private handleRedo(socket: Socket, user: UserInfo, data: { sessionId: string }) {
    const { sessionId } = data;
    
    socket.to(sessionId).emit('peer_redo', {
      userId: user.userId,
    });
  }

  private handleSendMessage(socket: Socket, user: UserInfo, data: { sessionId: string; message: string }) {
    const { sessionId, message } = data;
    
    this.io.to(sessionId).emit('message_received', {
      userId: user.userId,
      username: user.username,
      message,
      timestamp: new Date(),
    });
  }

  private handleDisconnect(socket: Socket, user: UserInfo) {
    this.userSocketMap.delete(user.userId);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.users.has(user.userId)) {
        session.users.delete(user.userId);
        
        socket.to(sessionId).emit('user_left', {
          userId: user.userId,
          username: user.username,
        });

        if (session.users.size === 0) {
          this.sessions.delete(sessionId);
        }
      }
    }

    logger.info(`User disconnected: ${user.username} (${user.userId})`);
  }

  public getIO(): Server {
    return this.io;
  }

  public getSession(sessionId: string): CollabSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): CollabSession[] {
    return Array.from(this.sessions.values());
  }
}
