"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Shared Investment Planner choices (investment IDs + budget) across pages.
 *
 * Only the user's *inputs* are stored, never model results: every page re-evaluates them on the backend.
 * Persisted per browser tab in sessionStorage; every read/write is guarded so the app still works when storage is
 * unavailable (private mode, blocked site data), falling back to in-memory state.
 */
export interface PlanState {
  selected: string[];
  /** null = use the engine budget */
  budget: number | null;
}

const KEY = "ransomware-decision-support.plan.v1";
const EMPTY: PlanState = { selected: [], budget: null };

let state: PlanState | null = null;
const listeners = new Set<() => void>();

function sanitize(raw: unknown): PlanState {
  if (!raw || typeof raw !== "object") return EMPTY;
  const r = raw as { selected?: unknown; budget?: unknown };
  const selected = Array.isArray(r.selected)
    ? [...new Set(r.selected.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(x)))]
    : [];
  const budget = typeof r.budget === "number" && Number.isFinite(r.budget) && r.budget > 0 ? r.budget : null;
  return { selected, budget };
}

function load(): PlanState {
  if (state) return state;
  try {
    const text = window.sessionStorage.getItem(KEY);
    state = text ? sanitize(JSON.parse(text)) : EMPTY;
  } catch {
    state = EMPTY;
  }
  return state;
}

function save(next: PlanState) {
  state = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep in memory only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true once the client snapshot (sessionStorage) is in use. */
export function usePlanHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function usePlanStore() {
  const plan = useSyncExternalStore(subscribe, load, () => EMPTY);

  const setSelected = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    const prev = load();
    save({ ...prev, selected: typeof value === "function" ? value(prev.selected) : value });
  }, []);

  const setBudget = useCallback((budget: number | null) => {
    save({ ...load(), budget });
  }, []);

  return { plan, setSelected, setBudget };
}
