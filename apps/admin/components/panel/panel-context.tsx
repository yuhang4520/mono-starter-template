"use client";

import React, { createContext, useContext, useState } from "react";

interface PanelContextType {
  isFilterSheetOpen: boolean;
  setFilterSheetOpen: (open: boolean) => void;
  activeFilterColumn: string | null;
  setActiveFilterColumn: (columnId: string | null) => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null
  );

  return (
    <PanelContext.Provider
      value={{
        isFilterSheetOpen,
        setFilterSheetOpen,
        activeFilterColumn,
        setActiveFilterColumn,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function usePanelContext() {
  const context = useContext(PanelContext);
  if (context === undefined) {
    throw new Error("usePanelContext must be used within a PanelProvider");
  }
  return context;
}
