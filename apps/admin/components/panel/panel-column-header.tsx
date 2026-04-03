import React from "react";
import { Column } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  EyeOff,
  Filter,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePanelContext } from "./panel-context";
import { PanelColumn } from "./types";

interface PanelColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function PanelColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: PanelColumnHeaderProps<TData, TValue>) {
  const { setFilterSheetOpen, setActiveFilterColumn } = usePanelContext();
  const meta = column.columnDef.meta as PanelColumn<TData>["meta"];
  const hasFilter = !!meta?.filter;
  const isFiltered = column.getIsFiltered();

  if (!column.getCanSort() && !column.getCanHide() && !hasFilter) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-0", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : isFiltered ? (
              <Filter className="ml-2 h-4 w-4 text-primary" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {column.getCanSort() && (
            <>
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Asc
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Desc
              </DropdownMenuItem>
            </>
          )}
          {column.getCanSort() && (hasFilter || column.getCanHide()) && (
            <DropdownMenuSeparator />
          )}
          {hasFilter && (
            <DropdownMenuItem
              onClick={() => {
                setActiveFilterColumn(column.id);
                setFilterSheetOpen(true);
              }}
            >
              <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
              Filter
            </DropdownMenuItem>
          )}
          {(column.getCanSort() || hasFilter) && column.getCanHide() && (
            <DropdownMenuSeparator />
          )}
          {column.getCanHide() && (
            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
              <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
              Hide
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
