import { useReducer, useCallback } from 'react';
import type { WizardStep, WizardState, WizardAction, AreaMode, AreaSize } from '../types';

const initialState: WizardState = {
  step: 1,
  areaMode: 'click',
  areaSize: 2,
  error: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, areaMode: action.mode };

    case 'SET_SIZE':
      return { ...state, areaSize: action.size };

    case 'AREA_SELECTED':
      return { ...state, step: 2, error: null };

    case 'LOADING_STARTED':
      return { ...state, error: null };

    case 'DATA_LOADED':
      return { ...state, step: 3, error: null };

    case 'REFERENCE_SELECTED':
      return { ...state, step: 4, error: null };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'BACK':
      if (state.step > 1) {
        return { ...state, step: (state.step - 1) as WizardStep, error: null };
      }
      return state;

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Select Area',
  2: 'Load Data',
  3: 'Select Reference',
  4: 'Explore Results',
};

export function useWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const setMode = useCallback((mode: AreaMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const setSize = useCallback((size: AreaSize) => {
    dispatch({ type: 'SET_SIZE', size });
  }, []);

  const areaSelected = useCallback(() => {
    dispatch({ type: 'AREA_SELECTED' });
  }, []);

  const loadingStarted = useCallback(() => {
    dispatch({ type: 'LOADING_STARTED' });
  }, []);

  const dataLoaded = useCallback(() => {
    dispatch({ type: 'DATA_LOADED' });
  }, []);

  const referenceSelected = useCallback(() => {
    dispatch({ type: 'REFERENCE_SELECTED' });
  }, []);

  const setError = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    setMode,
    setSize,
    areaSelected,
    loadingStarted,
    dataLoaded,
    referenceSelected,
    setError,
    clearError,
    back,
    reset,
  };
}
