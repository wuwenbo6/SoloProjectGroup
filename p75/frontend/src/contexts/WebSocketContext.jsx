import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const reconnectAttemptRef = useRef(0);
  const messageHandlersRef = useRef(new Map());
  const lastMessageTimeRef = useRef(0);
  const messageBufferRef = useRef([]);
  const flushTimerRef = useRef(null);

  const subscribe = useCallback((type, handler) => {
    if (!messageHandlersRef.current.has(type)) {
      messageHandlersRef.current.set(type, new Set());
    }
    messageHandlersRef.current.get(type).add(handler);
    return () => {
      messageHandlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const flushBuffer = useCallback(() => {
    if (messageBufferRef.current.length === 0) return;
    
    const buffer = [...messageBufferRef.current];
    messageBufferRef.current = [];
    
    const groupedByType = new Map();
    buffer.forEach(msg => {
      if (!groupedByType.has(msg.type)) {
        groupedByType.set(msg.type, []);
      }
      groupedByType.get(msg.type).push(msg);
    });
    
    groupedByType.forEach((messages, type) => {
      const handlers = messageHandlersRef.current.get(type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(messages);
          } catch (e) {
            console.error('Handler error:', e);
          }
        });
      }
    });
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8000/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      reconnectAttemptRef.current = 0;
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const now = Date.now();
        
        messageBufferRef.current.push(data);
        
        if (now - lastMessageTimeRef.current > 50) {
          lastMessageTimeRef.current = now;
          if (flushTimerRef.current) {
            cancelAnimationFrame(flushTimerRef.current);
          }
          flushTimerRef.current = requestAnimationFrame(flushBuffer);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('WebSocket disconnected');
      
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000);
      reconnectAttemptRef.current += 1;
      
      setTimeout(connect, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setSocket(ws);
  }, [flushBuffer]);

  useEffect(() => {
    connect();
    return () => {
      if (socket) {
        socket.close();
      }
      if (flushTimerRef.current) {
        cancelAnimationFrame(flushTimerRef.current);
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }, [socket]);

  const contextValue = useMemo(() => ({
    wsConnected,
    sendMessage,
    subscribe,
  }), [wsConnected, sendMessage, subscribe]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);