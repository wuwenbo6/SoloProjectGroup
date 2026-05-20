import { useEffect, useRef, useState, useCallback } from 'react';
import type { DetectionRecord, AlertRecord } from '../types';

interface WebSocketMessage {
  type: string;
  data: DetectionRecord | AlertRecord | any;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const isProcessingRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [latestDetection, setLatestDetection] = useState<DetectionRecord | null>(null);
  const [latestAlert, setLatestAlert] = useState<AlertRecord | null>(null);

  const processMessageQueue = useCallback(() => {
    if (isProcessingRef.current || messageQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const batch = messageQueueRef.current.splice(0, 10);
    
    setMessages((prev) => [...prev.slice(-50), ...batch]);
    
    batch.forEach((msg) => {
      if (msg.type === 'new_detection') {
        setLatestDetection(msg.data as DetectionRecord);
      } else if (msg.type === 'new_alert') {
        setLatestAlert(msg.data as AlertRecord);
      }
    });
    
    isProcessingRef.current = false;
    
    if (messageQueueRef.current.length > 0) {
      requestAnimationFrame(processMessageQueue);
    }
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      setIsConnected(true);
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        
        if (msg.type === 'pong') {
          return;
        }
        
        messageQueueRef.current.push(msg);
        requestAnimationFrame(processMessageQueue);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected, code:', event.code, 'reason:', event.reason);
      setIsConnected(false);
      
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      if (!event.wasClean) {
        const delay = Math.min(1000 * Math.pow(2, messageQueueRef.current.length), 10000);
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
    };

    wsRef.current = ws;
  }, [processMessageQueue]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    messages,
    latestDetection,
    latestAlert,
  };
}
