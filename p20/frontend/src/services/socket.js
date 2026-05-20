import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    this.socket = io('http://localhost:3000', {
      auth: { token }
    });
    return this.socket;
  }

  connectAndWait(token) {
    return new Promise((resolve, reject) => {
      this.socket = io('http://localhost:3000', {
        auth: { token }
      });

      this.socket.on('connect', () => {
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        reject(error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new SocketService();
