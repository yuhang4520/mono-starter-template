"use client";

import { Table } from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { usePanelContext } from "./panel-context";
import { PanelColumn, DateRange } from "./types";

interface PanelFilterSheetProps<TData> {
  table: Table<TData>;
  onClosed?: () => void;
}

export function PanelFilterSheet<TData>({
  table,
  onClosed,
}: PanelFilterSheetProps<TData>) {
  const { isFilterSheetOpen, setFilterSheetOpen, activeFilterColumn } =
    usePanelContext();

  const filterableColumns = table.getAllColumns().filter((column) => {
    const meta = column.columnDef.meta as PanelColumn<TData>["meta"];
    return !!meta?.filter;
  });

  return (
    <Sheet
      open={isFilterSheetOpen}
      onOpenChange={(open) => {
        setFilterSheetOpen(open);
        if (!open) {
          onClosed?.();
        }
      }}
    >
      <SheetContent className="w-full sm:w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Refine your results using the filters below.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 auto-rows-min gap-6 px-4">
          {filterableColumns.map((column) => {
            const meta = column.columnDef.meta as PanelColumn<TData>["meta"];
            const filter = meta?.filter;
            const filterValue = column.getFilterValue();
            const isActive = column.id === activeFilterColumn;

            if (!filter) return null;

            return (
              <div
                key={column.id}
                className={cn(
                  "space-y-2 p-4 rounded-lg border transition-colors",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-border"
                )}
                id={`filter-${column.id}`}
              >
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {filter.label || (column.columnDef.header as string)}
                  </label>
                  {filterValue !== undefined && filterValue !== "" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => column.setFilterValue(undefined)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Clear filter</span>
                    </Button>
                  )}
                </div>

                {filter.type === "text" && (
                  <Input
                    placeholder={`Filter by ${filter.label || column.id}...`}
                    value={(filterValue as string) ?? ""}
                    onChange={(event) =>
                      column.setFilterValue(event.target.value)
                    }
                  />
                )}

                {filter.type === "select" && (
                  <Select
                    value={(filterValue as string) ?? "all"}
                    onValueChange={(value) =>
                      column.setFilterValue(value === "all" ? undefined : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filter.options?.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {filter.type === "date" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !filterValue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterValue ? (
                          format(filterValue as Date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filterValue as Date}
                        onSelect={(date) => column.setFilterValue(date)}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {filter.type === "date-range" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !filterValue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterValue ? (
                          (filterValue as DateRange).to ? (
                            <>
                              {format(
                                (filterValue as DateRange).from,
                                "LLL dd, y"
                              )}{" "}
                              -{" "}
                              {format(
                                (filterValue as DateRange).to!,
                                "LLL dd, y"
                              )}
                            </>
                          ) : (
                            format((filterValue as DateRange).from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Calendar
                        autoFocus
                        mode="range"
                        defaultMonth={(filterValue as DateRange)?.from}
                        selected={filterValue as DateRange}
                        onSelect={(range) => column.setFilterValue(range)}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              table.resetColumnFilters();
            }}
          >
            Reset All
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
