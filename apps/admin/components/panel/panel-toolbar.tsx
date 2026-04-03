import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import { PanelBatchAction } from "./types";
import { usePanelContext } from "./panel-context";
import { Table as ReactTable } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface PanelToolbarProps<TData> {
  table: ReactTable<TData>;
  selectedRows: TData[];
  batchActions?: PanelBatchAction<TData>[];
  onAdd?: () => void;
  toolbarActions?: React.ReactNode;
  hasFilters?: boolean;
}

export function PanelToolbar<TData>({
  table,
  selectedRows,
  batchActions,
  onAdd,
  toolbarActions,
  hasFilters,
}: PanelToolbarProps<TData>) {
  const { setFilterSheetOpen } = usePanelContext();
  const hasSelection = selectedRows.length > 0;

  if (!hasSelection && !hasFilters && !toolbarActions && !onAdd) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-1">
      <div className="flex items-center gap-2">
        {hasSelection ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRows.length} selected
            </span>
            {batchActions?.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "outline"}
                size="sm"
                onClick={() => action.onClick(selectedRows, table)}
              >
                {action.icon && (
                  <action.icon className={cn("h-4 w-4", action.iconClass)} />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterSheetOpen(true)}
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        )}
        {toolbarActions}
        {onAdd && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        )}
      </div>
    </div>
  );
}
