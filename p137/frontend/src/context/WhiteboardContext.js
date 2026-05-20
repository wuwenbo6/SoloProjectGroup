import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { fabric } from 'fabric';

const WhiteboardContext = createContext();

export const useWhiteboard = () => useContext(WhiteboardContext);

const MAX_HISTORY_SIZE = 100;
const HISTORY_TRIM_THRESHOLD = 150;

class VectorClock {
  constructor() {
    this.clock = {};
  }

  increment(userId) {
    this.clock[userId] = (this.clock[userId] || 0) + 1;
    return { ...this.clock };
  }

  merge(otherClock) {
    for (const userId in otherClock) {
      this.clock[userId] = Math.max(this.clock[userId] || 0, otherClock[userId]);
    }
    return { ...this.clock };
  }

  compare(otherClock) {
    let thisGreater = false;
    let otherGreater = false;
    
    const allKeys = new Set([...Object.keys(this.clock), ...Object.keys(otherClock)]);
    
    for (const key of allKeys) {
      const thisVal = this.clock[key] || 0;
      const otherVal = otherClock[key] || 0;
      
      if (thisVal > otherVal) thisGreater = true;
      if (otherVal > thisVal) otherGreater = true;
    }
    
    if (thisGreater && !otherGreater) return 1;
    if (otherGreater && !thisGreater) return -1;
    if (!thisGreater && !otherGreater) return 0;
    return 2; // concurrent
  }

  clone() {
    const vc = new VectorClock();
    vc.clock = { ...this.clock };
    return vc;
  }

  toJSON() {
    return { ...this.clock };
  }

  static fromJSON(json) {
    const vc = new VectorClock();
    vc.clock = { ...json };
    return vc;
  }
}

class ObjectState {
  constructor(objectId) {
    this.objectId = objectId;
    this.version = 0;
    this.lockOwner = null;
    this.lockExpiry = 0;
    this.lastModifier = null;
    this.vectorClock = new VectorClock();
  }

  tryLock(userId, timeout = 500) {
    const now = Date.now();
    if (!this.lockOwner || now > this.lockExpiry) {
      this.lockOwner = userId;
      this.lockExpiry = now + timeout;
      return true;
    }
    return this.lockOwner === userId;
  }

  releaseLock(userId) {
    if (this.lockOwner === userId) {
      this.lockOwner = null;
      this.lockExpiry = 0;
      return true;
    }
    return false;
  }
}

