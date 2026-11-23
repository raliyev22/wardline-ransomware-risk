"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, toApiError } from "./api";

interface ApiState<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}

/** Client-side GET with loading/error state and a retry function. */
export function useApi<T>(path: string) {
  const [state, setState] = useState<ApiState<T>>({ loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    apiGet<T>(path, { force: attempt > 0 }).then(
      (data) => active && setState({ data, loading: false }),
      (error: unknown) => active && setState({ error: toApiError(error), loading: false }),
    );
    return () => {
      active = false;
    };
  }, [path, attempt]);

  const reload = useCallback(() => {
    setState({ loading: true });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
