import { EventEmitter } from 'events';

export interface CharacterData {
  char: string;
  charCode: number;
  timestamp: number;
  typewriterModel?: string;
  confidence?: number;
  correction?: string;
}

export interface CollectionSession {
  id: string;
  startTime: number;
  endTime?: number;
  characters: CharacterData[];
  typewriterModel?: string;
}

export class CharacterCollector extends EventEmitter {
  private currentSession: CollectionSession | null = null;
  private sessions: Map<string, CollectionSession> = new Map();
  private buffer: CharacterData[] = [];
  private readonly bufferSize: number = 100;

  constructor() {
    super();
  }

  startSession(typewriterModel?: string): CollectionSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      characters: [],
      typewriterModel
    };

    this.sessions.set(sessionId, this.currentSession);
    this.emit('session-started', this.currentSession);
    
    return this.currentSession;
  }

  collectCharacter(data: CharacterData): void {
    if (!this.currentSession) {
      this.startSession(data.typewriterModel);
    }

    if (this.currentSession) {
      this.currentSession.characters.push(data);
      this.buffer.push(data);

      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }

      this.emit('character-collected', data);
    }
  }

  endSession(): CollectionSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = Date.now();
    const session = { ...this.currentSession };
    
    this.emit('session-ended', session);
    this.currentSession = null;
    
    return session;
  }

  getCurrentSession(): CollectionSession | null {
    return this.currentSession;
  }

  getSession(sessionId: string): CollectionSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): CollectionSession[] {
    return Array.from(this.sessions.values());
  }

  getRecentCharacters(count: number = 10): CharacterData[] {
    return this.buffer.slice(-count);
  }

  getSessionText(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    
    return session.characters
      .map(c => c.correction || c.char)
      .join('');
  }

  correctCharacter(sessionId: string, index: number, correction: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || index < 0 || index >= session.characters.length) {
      return false;
    }

    session.characters[index].correction = correction;
    this.emit('character-corrected', {
      sessionId,
      index,
      correction,
      character: session.characters[index]
    });

    return true;
  }

  batchCorrect(sessionId: string, corrections: Map<number, string>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    corrections.forEach((correction, index) => {
      if (index >= 0 && index < session.characters.length) {
        session.characters[index].correction = correction;
      }
    });

    this.emit('batch-corrected', { sessionId, corrections });
    return true;
  }

  clearSession(sessionId: string): boolean {
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }
    
    return this.sessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.currentSession = null;
    this.sessions.clear();
    this.buffer = [];
    this.emit('all-sessions-cleared');
  }
}
