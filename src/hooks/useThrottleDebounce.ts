/**
 * ⏱️ Hooks Throttle & Debounce
 * Optimisation des performances pour éviter les re-renders excessifs
 */

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Hook useThrottle - Limite l'exécution d'une fonction à intervalles réguliers
 * @param callback Fonction à throttle
 * @param limit Intervalle minimum en ms
 * @returns Fonction throttlée
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 200
): (...args: Parameters<T>) => void {
  const lastRun = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttledFunction = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    if (timeSinceLastRun >= limit) {
      // Exécuter immédiatement
      lastRun.current = now;
      callback(...args);
    } else {
      // Programmer pour plus tard
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastRun.current = Date.now();
        callback(...args);
      }, limit - timeSinceLastRun);
    }
  }, [callback, limit]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledFunction;
}

/**
 * Hook useDebounce - Retarde l'exécution jusqu'à ce que l'activité cesse
 * @param callback Fonction à debounce
 * @param delay Délai en ms
 * @returns Fonction debouncée
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFunction = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFunction;
}

/**
 * Hook useThrottledState - State avec throttle intégré
 * @param initialValue Valeur initiale
 * @param limit Intervalle de throttle en ms
 * @returns [value, setValue, throttledValue]
 */
export function useThrottledState<T>(
  initialValue: T,
  limit: number = 200
): [T, (value: T | ((prev: T) => T)) => void, T] {
  const [value, setValue] = useState<T>(initialValue);
  const [throttledValue, setThrottledValue] = useState<T>(initialValue);
  const lastUpdate = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setThrottled = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue);

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate.current;

    if (timeSinceLastUpdate >= limit) {
      lastUpdate.current = now;
      setThrottledValue(newValue instanceof Function ? newValue(throttledValue) : newValue);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        lastUpdate.current = Date.now();
        setThrottledValue(newValue instanceof Function ? newValue(throttledValue) : newValue);
      }, limit - timeSinceLastUpdate);
    }
  }, [limit, throttledValue]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, setThrottled, throttledValue];
}

/**
 * Hook useDebouncedValue - Retourne une valeur debouncée
 * @param value Valeur à debounce
 * @param delay Délai en ms
 * @returns Valeur debouncée
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook useThrottledCallback - Callback avec throttle et ref à jour
 * @param callback Fonction à throttle
 * @param limit Intervalle en ms
 * @returns Fonction throttlée avec ref frais
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 200
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  const lastCallTime = useRef<number>(0);

  // Mettre à jour la ref à chaque render
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallTime.current >= limit) {
      lastCallTime.current = now;
      callbackRef.current(...args);
    }
  }, [limit]);
}

/**
 * Hook useRafThrottle - Throttle basé sur requestAnimationFrame
 * Parfait pour les animations et updates visuels
 * @param callback Fonction à throttle
 * @returns Fonction throttlée sur RAF
 */
export function useRafThrottle<T extends (...args: any[]) => any>(
  callback: T
): (...args: Parameters<T>) => void {
  const rafRef = useRef<number | null>(null);
  const latestArgs = useRef<Parameters<T> | null>(null);

  const throttledFunction = useCallback((...args: Parameters<T>) => {
    latestArgs.current = args;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (latestArgs.current) {
          callback(...latestArgs.current);
        }
        rafRef.current = null;
      });
    }
  }, [callback]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return throttledFunction;
}

/**
 * Hook useBufferedState - Accumule les updates et les applique par batch
 * @param initialValue Valeur initiale
 * @param bufferSize Taille max du buffer
 * @param flushInterval Intervalle de flush en ms
 */
export function useBufferedState<T>(
  initialValue: T,
  bufferSize: number = 100,
  flushInterval: number = 100
): [T, (updater: (prev: T) => T) => void] {
  const [state, setState] = useState<T>(initialValue);
  const bufferRef = useRef<((prev: T) => T)[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToBuffer = useCallback((updater: (prev: T) => T) => {
    bufferRef.current.push(updater);

    if (bufferRef.current.length >= bufferSize) {
      // Flush immédiat si buffer plein
      flushBuffer();
    } else if (timeoutRef.current === null) {
      // Programmer un flush
      timeoutRef.current = setTimeout(flushBuffer, flushInterval);
    }
  }, [bufferSize, flushInterval]);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;

    setState(prev => {
      let newState = prev;
      for (const updater of bufferRef.current) {
        newState = updater(newState);
      }
      return newState;
    });

    bufferRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, addToBuffer];
}
