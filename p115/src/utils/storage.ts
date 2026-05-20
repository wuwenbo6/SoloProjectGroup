import Dexie, { Table } from 'dexie';
import { AudioTrack } from '../types';

interface DBTrack {
  id: string;
  name: string;
  artist?: string;
  album?: string;
  duration: number;
  sampleRate: number;
  channels: number;
  waveformData: number[];
  createdAt: number;
  updatedAt: number;
  genre?: string;
  year?: number;
  trackNumber?: number;
  comments?: string;
  processingHistory: string;
}

const AUDIO_CACHE = new Map<string, string>();
const MAX_CACHED_TRACKS = 10;

function safeJsonParse(str: string | undefined, fallback: any): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export class AudioDatabase extends Dexie {
  private tracks!: Table<DBTrack>;

  constructor() {
    super('VinylAudioDB');
    try {
      this.version(2).stores({
        tracks: 'id, name, artist, album, duration, createdAt, updatedAt'
      });
    } catch (e) {
      console.warn('Database version error, deleting and recreating:', e);
      this.delete();
      this.version(1).stores({
        tracks: 'id, name, artist, album, duration, createdAt, updatedAt'
      });
    }
  }

  async saveTrack(track: AudioTrack, audioData: Float32Array[]): Promise<void> {
    try {
      const dbTrack: DBTrack = {
        id: track.id,
        name: track.name,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        sampleRate: track.sampleRate,
        channels: track.channels,
        waveformData: track.waveformData,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt,
        genre: track.metadata.genre,
        year: track.metadata.year,
        trackNumber: track.metadata.trackNumber,
        comments: track.metadata.comments,
        processingHistory: JSON.stringify(track.processingHistory || [])
      };

      await this.tracks.put(dbTrack);
      await this.saveAudioData(track.id, audioData);
    } catch (e) {
      console.error('Error saving track:', e);
      throw new Error('Failed to save track');
    }
  }

  async getTrack(id: string): Promise<{ track: AudioTrack; audioData: Float32Array[] } | null> {
    try {
      const dbTrack = await this.tracks.get(id);
      if (!dbTrack) return null;

      const audioData = await this.getAudioData(id);
      if (!audioData) return null;

      const track: AudioTrack = {
        id: dbTrack.id,
        name: dbTrack.name,
        artist: dbTrack.artist,
        album: dbTrack.album,
        duration: dbTrack.duration,
        sampleRate: dbTrack.sampleRate,
        channels: dbTrack.channels,
        audioData: [],
        waveformData: dbTrack.waveformData,
        createdAt: dbTrack.createdAt,
        updatedAt: dbTrack.updatedAt,
        metadata: {
          genre: dbTrack.genre,
          year: dbTrack.year,
          trackNumber: dbTrack.trackNumber,
          comments: dbTrack.comments
        },
        processingHistory: safeJsonParse(dbTrack.processingHistory, [])
      };

      return { track, audioData };
    } catch (e) {
      console.error('Error getting track:', e);
      return null;
    }
  }

  async getAllTracks(): Promise<AudioTrack[]> {
    try {
      const dbTracks = await this.tracks.orderBy('createdAt').reverse().toArray();
      return dbTracks.map(dbTrack => ({
        id: dbTrack.id,
        name: dbTrack.name,
        artist: dbTrack.artist,
        album: dbTrack.album,
        duration: dbTrack.duration,
        sampleRate: dbTrack.sampleRate,
        channels: dbTrack.channels,
        audioData: [],
        waveformData: dbTrack.waveformData || [],
        createdAt: dbTrack.createdAt,
        updatedAt: dbTrack.updatedAt,
        metadata: {
          genre: dbTrack.genre,
          year: dbTrack.year,
          trackNumber: dbTrack.trackNumber,
          comments: dbTrack.comments
        },
        processingHistory: safeJsonParse(dbTrack.processingHistory, [])
      }));
    } catch (e) {
      console.error('Error getting all tracks:', e);
      return [];
    }
  }

  async deleteTrack(id: string): Promise<void> {
    try {
      await this.tracks.delete(id);
      await this.deleteAudioData(id);
    } catch (e) {
      console.error('Error deleting track:', e);
    }
  }

  private async saveAudioData(trackId: string, audioData: Float32Array[]): Promise<void> {
    try {
      const serialized = JSON.stringify(audioData.map(ch => Array.from(ch)));
      
      if (AUDIO_CACHE.size >= MAX_CACHED_TRACKS) {
        const firstKey = AUDIO_CACHE.keys().next().value;
        if (firstKey) AUDIO_CACHE.delete(firstKey);
      }
      AUDIO_CACHE.set(trackId, serialized);
      
      const storageKey = `audio_${trackId}`;
      try {
        localStorage.setItem(storageKey, serialized);
      } catch (storageError) {
        console.warn('LocalStorage full, using memory cache only:', storageError);
      }
    } catch (e) {
      console.error('Error saving audio data:', e);
      throw new Error('Failed to save audio data');
    }
  }

  private async getAudioData(trackId: string): Promise<Float32Array[] | null> {
    try {
      let serialized = AUDIO_CACHE.get(trackId);
      
      if (!serialized) {
        const stored = localStorage.getItem(`audio_${trackId}`);
        if (stored) {
          serialized = stored;
          if (AUDIO_CACHE.size >= MAX_CACHED_TRACKS) {
            const firstKey = AUDIO_CACHE.keys().next().value;
            if (firstKey) AUDIO_CACHE.delete(firstKey);
          }
          AUDIO_CACHE.set(trackId, serialized);
        }
      }
      
      if (!serialized) return null;
      
      const parsed = JSON.parse(serialized);
      if (!Array.isArray(parsed)) return null;
      
      return parsed.map((arr: unknown) => {
        if (Array.isArray(arr)) {
          return new Float32Array(arr);
        }
        return new Float32Array(0);
      });
    } catch (e) {
      console.error('Error getting audio data:', e);
      return null;
    }
  }

  private async deleteAudioData(trackId: string): Promise<void> {
    try {
      AUDIO_CACHE.delete(trackId);
      localStorage.removeItem(`audio_${trackId}`);
    } catch (e) {
      console.error('Error deleting audio data:', e);
    }
  }

  async searchTracks(query: string): Promise<AudioTrack[]> {
    try {
      if (!query || query.trim() === '') {
        return this.getAllTracks();
      }

      const allTracks = await this.getAllTracks();
      const lowerQuery = query.toLowerCase();
      
      return allTracks.filter(track => {
        try {
          return (
            track.name.toLowerCase().includes(lowerQuery) ||
            (track.artist && track.artist.toLowerCase().includes(lowerQuery)) ||
            (track.album && track.album.toLowerCase().includes(lowerQuery)) ||
            (track.metadata.genre && track.metadata.genre.toLowerCase().includes(lowerQuery))
          );
        } catch {
          return false;
        }
      });
    } catch (e) {
      console.error('Error searching tracks:', e);
      return [];
    }
  }

  async getTrackCount(): Promise<number> {
    try {
      return await this.tracks.count();
    } catch {
      return 0;
    }
  }

  clearCache(): void {
    AUDIO_CACHE.clear();
  }
}

export const db = new AudioDatabase();
