import { create } from 'zustand';
import { User, Image, TextBlock, Project, Version, Annotation } from '../shared/types';

interface AppState {
  user: User | null;
  token: string | null;
  projects: Project[];
  images: Image[];
  currentImage: Image | null;
  textBlocks: TextBlock[];
  annotations: Annotation[];
  versions: Version[];
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setProjects: (projects: Project[]) => void;
  setImages: (images: Image[]) => void;
  setCurrentImage: (image: Image | null) => void;
  setTextBlocks: (blocks: TextBlock[]) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  setVersions: (versions: Version[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  updateTextBlock: (blockId: string, updates: Partial<TextBlock>) => void;
}

const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  projects: [],
  images: [],
  currentImage: null,
  textBlocks: [],
  annotations: [],
  versions: [],
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  setProjects: (projects) => set({ projects }),
  setImages: (images) => set({ images }),
  setCurrentImage: (image) => set({ currentImage: image }),
  setTextBlocks: (blocks) => set({ textBlocks: blocks }),
  setAnnotations: (annotations) => set({ annotations }),
  setVersions: (versions) => set({ versions }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, projects: [], images: [], currentImage: null, textBlocks: [], annotations: [] });
  },
  updateTextBlock: (blockId, updates) => {
    set((state) => ({
      textBlocks: state.textBlocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block
      ),
    }));
  },
}));

export default useStore;
