import { useState, useEffect, useCallback } from 'react';
import { workScheduleDB } from '../utils/indexedDB';
import { DEFAULT_SHIFT_COMBINATIONS } from '../constants';

export function useIndexedDB<T>(
  key: string,
  initialValue: T,
  storageType: 'setting' | 'metadata' = 'setting'
) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load value from IndexedDB
  const loadValue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await workScheduleDB.init();
      
      const storedValue = storageType === 'setting' 
        ? await workScheduleDB.getSetting<T>(key)
        : await workScheduleDB.getMetadata<T>(key);
      
      if (storedValue !== null) {
        // Special handling for workSettings to ensure shift combinations are present
        if (key === 'workSettings' && typeof storedValue === 'object' && storedValue !== null) {
          const settings = storedValue as any;
          
          // FORCE UPDATE: Always use latest default shift combinations
          if (!settings.shiftCombinations || settings.shiftCombinations.length === 0 || true) {
            const fixedSettings = {
              ...settings,
              shiftCombinations: DEFAULT_SHIFT_COMBINATIONS
            };
            
            // Save the fixed settings back to IndexedDB
            await workScheduleDB.setSetting(key, fixedSettings as T);
            setValue(fixedSettings as T);
          } else {
            setValue(storedValue);
          }
        } else {
          setValue(storedValue);
        }
      } else {
        // If no stored value, use the initial value and save it
        setValue(initialValue);
        if (storageType === 'setting') {
          await workScheduleDB.setSetting(key, initialValue);
        } else {
          await workScheduleDB.setMetadata(key, initialValue);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // On error, still set the initial value so the app doesn't break
      setValue(initialValue);
    } finally {
      setIsLoading(false);
    }
  }, [key, storageType, JSON.stringify(initialValue)]); // Include serialized initialValue

  // Load initial value from IndexedDB
  useEffect(() => {
    loadValue();
  }, [loadValue]);

  // Update value and save to IndexedDB
  const updateValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    try {
      setError(null);
      const valueToStore = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(value) 
        : newValue;
      
      setValue(valueToStore);
      
      // Ensure database is initialized before saving
      await workScheduleDB.init();
      
      if (storageType === 'setting') {
        await workScheduleDB.setSetting(key, valueToStore);
      } else {
        await workScheduleDB.setMetadata(key, valueToStore);
      }
      
      // Add a small delay to ensure data is persisted on iPhone
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // On iPhone, sometimes we need to retry
      if (err instanceof Error && err.message.includes('Transaction')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (storageType === 'setting') {
            await workScheduleDB.setSetting(key, valueToStore);
          } else {
            await workScheduleDB.setMetadata(key, valueToStore);
          }
          setError(null);
        } catch (retryErr) {
          // Retry failed silently
        }
      }
    }
  }, [key, value, storageType]);

  return [value, updateValue, { isLoading, error, refresh: loadValue }] as const;
}

export function useScheduleData() {
  const [schedule, setScheduleState] = useState<Record<string, string[]>>({});
  const [specialDates, setSpecialDatesState] = useState<Record<string, boolean>>({});
  const [dateNotes, setDateNotesState] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await workScheduleDB.init();
      
      const [scheduleData, specialDatesData, dateNotesData] = await Promise.all([
        workScheduleDB.getSchedule(),
        workScheduleDB.getSpecialDates(),
        workScheduleDB.getDateNotes()
      ]);
      
      setScheduleState(scheduleData);
      setSpecialDatesState(specialDatesData);
      setDateNotesState(dateNotesData || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSchedule = useCallback(async (newSchedule: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
    try {
      setError(null);
      const scheduleToStore = typeof newSchedule === 'function' 
        ? newSchedule(schedule) 
        : newSchedule;
      
      setScheduleState(scheduleToStore);
      
      // Ensure database is initialized
      await workScheduleDB.init();
      await workScheduleDB.setSchedule(scheduleToStore);
      
      // Add delay for iPhone persistence
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Retry logic for iPhone
      if (err instanceof Error && err.message.includes('Transaction')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          await workScheduleDB.setSchedule(scheduleToStore);
          setError(null);
        } catch (retryErr) {
          // Retry failed silently
        }
      }
    }
  }, [schedule]);

  // Auto-save special dates when they change (redundant with updateSpecialDates, keeping as backup)

  const updateSpecialDates = useCallback(async (newSpecialDates: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
    try {
      setError(null);
      // For functional updates, we need to use the CURRENT state value
      const specialDatesToStore = typeof newSpecialDates === 'function' 
        ? (newSpecialDates as (prev: Record<string, boolean>) => Record<string, boolean>)(specialDates) 
        : newSpecialDates;
      
      setSpecialDatesState(specialDatesToStore);
      
      // Ensure database is initialized
      await workScheduleDB.init();
      await workScheduleDB.setSpecialDates(specialDatesToStore);
      
      // Add delay for iPhone persistence
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Retry logic for iPhone
      if (err instanceof Error && err.message.includes('Transaction')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          await workScheduleDB.setSpecialDates(specialDatesToStore);
          setError(null);
        } catch (retryErr) {
          // Retry failed silently
        }
      }
    }
  }, [specialDates]); // Keep dependency but accept stale closure issue

  const updateDateNotes = useCallback(async (newDateNotes: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    try {
      const dateNotesToStore = typeof newDateNotes === 'function' 
        ? newDateNotes(dateNotes) 
        : newDateNotes;
      
      setDateNotesState(dateNotesToStore);
      
      await workScheduleDB.init();
      await workScheduleDB.setDateNotes(dateNotesToStore);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      if (err instanceof Error && err.message.includes('Transaction')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const retryData = typeof newDateNotes === 'function' 
            ? newDateNotes(dateNotes) 
            : newDateNotes;
            
          await workScheduleDB.setDateNotes(retryData);
          setError(null);
        } catch (retryErr) {
          // Retry failed silently
        }
      }
    }
  }, [dateNotes]); // Dependency on dateNotes for functional updates

  return {
    schedule,
    specialDates,
    dateNotes,
    setSchedule: updateSchedule,
    setSpecialDates: updateSpecialDates,
    setDateNotes: updateDateNotes,
    isLoading,
    error,
    refreshData: loadData // Export the refresh function
  };
}