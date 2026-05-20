import { create } from 'zustand';
import {
  WaxMaterial,
  Wick,
  Container,
  Formula,
  BatchFormula,
  CalculationResult,
  WICK_TYPES,
  CONTAINER_TYPES,
} from '../types';
import {
  calculatePercentages,
  calculateTotalWeight,
  calculateAll,
  generateId,
} from '../utils/calculations';

interface FormulaState {
  currentWaxes: WaxMaterial[];
  currentWick: Wick;
  currentContainer: Container;
  formulas: Formula[];
  batchFormulas: BatchFormula[];
  calculationResult: CalculationResult | null;
  formulaName: string;

  addWax: (wax: WaxMaterial) => void;
  updateWax: (id: string, updates: Partial<WaxMaterial>) => void;
  removeWax: (id: string) => void;
  setWick: (wick: Wick) => void;
  setContainer: (container: Container) => void;
  setFormulaName: (name: string) => void;
  calculate: () => void;
  saveFormula: () => void;
  deleteFormula: (id: string) => void;
  addBatchFormula: (formula: BatchFormula) => void;
  removeBatchFormula: (id: string) => void;
  calculateBatch: () => void;
  clearCurrent: () => void;
}

const initialWick: Wick = {
  id: generateId(),
  type: WICK_TYPES[0].type,
  size: WICK_TYPES[0].size,
  burnRate: WICK_TYPES[0].burnRate,
};

const initialContainer: Container = {
  id: generateId(),
  name: CONTAINER_TYPES[0].name,
  diameter: CONTAINER_TYPES[0].diameter,
  height: CONTAINER_TYPES[0].height,
  volume: CONTAINER_TYPES[0].volume,
};

export const useFormulaStore = create<FormulaState>((set, get) => ({
  currentWaxes: [],
  currentWick: initialWick,
  currentContainer: initialContainer,
  formulas: [],
  batchFormulas: [],
  calculationResult: null,
  formulaName: '新配方',

  addWax: (wax) =>
    set((state) => {
      const newWaxes = [...state.currentWaxes, wax];
      return { currentWaxes: calculatePercentages(newWaxes) };
    }),

  updateWax: (id, updates) =>
    set((state) => {
      const newWaxes = state.currentWaxes.map((wax) =>
        wax.id === id ? { ...wax, ...updates } : wax
      );
      return { currentWaxes: calculatePercentages(newWaxes) };
    }),

  removeWax: (id) =>
    set((state) => {
      const newWaxes = state.currentWaxes.filter((wax) => wax.id !== id);
      return { currentWaxes: calculatePercentages(newWaxes) };
    }),

  setWick: (wick) => set({ currentWick: wick }),

  setContainer: (container) => set({ currentContainer: container }),

  setFormulaName: (name) => set({ formulaName: name }),

  calculate: () =>
    set((state) => {
      if (state.currentWaxes.length === 0) {
        return { calculationResult: null };
      }
      const result = calculateAll(
        state.currentWaxes,
        state.currentWick,
        state.currentContainer
      );
      return { calculationResult: result };
    }),

  saveFormula: () =>
    set((state) => {
      const { currentWaxes, currentWick, currentContainer, formulaName, calculationResult } = state;
      
      if (currentWaxes.length === 0 || !calculationResult) return state;

      const newFormula: Formula = {
        id: generateId(),
        name: formulaName,
        waxes: currentWaxes,
        wick: currentWick,
        container: currentContainer,
        totalWeight: calculateTotalWeight(currentWaxes),
        burnTime: calculationResult.burnTime,
        smokeEmission: calculationResult.smokeEmission,
        createdAt: new Date().toLocaleString('zh-CN'),
      };

      return {
        formulas: [...state.formulas, newFormula],
      };
    }),

  deleteFormula: (id) =>
    set((state) => ({
      formulas: state.formulas.filter((f) => f.id !== id),
    })),

  addBatchFormula: (formula) =>
    set((state) => ({
      batchFormulas: [...state.batchFormulas, formula],
    })),

  removeBatchFormula: (id) =>
    set((state) => ({
      batchFormulas: state.batchFormulas.filter((f) => f.id !== id),
    })),

  calculateBatch: () =>
    set((state) => ({
      batchFormulas: state.batchFormulas.map((formula) => {
        const totalWeight = formula.waxes.reduce((sum, w) => sum + w.weight, 0);
        if (totalWeight === 0 || !formula.wick || !formula.container) {
          return { ...formula, result: undefined };
        }
        return {
          ...formula,
          result: calculateAll(formula.waxes, formula.wick, formula.container),
        };
      }),
    })),

  clearCurrent: () =>
    set({
      currentWaxes: [],
      calculationResult: null,
      formulaName: '新配方',
    }),
}));
