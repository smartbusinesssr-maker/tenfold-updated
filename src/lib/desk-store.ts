import { create } from "zustand";
import { persist } from "zustand/middleware";
import { downloadCsv, ledgerToCsv, pickToLedger } from "@/lib/football/csv";
import type { LedgerRow, ScoredPick } from "@/lib/football/types";

interface DeskState {
  selectedIds: string[];
  ledger: LedgerRow[];
  toggle: (id: string) => void;
  setFold: (fold: ScoredPick[]) => void;
  saveSelected: (picks: ScoredPick[], date: string) => number;
  exportLedger: () => void;
  removeLedger: (pickId: string, savedAt: string) => void;
  clearSelected: () => void;
}

export const useDeskStore = create<DeskState>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      ledger: [],
      toggle: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        })),
      setFold: (fold) => set({ selectedIds: fold.map((p) => p.id) }),
      saveSelected: (picks, date) => {
        const { selectedIds, ledger } = get();
        const chosen = picks.filter((p) => selectedIds.includes(p.id));
        const savedAt = new Date().toISOString();
        const rows = chosen.map((p) => pickToLedger(p, savedAt));
        const next = [...rows, ...ledger].slice(0, 400);
        set({ ledger: next });
        downloadCsv(`tenfold-${date}.csv`, ledgerToCsv(rows));
        return rows.length;
      },
      exportLedger: () => {
        downloadCsv("tenfold-ledger.csv", ledgerToCsv(get().ledger));
      },
      removeLedger: (pickId, savedAt) =>
        set((s) => ({
          ledger: s.ledger.filter((r) => !(r.pickId === pickId && r.savedAt === savedAt)),
        })),
      clearSelected: () => set({ selectedIds: [] }),
    }),
    { name: "tenfold.ledger.v1" },
  ),
);
