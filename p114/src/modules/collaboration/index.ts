import type { User, CollaborationSession, CollaborationAction, Skeleton, Point } from '../../types';
import { SkeletonEditor } from '../skeletonEditor';

type ActionCallback = (action: CollaborationAction, senderId: string) => void;
type UserCallback = (user: User) => void;

export class CollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map();
  private currentSessionId: string | null = null;
  private localUser: User;
  private skeletonEditor: SkeletonEditor;
  private actionCallbacks: Set<ActionCallback> = new Set();
  private userJoinCallbacks: Set<UserCallback> = new Set();
  private userLeaveCallbacks: Set<UserCallback> = new Set();
  private maxHistoryLength: number = 100;

  constructor(userId: string, userName: string) {
    this.localUser = {
      id: userId,
      name: userName,
      color: this.generateUserColor(userId),
      isOnline: true,
    };
    this.skeletonEditor = new SkeletonEditor();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private generateUserColor(userId: string): { r: number; g: number; b: number } {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return {
      r: (hash & 0xFF0000) >> 16,
      g: (hash & 0x00FF00) >> 8,
      b: hash & 0x0000FF,
    };
  }

  createSession(sessionName: string, skeleton: Skeleton, isPublic: boolean = false, maxUsers: number = 8): CollaborationSession {
    const sessionId = this.generateId();
    const session: CollaborationSession = {
      id: sessionId,
      name: sessionName,
      hostId: this.localUser.id,
      users: [{ ...this.localUser }],
      skeletonId: skeleton.id,
      createdAt: new Date(),
      lastActivity: new Date(),
      isPublic,
      maxUsers,
      actionHistory: [],
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.skeletonEditor.loadSkeleton(JSON.parse(JSON.stringify(skeleton)));

    return session;
  }

  joinSession(sessionId: string, skeleton?: Skeleton): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.users.length >= session.maxUsers) return false;
    if (session.users.some(u => u.id === this.localUser.id)) return false;

    session.users.push({ ...this.localUser });
    session.lastActivity = new Date();
    this.currentSessionId = sessionId;

    if (skeleton) {
      this.skeletonEditor.loadSkeleton(JSON.parse(JSON.stringify(skeleton)));
    }

    for (const callback of this.userJoinCallbacks) {
      callback(this.localUser);
    }

    return true;
  }

  leaveSession(): boolean {
    if (!this.currentSessionId) return false;

    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.users = session.users.filter(u => u.id !== this.localUser.id);
      session.lastActivity = new Date();

      if (session.users.length === 0) {
        this.sessions.delete(this.currentSessionId);
      } else if (session.hostId === this.localUser.id) {
        session.hostId = session.users[0].id;
      }

      for (const callback of this.userLeaveCallbacks) {
        callback(this.localUser);
      }
    }

    this.currentSessionId = null;
    return true;
  }

  getCurrentSession(): CollaborationSession | null {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) || null : null;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).map(s => ({
      ...s,
      users: s.users.map(u => ({ ...u })),
      actionHistory: [...s.actionHistory],
    }));
  }

  getPublicSessions(): CollaborationSession[] {
    return this.getAllSessions().filter(s => s.isPublic);
  }

  getSessionUsers(): User[] {
    const session = this.getCurrentSession();
    return session ? session.users.map(u => ({ ...u })) : [];
  }

  isHost(): boolean {
    const session = this.getCurrentSession();
    return session ? session.hostId === this.localUser.id : false;
  }

  updateUserCursor(position: Point): void {
    const session = this.getCurrentSession();
    if (!session) return;

    const user = session.users.find(u => u.id === this.localUser.id);
    if (user) {
      user.cursorPosition = { ...position };
    }
  }

  selectNode(nodeId: string | undefined): void {
    const session = this.getCurrentSession();
    if (!session) return;

    const user = session.users.find(u => u.id === this.localUser.id);
    if (user) {
      user.selectedNodeId = nodeId;
    }
  }

  private broadcastAction(action: CollaborationAction): void {
    const session = this.getCurrentSession();
    if (!session) return;

    session.actionHistory.push(action);
    session.lastActivity = new Date();

    if (session.actionHistory.length > this.maxHistoryLength) {
      session.actionHistory = session.actionHistory.slice(-this.maxHistoryLength);
    }

    for (const callback of this.actionCallbacks) {
      callback(action, this.localUser.id);
    }
  }

  private createAction(type: CollaborationAction['type'], data: Record<string, any>): CollaborationAction {
    return {
      id: this.generateId(),
      userId: this.localUser.id,
      userName: this.localUser.name,
      type,
      timestamp: Date.now(),
      data,
    };
  }

  addNode(position: Point, mass: number = 1, isFixed: boolean = false): string | null {
    const node = this.skeletonEditor.addNode(position, mass, isFixed);
    const action = this.createAction('node_add', {
      nodeId: node.id,
      position: node.position,
      mass,
      isFixed,
    });
    this.broadcastAction(action);
    return node.id;
  }

  removeNode(nodeId: string): boolean {
    const success = this.skeletonEditor.removeNode(nodeId);
    if (success) {
      const action = this.createAction('node_remove', { nodeId });
      this.broadcastAction(action);
    }
    return success;
  }

  moveNode(nodeId: string, newPosition: Point): boolean {
    const success = this.skeletonEditor.updateNodePosition(nodeId, newPosition);
    if (success) {
      const action = this.createAction('node_move', { nodeId, newPosition });
      this.broadcastAction(action);
    }
    return success;
  }

  fixNode(nodeId: string, isFixed: boolean): boolean {
    const success = this.skeletonEditor.setNodeFixed(nodeId, isFixed);
    if (success) {
      const action = this.createAction('node_fix', { nodeId, isFixed });
      this.broadcastAction(action);
    }
    return success;
  }

  addEdge(startNodeId: string, endNodeId: string): string | null {
    const edge = this.skeletonEditor.addEdge(startNodeId, endNodeId);
    if (edge) {
      const action = this.createAction('edge_add', {
        edgeId: edge.id,
        startNodeId,
        endNodeId,
        stiffness: edge.stiffness,
        damping: edge.damping,
      });
      this.broadcastAction(action);
      return edge.id;
    }
    return null;
  }

  removeEdge(edgeId: string): boolean {
    const success = this.skeletonEditor.removeEdge(edgeId);
    if (success) {
      const action = this.createAction('edge_remove', { edgeId });
      this.broadcastAction(action);
    }
    return success;
  }

  applyRemoteAction(action: CollaborationAction): boolean {
    try {
      switch (action.type) {
        case 'node_add':
          const newNode = this.skeletonEditor.addNode(
            action.data.position,
            action.data.mass,
            action.data.isFixed
          );
          if (action.data.nodeId) {
            const skeleton = this.skeletonEditor.getSkeleton();
            const node = skeleton.nodes.find(n => n.id === newNode.id);
            if (node) node.id = action.data.nodeId;
            this.skeletonEditor.loadSkeleton(skeleton);
          }
          break;

        case 'node_remove':
          this.skeletonEditor.removeNode(action.data.nodeId);
          break;

        case 'node_move':
          this.skeletonEditor.updateNodePosition(action.data.nodeId, action.data.newPosition);
          break;

        case 'node_fix':
          this.skeletonEditor.setNodeFixed(action.data.nodeId, action.data.isFixed);
          break;

        case 'edge_add':
          this.skeletonEditor.addEdge(
            action.data.startNodeId,
            action.data.endNodeId,
            action.data.stiffness,
            action.data.damping
          );
          break;

        case 'edge_remove':
          this.skeletonEditor.removeEdge(action.data.edgeId);
          break;

        default:
          console.warn('未知操作类型:', action.type);
          return false;
      }
      return true;
    } catch (error) {
      console.error('应用远程操作失败:', error);
      return false;
    }
  }

  onAction(callback: ActionCallback): void {
    this.actionCallbacks.add(callback);
  }

  offAction(callback: ActionCallback): void {
    this.actionCallbacks.delete(callback);
  }

  onUserJoin(callback: UserCallback): void {
    this.userJoinCallbacks.add(callback);
  }

  offUserJoin(callback: UserCallback): void {
    this.userJoinCallbacks.delete(callback);
  }

  onUserLeave(callback: UserCallback): void {
    this.userLeaveCallbacks.add(callback);
  }

  offUserLeave(callback: UserCallback): void {
    this.userLeaveCallbacks.delete(callback);
  }

  getActionHistory(): CollaborationAction[] {
    const session = this.getCurrentSession();
    return session ? [...session.actionHistory] : [];
  }

  getSkeleton(): Skeleton {
    return this.skeletonEditor.getSkeleton();
  }

  setSessionPublic(isPublic: boolean): boolean {
    if (!this.isHost()) return false;
    const session = this.getCurrentSession();
    if (session) {
      session.isPublic = isPublic;
      return true;
    }
    return false;
  }

  kickUser(userId: string): boolean {
    if (!this.isHost()) return false;
    if (userId === this.localUser.id) return false;

    const session = this.getCurrentSession();
    if (!session) return false;

    const userIndex = session.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;

    const user = session.users[userIndex];
    session.users.splice(userIndex, 1);
    session.lastActivity = new Date();

    for (const callback of this.userLeaveCallbacks) {
      callback(user);
    }

    return true;
  }

  getLocalUser(): User {
    return { ...this.localUser };
  }

  updateLocalUser(updates: Partial<User>): void {
    Object.assign(this.localUser, updates);

    const session = this.getCurrentSession();
    if (session) {
      const user = session.users.find(u => u.id === this.localUser.id);
      if (user) {
        Object.assign(user, updates);
      }
    }
  }

  getConnectedUserCount(): number {
    const session = this.getCurrentSession();
    return session ? session.users.filter(u => u.isOnline).length : 0;
  }

  undo(): boolean {
    const session = this.getCurrentSession();
    if (!session || session.actionHistory.length === 0) return false;

    const lastAction = session.actionHistory.pop();
    if (!lastAction) return false;

    return this.reverseAction(lastAction);
  }

  private reverseAction(action: CollaborationAction): boolean {
    try {
      switch (action.type) {
        case 'node_add':
          this.skeletonEditor.removeNode(action.data.nodeId);
          break;

        case 'node_remove':
          console.warn('无法撤销节点删除操作');
          return false;

        case 'edge_add':
          this.skeletonEditor.removeEdge(action.data.edgeId);
          break;

        case 'edge_remove':
          console.warn('无法撤销边删除操作');
          return false;

        default:
          return false;
      }
      return true;
    } catch (error) {
      console.error('撤销操作失败:', error);
      return false;
    }
  }

  simulateUserJoin(userId: string, userName: string): User {
    const user: User = {
      id: userId,
      name: userName,
      color: this.generateUserColor(userId),
      isOnline: true,
    };

    const session = this.getCurrentSession();
    if (session) {
      session.users.push(user);
      for (const callback of this.userJoinCallbacks) {
        callback(user);
      }
    }

    return user;
  }

  simulateUserLeave(userId: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const userIndex = session.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;

    const user = session.users[userIndex];
    session.users.splice(userIndex, 1);

    for (const callback of this.userLeaveCallbacks) {
      callback(user);
    }

    return true;
  }

  destroy(): void {
    this.leaveSession();
    this.actionCallbacks.clear();
    this.userJoinCallbacks.clear();
    this.userLeaveCallbacks.clear();
  }
}
