import { io } from 'socket.io-client';

export const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

export const joinMap = (mapId, userId, userName) => {
  socket.emit('join-map', { mapId, userId, userName });
};

export const leaveMap = (mapId) => {
  socket.emit('leave-map', { mapId });
};

export const sendCursorPosition = (mapId, x, y) => {
  socket.emit('cursor-move', { mapId, x, y });
};
