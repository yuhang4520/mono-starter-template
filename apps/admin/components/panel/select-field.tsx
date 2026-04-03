"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelFieldOption } from "./types";

interface SelectFieldProps<T extends string | number> {
  options?: PanelFieldOption<T>[];
  optionsLoader?: () => Promise<PanelFieldOption<T>[]>;
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function SelectField<T extends string | number>({
  options: initialOptions = [],
  optionsLoader,
  value,
  onChange,
  placeholder = "Select an option...",
  className,
  id,
}: SelectFieldProps<T>) {
  const [internalOptions, setInternalOptions] =
    React.useState<PanelFieldOption<T>[]>(initialOptions);
  const [isLoading, setIsLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  // Sync internal options with initialOptions if optionsLoader is not provided
  React.useEffect(() => {
    if (!optionsLoader) {
      setInternalOptions(initialOptions);
    }
  }, [initialOptions, optionsLoader]);

  // Lazy load options
  React.useEffect(() => {
    if (open && optionsLoader && !hasLoaded && !isLoading) {
      const fetchOptions = async () => {
        setIsLoading(true);
        try {
          const data = await optionsLoader();
          setInternalOptions(data);
        } catch (error) {
          console.error("Failed to load select options:", error);
        } finally {
          setIsLoading(false);
          setHasLoaded(true);
        }
      };
      fetchOptions();
    }
  }, [open, optionsLoader, hasLoaded, isLoading]);

  return (
    <SelectRoot
      open={open}
      onOpenChange={setOpen}
      onValueChange={(val) => {
        // Try to parse number if T includes number
        // For string values that are numbers, we might need more careful handling
        // but for now, we follow the common pattern.
        const parsedValue =
          typeof value === "number" || (!isNaN(Number(val)) && val !== "")
            ? Number(val)
            : val;
        onChange?.(parsedValue as T);
      }}
      value={value !== undefined && value !== null ? String(value) : ""}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isLoading && internalOptions.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : internalOptions.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            No options found.
          </div>
        ) : (
          internalOptions.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </SelectRoot>
  );
}
