import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useAuthStore } from '../store/authStore';

interface Collaborator {
  userId: string;
  username: string;
  role: string;
  cursor: { x: number; y: number };
  isDrawing: boolean;
}

interface DrawEvent {
  userId: string;
  x: number;
  y: number;
}

interface PathEvent {
  userId: string;
  pathId: string;
  pathData: any;
}

interface MessageEvent {
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  currentSessionId: string | null;
  collaborators: Collaborator[];
  messages: MessageEvent[];
  connect: () => void;
  disconnect: () => void;
  joinSession: (sessionId: string, sessionName: string, materialId?: string) => void;
  leaveSession: (sessionId: string) => void;
  sendCursorMove: (sessionId: string, x: number, y: number) => void;
  sendDrawStart: (sessionId: string, x: number, y: number, tool: string) => void;
  sendDrawMove: (sessionId: string, x: number, y: number) => void;
  sendDrawEnd: (sessionId: string, pathData: any) => void;
  sendPathUpdate: (sessionId: string, pathId: string, pathData: any) => void;
  sendPathDelete: (sessionId: string, pathId: string) => void;
  sendUndo: (sessionId: string) => void;
  sendRedo: (sessionId: string) => void;
  sendMessage: (sessionId: string, message: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  currentSessionId: null,
  collaborators: [],
  messages: [],

  connect: () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      console.error('No token found for socket connection');
      return;
    }

    const socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ isConnected: false, currentSessionId: null, collaborators: [] });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      set({ isConnected: false });
    });

    socket.on('session_joined', (data) => {
      console.log('Joined session:', data);
      set({
        currentSessionId: data.sessionId,
        collaborators: data.users || [],
      });
    });

    socket.on('user_joined', (data) => {
      console.log('User joined:', data);
      set((state) => ({
        collaborators: data.users || state.collaborators,
      }));
    });

    socket.on('user_left', (data) => {
      console.log('User left:', data);
      set((state) => ({
        collaborators: state.collaborators.filter((c) => c.userId !== data.userId),
      }));
    });

    socket.on('cursor_moved', (data) => {
      set((state) => ({
        collaborators: state.collaborators.map((c) =>
          c.userId === data.userId
            ? { ...c, cursor: { x: data.x, y: data.y } }
            : c
        ),
      }));
    });

    socket.on('message_received', (data) => {
      set((state) => ({
        messages: [...state.messages, data],
      }));
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket, currentSessionId } = get();
    if (currentSessionId) {
      get().leaveSession(currentSessionId);
    }
    socket?.disconnect();
    set({ socket: null, isConnected: false, currentSessionId: null, collaborators: [] });
  },

  joinSession: (sessionId: string, sessionName: string, materialId?: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('join_session', { sessionId, sessionName, materialId });
    }
  },

  leaveSession: (sessionId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('leave_session', { sessionId });
      set({ currentSessionId: null, collaborators: [] });
    }
  },

  sendCursorMove: (sessionId: string, x: number, y: number) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('cursor_move', { sessionId, x, y });
    }
  },

  sendDrawStart: (sessionId: string, x: number, y: number, tool: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('draw_start', { sessionId, x, y, tool });
    }
  },

  sendDrawMove: (sessionId: string, x: number, y: number) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('draw_move', { sessionId, x, y });
    }
  },

  sendDrawEnd: (sessionId: string, pathData: any) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('draw_end', { sessionId, pathData });
    }
  },

  sendPathUpdate: (sessionId: string, pathId: string, pathData: any) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('path_update', { sessionId, pathId, pathData });
    }
  },

  sendPathDelete: (sessionId: string, pathId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('path_delete', { sessionId, pathId });
    }
  },

  sendUndo: (sessionId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('undo', { sessionId });
    }
  },

  sendRedo: (sessionId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('redo', { sessionId });
    }
  },

  sendMessage: (sessionId: string, message: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('send_message', { sessionId, message });
    }
  },
}));
