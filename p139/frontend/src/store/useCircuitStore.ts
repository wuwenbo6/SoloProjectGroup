import { create } from 'zustand';
import { CircuitState, Gate, SimulationResult, Job } from '../types';
import api from '../services/api';

const POLL_INTERVAL = 1000;

export interface NoiseSettings {
  depolarizing_rate: number;
  amplitude_damping: number;
  readout_error: number;
  enabled: boolean;
}

export const useCircuitStore = create<CircuitState & {
  noiseSettings: NoiseSettings;
  setNoiseSettings: (settings: NoiseSettings) => void;
  exportToQASM: () => Promise<void>;
}>((set, get) => ({
  numQubits: 3,
  gates: [],
  currentJob: null,
  results: null,
  isRunning: false,
  noiseSettings: {
    depolarizing_rate: 0.01,
    amplitude_damping: 0,
    readout_error: 0.02,
    enabled: false,
  },

  setNumQubits: (n: number) => {
    set({
      numQubits: n,
      gates: get().gates.filter((g) => g.target < n),
    });
  },

  addGate: (gate: Gate) => {
    set((state) => ({ gates: [...state.gates, gate] }));
  },

  removeGate: (index: number) => {
    set((state) => ({
      gates: state.gates.filter((_, i) => i !== index),
    }));
  },

  clearCircuit: () => {
    set({ gates: [], results: null, currentJob: null });
  },

  setCurrentJob: (job: Job | null) => {
    set({ currentJob: job });
  },

  setResults: (results: SimulationResult | null) => {
    set({ results });
  },

  setNoiseSettings: (settings: NoiseSettings) => {
    set({ noiseSettings: settings });
  },

  exportToQASM: async () => {
    const { numQubits, gates } = get();
    try {
      const response = await api.post('/jobs/export/qasm', null, {
        params: {
          num_qubits: numQubits,
          name: 'my_circuit',
        },
        data: gates,
      });

      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'circuit.qasm';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting QASM:', error);
    }
  },

  runCircuit: async () => {
    const { numQubits, gates, noiseSettings } = get();
    set({ isRunning: true, results: null });

    try {
      const noiseParams = noiseSettings.enabled
        ? {
            depolarizing_rate: noiseSettings.depolarizing_rate,
            amplitude_damping: noiseSettings.amplitude_damping,
            readout_error: noiseSettings.readout_error,
          }
        : undefined;

      const response = await api.post('/jobs/', {
        num_qubits: numQubits,
        gates,
        shots: 1024,
        ...(noiseParams ? { noise_params: noiseParams } : {}),
      });

      set({ currentJob: response.data });

      const pollJobStatus = async () => {
        const updatedJob = await api.get(`/jobs/${response.data.id}`);
        set({ currentJob: updatedJob.data });

        if (updatedJob.data.status === 'completed' && updatedJob.data.probabilities) {
          set({
            isRunning: false,
            results: {
              probabilities: updatedJob.data.probabilities,
              measurements: updatedJob.data.measurements || {},
              bloch_spheres: updatedJob.data.bloch_spheres || [],
              execution_time: updatedJob.data.execution_time || 0,
            },
          });
        } else if (updatedJob.data.status === 'failed') {
          set({ isRunning: false });
        } else if (['pending', 'running'].includes(updatedJob.data.status)) {
          setTimeout(pollJobStatus, POLL_INTERVAL);
        }
      };

      setTimeout(pollJobStatus, POLL_INTERVAL);
    } catch (error) {
      console.error('Error running circuit:', error);
      set({ isRunning: false });
    }
  },
}));
