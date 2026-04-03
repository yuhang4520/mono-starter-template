"use client";

import React, { useMemo, useState } from "react";
import { FieldValues, DefaultValues, Path } from "react-hook-form";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  ColumnDef,
  Column,
  OnChangeFn,
} from "@tanstack/react-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "./data-table";
import { PanelToolbar } from "./panel-toolbar";
import { PanelPagination } from "./panel-pagination";
import { PanelForm } from "./panel-form";
import { PanelColumnHeader } from "./panel-column-header";
import { PanelProvider } from "./panel-context";
import { PanelFilterSheet } from "./panel-filter-sheet";
import {
  PanelField,
  PanelColumn,
  FileObject,
  PanelBatchAction,
  PanelRowAction,
} from "./types";
import { Checkbox } from "@/components/ui/checkbox";

interface PanelProps<TData, TFormValues extends FieldValues> {
  title?: string;
  description?: string;
  columns: PanelColumn<TData>[];
  fields: PanelField<TFormValues>[];
  data: TData[];
  isLoading?: boolean;

  onCreate?: (values: TFormValues) => void | Promise<void>;
  onUpdate?: (values: TFormValues, originalRow: TData) => void | Promise<void>;
  onUpload?: (file: File, fieldName: Path<TFormValues>) => Promise<FileObject>;

  batchActions?: PanelBatchAction<TData>[];
  toolbarActions?: React.ReactNode;
  rowActions?: PanelRowAction<TData>[];

  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
  };

  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  onFiltersSheetClosed?: (state: ColumnFiltersState) => void;

  renderRowActions?: (row: TData) => React.ReactNode;
}

export function Panel<TData, TFormValues extends FieldValues>({
  title,
  description,
  columns,
  fields,
  data,
  isLoading = false,
  onCreate,
  onUpdate,
  onUpload,
  batchActions,
  toolbarActions,
  rowActions,
  pagination,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  onFiltersSheetClosed,
  renderRowActions,
}: PanelProps<TData, TFormValues>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TData | null>(null);

  const finalSorting = sorting ?? internalSorting;
  const finalColumnFilters = columnFilters ?? internalColumnFilters;
  const finalOnSortingChange = onSortingChange ?? setInternalSorting;
  const finalOnColumnFiltersChange =
    onColumnFiltersChange ?? setInternalColumnFilters;

  const isManualSorting = !!sorting;
  const isManualFiltering = !!columnFilters;

  // Add selection column
  const tableColumns: ColumnDef<TData>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      ...(columns
        .filter((col) => !col.hidden)
        .map((col) => ({
          enableSorting: false,
          enableHiding: false,
          ...col,
          header:
            typeof col.header === "string"
              ? ({ column }: { column: Column<TData, unknown> }) => (
                  <PanelColumnHeader
                    column={column}
                    title={col.header as string}
                  />
                )
              : col.header,
        })) as ColumnDef<TData>[]),
      {
        id: "actions",
        cell: ({ row }) => {
          const hasActions =
            onUpdate ||
            renderRowActions ||
            (rowActions && rowActions.length > 0);

          if (!hasActions) return null;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {onUpdate && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingItem(row.original);
                      setIsFormOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                )}
                {rowActions?.map((action, index) => {
                  if (action.isVisible && !action.isVisible(row.original))
                    return null;
                  return (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => {
                        if (row.getIsSelected()) {
                          row.toggleSelected(false);
                        }

                        action.onClick(row.original);
                      }}
                      disabled={action.isDisabled?.(row.original)}
                      className={action.className}
                    >
                      {action.icon && <action.icon className="h-4 w-4" />}
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  );
                })}
                {renderRowActions && (
                  <>
                    {(onUpdate || (rowActions && rowActions.length > 0)) && (
                      <DropdownMenuSeparator />
                    )}
                    {renderRowActions(row.original)}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [columns, onUpdate, renderRowActions, rowActions],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: finalOnSortingChange,
    onColumnFiltersChange: finalOnColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting: finalSorting,
      columnFilters: finalColumnFilters,
      columnVisibility,
      rowSelection,
      ...(pagination
        ? {
            pagination: {
              pageIndex: pagination.page - 1,
              pageSize: pagination.pageSize,
            },
          }
        : {}),
    },
    manualPagination: !!pagination,
    manualSorting: isManualSorting,
    manualFiltering: isManualFiltering,
    pageCount: pagination
      ? Math.ceil(pagination.total / pagination.pageSize)
      : -1,
    autoResetPageIndex: false,
  });

  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  const handleAdd = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: TFormValues) => {
    if (editingItem) {
      if (onUpdate) {
        await onUpdate(data, editingItem);
      }
    } else {
      if (onCreate) {
        await onCreate(data);
      }
    }
    setIsFormOpen(false);
  };

  const hasFilters = columns.some((col) => !!col.meta?.filter);

  return (
    <PanelProvider>
      <div className="w-full flex flex-col gap-4">
        {(title || description) && (
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
              )}
              {description && (
                <p className="text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <PanelToolbar
            table={table}
            selectedRows={selectedRows}
            batchActions={batchActions}
            onAdd={onCreate ? handleAdd : undefined}
            hasFilters={hasFilters}
            toolbarActions={toolbarActions}
          />

          <DataTable
            table={table}
            columns={tableColumns}
            isLoading={isLoading}
          />

          {pagination && (
            <PanelPagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={pagination.onPageChange}
              onPageSizeChange={pagination.onPageSizeChange}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          )}
        </div>

        <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
          <SheetContent className="sm:max-w-[540px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {editingItem ? "Edit Item" : "Create Item"}
              </SheetTitle>
              <SheetDescription>
                {editingItem
                  ? "Make changes to the item here. Click save when you're done."
                  : "Fill in the details for the new item. Click save when you're done."}
              </SheetDescription>
            </SheetHeader>
            <div className="grid flex-1 auto-rows-min gap-6 px-4">
              <PanelForm
                fields={fields.filter(
                  (field) => !editingItem || field.updatable !== false,
                )}
                defaultValues={
                  (editingItem ??
                    undefined) as unknown as DefaultValues<TFormValues>
                }
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                onUpload={onUpload}
              />
            </div>
          </SheetContent>
        </Sheet>

        <PanelFilterSheet
          table={table}
          onClosed={() => onFiltersSheetClosed?.(finalColumnFilters)}
        />
      </div>
    </PanelProvider>
  );
}