export const WhiteboardProvider = ({ children, roomId, userName }) => {
  const socketRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [currentTool, setCurrentTool] = useState('select');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [canvas, setCanvas] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());

  const userId = useRef(uuidv4()).current;
  const dataChannelsRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const audioElementsRef = useRef({});
  
  const vectorClockRef = useRef(new VectorClock());
  const objectStatesRef = useRef(new Map());
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const pendingOpsRef = useRef(new Map());
  const snapshotRef = useRef(null);

  useEffect(() => {
    const socket = io('http://localhost:3001', {
      query: { roomId, userId, userName }
    });
    socketRef.current = socket;

    socket.on('users', (userList) => {
      setUsers(userList);
    });

    socket.on('offer', async ({ from, offer }) => {
      try {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      try {
        const pc = peerConnectionsRef.current[from];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      try {
        const pc = peerConnectionsRef.current[from];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    socket.on('user-joined', ({ userId: newUserId, userName: newUserName }) => {
      if (newUserId !== userId) {
        initiateConnection(newUserId, true);
      }
    });

    socket.on('user-left', ({ userId: leftUserId }) => {
      if (peerConnectionsRef.current[leftUserId]) {
        peerConnectionsRef.current[leftUserId].close();
        delete peerConnectionsRef.current[leftUserId];
      }
      if (dataChannelsRef.current[leftUserId]) {
        delete dataChannelsRef.current[leftUserId];
      }
      if (audioElementsRef.current[leftUserId]) {
        audioElementsRef.current[leftUserId].remove();
        delete audioElementsRef.current[leftUserId];
      }
      setUsers(prev => prev.filter(u => u.userId !== leftUserId));
    });

    socket.on('existing-users', (existingUsers) => {
      existingUsers.forEach(user => {
        if (user.userId !== userId) {
          initiateConnection(user.userId, false);
        }
      });
    });

    return () => {
      Object.values(peerConnectionsRef.current).forEach(pc => {
        pc.close();
      });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(audioElementsRef.current).forEach(el => el.remove());
      socket.disconnect();
    };
  }, [roomId, userId, userName]);

  const createPeerConnection = (peerId) => {
    if (peerConnectionsRef.current[peerId]) {
      return peerConnectionsRef.current[peerId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    peerConnectionsRef.current[peerId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit('ice-candidate', {
          to: peerId,
          candidate: e.candidate
        });
      }
    };

    pc.ondatachannel = (e) => {
      const channel = e.channel;
      setupDataChannel(channel, peerId);
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (!audioElementsRef.current[peerId]) {
        const audioEl = document.createElement('audio');
        audioEl.id = `audio-${peerId}`;
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        audioElementsRef.current[peerId] = audioEl;
      }
      audioElementsRef.current[peerId].srcObject = stream;
    };

    return pc;
  };

  const initiateConnection = async (peerId, isOffer) => {
    const pc = createPeerConnection(peerId);
    const channel = pc.createDataChannel('whiteboard', {
      ordered: true,
      maxRetransmits: 3
    });
    setupDataChannel(channel, peerId);
    dataChannelsRef.current[peerId] = channel;

    if (isOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('offer', { to: peerId, offer });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    }
  };

  const setupDataChannel = (channel, peerId) => {
    channel.onopen = () => {
      console.log('Data channel opened with', peerId);
      if (snapshotRef.current) {
        channel.send(JSON.stringify({
          type: 'snapshot',
          snapshot: snapshotRef.current
        }));
      }
    };

    channel.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        handleRemoteMessage(message, peerId);
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };

    if (!dataChannelsRef.current[peerId]) {
      dataChannelsRef.current[peerId] = {};
    }
    dataChannelsRef.current[peerId] = channel;
  };

  const toggleAudio = async () => {
    try {
      if (!isAudioEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        });
        
        setIsAudioEnabled(true);
        setIsMuted(false);
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }
        setIsAudioEnabled(false);
        setIsMuted(false);
      }
    } catch (err) {
      console.error('Error toggling audio:', err);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const transformOperation = (newOp, existingOp) => {
    if (newOp.objectId !== existingOp.objectId) return newOp;

    const vc1 = VectorClock.fromJSON(newOp.vectorClock);
    const vc2 = VectorClock.fromJSON(existingOp.vectorClock);
    const comparison = vc1.compare(vc2.clock);

    if (comparison <= 0) return newOp;

    if (newOp.type === 'modify' && existingOp.type === 'modify') {
      const newProps = { ...newOp.data.props };
      const existingProps = existingOp.data.props;

      for (const prop in existingProps) {
        if (existingOp.timestamp > newOp.timestamp) {
          newProps[prop] = existingProps[prop];
        }
      }

      return {
        ...newOp,
        data: { ...newOp.data, props: newProps }
      };
    }

    return newOp;
  };

  const applyOperationToCanvas = async (operation) => {
    if (!canvas) return false;

    const { type, data, objectId } = operation;

    try {
      switch (type) {
        case 'add': {
          const fabricObjects = await new Promise((resolve) => {
            fabric.util.enlivenObjects([data.object], (objects) => {
              resolve(objects);
            });
          });
          
          if (fabricObjects && fabricObjects.length > 0) {
            const obj = fabricObjects[0];
            obj.set({ id: objectId, selectable: true });
            canvas.add(obj);
            canvas.renderAll();
          }
          break;
        }
        case 'modify': {
          const objects = canvas.getObjects();
          const obj = objects.find(o => o.id === objectId);
          if (obj && data.props) {
            obj.set(data.props);
            obj.setCoords();
            canvas.renderAll();
          }
          break;
        }
        case 'remove': {
          const objects = canvas.getObjects();
          const obj = objects.find(o => o.id === objectId);
          if (obj) {
            canvas.remove(obj);
            canvas.renderAll();
          }
          break;
        }
      }
      return true;
    } catch (err) {
      console.error('Error applying operation to canvas:', err);
      return false;
    }
  };

  const createInverseOperation = (operation) => {
    const { type, data, objectId } = operation;
    
    switch (type) {
      case 'add':
        return {
          ...operation,
          type: 'remove',
          data: { objectId },
          isUndo: true
        };
      case 'remove':
        return {
          ...operation,
          type: 'add',
          data: { object: data.originalObject },
          isUndo: true
        };
      case 'modify':
        return {
          ...operation,
          type: 'modify',
          data: { props: data.oldProps },
          isUndo: true
        };
      default:
        return null;
    }
  };

  const addToHistory = (operation, inverseOp) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    
    historyRef.current.push({
      operation,
      inverseOp,
      vectorClock: vectorClockRef.current.toJSON()
    });
    
    historyIndexRef.current++;

    if (historyRef.current.length > HISTORY_TRIM_THRESHOLD) {
      const removeCount = historyRef.current.length - MAX_HISTORY_SIZE;
      historyRef.current = historyRef.current.slice(removeCount);
      historyIndexRef.current -= removeCount;
      
      if (canvas) {
        createSnapshot();
      }
    }
  };

  const createSnapshot = () => {
    if (!canvas) return;
    
    const objects = canvas.getObjects().map(obj => obj.toObject());
    snapshotRef.current = {
      objects,
      vectorClock: vectorClockRef.current.toJSON(),
      timestamp: Date.now()
    };
  };

  const handleRemoteMessage = (message, fromPeerId) => {
    switch (message.type) {
      case 'operation':
        handleRemoteOperation(message.operation);
        break;
      case 'cursor':
        updateRemoteCursor(fromPeerId, message.x, message.y);
        break;
      case 'undo':
        handleRemoteUndo(message);
        break;
      case 'redo':
        handleRemoteRedo(message);
        break;
      case 'snapshot':
        handleSnapshot(message.snapshot, fromPeerId);
        break;
    }
  };

  const handleRemoteOperation = async (operation) => {
    const opVC = VectorClock.fromJSON(operation.vectorClock);
    
    for (let i = historyRef.current.length - 1; i >= 0; i--) {
      const historyOp = historyRef.current[i].operation;
      operation = transformOperation(operation, historyOp);
    }

    const objectState = getOrCreateObjectState(operation.objectId);
    
    if (!objectState.tryLock(operation.userId)) {
      pendingOpsRef.current.set(operation.id, operation);
      return;
    }

    const comparison = opVC.compare(objectState.vectorClock.clock);
    
    if (comparison >= 0) {
      const success = await applyOperationToCanvas(operation);
      if (success) {
        objectState.vectorClock.merge(opVC.clock);
        objectState.version++;
        objectState.lastModifier = operation.userId;
        objectState.releaseLock(operation.userId);
        
        vectorClockRef.current.merge(opVC.clock);
        
        if (!operation.isUndo) {
          const inverseOp = createInverseOperation(operation);
          addToHistory(operation, inverseOp);
        }

        processPendingOps(operation.objectId);
      }
    } else {
      objectState.releaseLock(operation.userId);
    }
  };

  const processPendingOps = async (objectId) => {
    for (const [opId, op] of pendingOpsRef.current) {
      if (op.objectId === objectId) {
        pendingOpsRef.current.delete(opId);
        await handleRemoteOperation(op);
      }
    }
  };

  const getOrCreateObjectState = (objectId) => {
    if (!objectStatesRef.current.has(objectId)) {
      objectStatesRef.current.set(objectId, new ObjectState(objectId));
    }
    return objectStatesRef.current.get(objectId);
  };

  const broadcastMessage = (message) => {
    Object.values(dataChannelsRef.current).forEach((channel) => {
      if (channel && channel.readyState === 'open') {
        try {
          channel.send(JSON.stringify(message));
        } catch (err) {
          console.error('Error broadcasting message:', err);
        }
      }
    });
  };

  const applyOperation = async (operationData, isLocal = true) => {
    if (!canvas) return;

    const { type, data, objectId } = operationData;
    
    const newVC = vectorClockRef.current.increment(userId);
    const objectState = getOrCreateObjectState(objectId);

    if (!objectState.tryLock(userId)) {
      console.warn('Object locked, operation queued');
      return false;
    }

    const operation = {
      id: uuidv4(),
      type,
      data,
      objectId,
      userId,
      vectorClock: newVC,
      timestamp: Date.now()
    };

    let inverseOp = null;
    if (type === 'modify') {
      const objects = canvas.getObjects();
      const obj = objects.find(o => o.id === objectId);
      if (obj) {
        const oldProps = {};
        for (const prop in data.props) {
          oldProps[prop] = obj.get(prop);
        }
        inverseOp = {
          ...operation,
          type: 'modify',
          data: { props: oldProps },
          isUndo: true
        };
      }
    } else if (type === 'add') {
      inverseOp = {
        ...operation,
        type: 'remove',
        data: { objectId },
        isUndo: true
      };
    } else if (type === 'remove') {
      const objects = canvas.getObjects();
      const obj = objects.find(o => o.id === objectId);
      if (obj) {
        inverseOp = {
          ...operation,
          type: 'add',
          data: { object: obj.toObject() },
          isUndo: true
        };
      }
    }

    const success = await applyOperationToCanvas(operation);
    
    if (success) {
      objectState.vectorClock.increment(userId);
      objectState.version++;
      objectState.lastModifier = userId;
      objectState.releaseLock(userId);

      if (isLocal && !operationData.isUndo) {
        addToHistory(operation, inverseOp);
      }

      if (isRecording && isLocal) {
        setRecordedActions(prev => [...prev, { ...operation, timestamp: Date.now() }]);
      }

      if (isLocal) {
        broadcastMessage({ type: 'operation', operation });
      }
    }

    return success;
  };

  const undo = () => {
    if (historyIndexRef.current < 0 || !canvas) return;

    const { operation, inverseOp } = historyRef.current[historyIndexRef.current];
    
    if (inverseOp) {
      applyOperationToCanvas(inverseOp);
      
      vectorClockRef.current.increment(userId);
      
      broadcastMessage({
        type: 'undo',
        operationId: operation.id,
        inverseOp,
        vectorClock: vectorClockRef.current.toJSON(),
        userId
      });
    }

    historyIndexRef.current--;
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !canvas) return;

    historyIndexRef.current++;
    const { operation } = historyRef.current[historyIndexRef.current];
    
    applyOperationToCanvas(operation);
    
    vectorClockRef.current.increment(userId);
    
    broadcastMessage({
      type: 'redo',
      operationId: operation.id,
      operation,
      vectorClock: vectorClockRef.current.toJSON(),
      userId
    });
  };

  const handleRemoteUndo = async (message) => {
    const { inverseOp, userId: fromUserId } = message;
    
    if (fromUserId === userId) return;

    const opIndex = historyRef.current.findIndex(
      h => h.operation.id === message.operationId
    );

    if (opIndex >= 0) {
      historyIndexRef.current = opIndex - 1;
    }

    if (inverseOp) {
      await applyOperationToCanvas(inverseOp);
      vectorClockRef.current.merge(message.vectorClock);
    }
  };

  const handleRemoteRedo = async (message) => {
    const { operation, userId: fromUserId } = message;
    
    if (fromUserId === userId) return;

    const opIndex = historyRef.current.findIndex(
      h => h.operation.id === message.operationId
    );

    if (opIndex >= 0) {
      historyIndexRef.current = opIndex;
    }

    if (operation) {
      await applyOperationToCanvas(operation);
      vectorClockRef.current.merge(message.vectorClock);
    }
  };

  const handleSnapshot = async (snapshot) => {
    if (!canvas) return;
    
    const currentObjects = canvas.getObjects();
    if (currentObjects.length > 0) return;

    const { objects, vectorClock } = snapshot;
    
    for (const objData of objects) {
      await new Promise((resolve) => {
        fabric.util.enlivenObjects([objData], (fabricObjects) => {
          if (fabricObjects && fabricObjects.length > 0) {
            const obj = fabricObjects[0];
            obj.set({ id: objData.id, selectable: true });
            canvas.add(obj);
          }
          resolve();
        });
      });
    }
    
    vectorClockRef.current = VectorClock.fromJSON(vectorClock);
    canvas.renderAll();
  };

  const updateRemoteCursor = (peerId, x, y) => {
    const cursorEl = document.getElementById(`cursor-${peerId}`);
    if (cursorEl) {
      cursorEl.style.left = `${x}px`;
      cursorEl.style.top = `${y}px`;
    }
  };

  const sendCursorPosition = useCallback((x, y) => {
    broadcastMessage({ type: 'cursor', x, y, userId });
  }, [userId]);

  const startRecording = () => {
    setIsRecording(true);
    setRecordedActions([]);
    createSnapshot();
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const playRecording = async () => {
    if (!canvas || recordedActions.length === 0) return;
    
    canvas.clear();
    setIsPlaying(true);
    
    for (let i = 0; i < recordedActions.length; i++) {
      const action = recordedActions[i];
      await applyOperationToCanvas(action);
      
      if (i < recordedActions.length - 1) {
        const delay = recordedActions[i + 1].timestamp - action.timestamp;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setIsPlaying(false);
  };

  const exportSVG = () => {
    if (!canvas) return;
    
    const svgData = canvas.toSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${Date.now()}.svg`;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!canvas) return;
    
    try {
      const { jsPDF } = await import('jspdf');
      
      const canvasEl = canvas.getElement();
      const imgData = canvasEl.toDataURL('image/png');
      
      const pdfWidth = canvas.width;
      const pdfHeight = canvas.height;
      
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`whiteboard-${Date.now()}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('导出PDF失败，请先安装 jspdf 依赖: npm install jspdf');
    }
  };

  const applyTemplate = async (templateObjects) => {
    if (!canvas) return;
    
    canvas.clear();
    historyRef.current = [];
    historyIndexRef.current = -1;
    
    for (const objData of templateObjects) {
      const objectId = objData.id || uuidv4();
      await applyOperationToCanvas({
        type: 'add',
        data: { object: { ...objData, id: objectId } },
        objectId
      });
    }
    
    createSnapshot();
  };

  return (
    <WhiteboardContext.Provider value={{
      users,
      currentTool,
      setCurrentTool,
      currentColor,
      setCurrentColor,
      brushSize,
      setBrushSize,
      canvas,
      setCanvas,
      applyOperation,
      undo,
      redo,
      sendCursorPosition,
      userId,
      userName,
      isRecording,
      startRecording,
      stopRecording,
      playRecording,
      isPlaying,
      vectorClock: vectorClockRef.current,
      isAudioEnabled,
      isMuted,
      toggleAudio,
      toggleMute,
      speakingUsers,
      exportSVG,
      exportPDF,
      applyTemplate
    }}>
      {children}
    </WhiteboardContext.Provider>
  );
};
