import { create } from 'zustand';
import { AudioTrack } from '../types';
import { db } from '../utils/storage';

interface LibraryState {
  tracks: AudioTrack[];
  selectedTrack: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  loadTracks: () => Promise<void>;
  selectTrack: (trackId: string | null) => void;
  deleteTrack: (trackId: string) => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  updateTrackMetadata: (trackId: string, metadata: Partial<AudioTrack['metadata']>) => Promise<void>;
  clearError: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  selectedTrack: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  loadTracks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tracks = await db.getAllTracks();
      set({ tracks, isLoading: false });
    } catch (e) {
      console.error('Failed to load tracks:', e);
      set({ error: 'Failed to load tracks', isLoading: false, tracks: [] });
    }
  },

  selectTrack: (trackId: string | null) => {
    set({ selectedTrack: trackId });
  },

  deleteTrack: async (trackId: string) => {
    try {
      await db.deleteTrack(trackId);
      set(state => ({
        tracks: state.tracks.filter(t => t.id !== trackId),
        selectedTrack: state.selectedTrack === trackId ? null : state.selectedTrack
      }));
    } catch (e) {
      console.error('Failed to delete track:', e);
      set({ error: 'Failed to delete track' });
    }
  },

  searchTracks: async (query: string) => {
    set({ searchQuery: query, isLoading: true, error: null });
    try {
      const tracks = await db.searchTracks(query);
      set({ tracks, isLoading: false });
    } catch (e) {
      console.error('Failed to search tracks:', e);
      set({ error: 'Search failed', isLoading: false, tracks: [] });
    }
  },

  updateTrackMetadata: async (trackId: string, metadata: Partial<AudioTrack['metadata']>) => {
    try {
      const result = await db.getTrack(trackId);
      if (result) {
        const updatedTrack = {
          ...result.track,
          metadata: { ...result.track.metadata, ...metadata },
          updatedAt: Date.now()
        };
        await db.saveTrack(updatedTrack, result.audioData);
        set(state => ({
          tracks: state.tracks.map(t => t.id === trackId ? updatedTrack : t)
        }));
      }
    } catch (e) {
      console.error('Failed to update track metadata:', e);
      set({ error: 'Failed to update track' });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));
