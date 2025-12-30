import { useState, useEffect } from 'react';

/**
 * Debounces a value, returning the debounced value after the specified delay.
 * Useful for delaying expensive operations until user stops interacting.
 */
export function useDebounce<T>(value: T, delay: number): T {
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
