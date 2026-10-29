import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { readPersistentValue, seedPersistentRecovery, writePersistentValue } from "../lib/persistence";

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>, { recovered: boolean; readFailed: boolean; writeFailed: boolean }] {
  const [loaded] = useState(() => readPersistentValue(localStorage, key, initialValue));
  const [value, setValueState] = useState<T>(loaded.value);
  const [writeFailed, setWriteFailed] = useState(false);
  const changed = useRef(false);
  const setValue: Dispatch<SetStateAction<T>> = useCallback(action => {
    changed.current = true;
    setValueState(action);
  }, []);

  useEffect(() => {
    // Initial/default values must never overwrite old data during startup.
    try {
      if (!changed.current && !loaded.readFailed && !loaded.recovered) seedPersistentRecovery(localStorage, key);
      writePersistentValue(localStorage, key, value, changed.current || loaded.recovered);
      setWriteFailed(false);
    } catch { setWriteFailed(true); }
  }, [key, value]);

  return [value, setValue, { recovered: loaded.recovered, readFailed: loaded.readFailed, writeFailed }];
}
