"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2, X, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PanelFieldOption } from "./types";
import React from "react";

interface MultiSelectFieldProps<T extends string | number> {
  options?: PanelFieldOption<T>[];
  optionsLoader?: () => Promise<PanelFieldOption<T>[]>;
  value?: T[];
  onChange?: (value: T[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function MultiSelectField<T extends string | number>({
  options: initialOptions = [],
  optionsLoader,
  value: propValue,
  onChange,
  placeholder = "Select options...",
  className,
  id,
}: MultiSelectFieldProps<T>) {
  const value = Array.isArray(propValue) ? propValue : [];
  const [open, setOpen] = React.useState(false);
  const [internalOptions, setInternalOptions] =
    React.useState<PanelFieldOption<T>[]>(initialOptions);
  const [isLoading, setIsLoading] = React.useState(false);
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
          console.error("Failed to load multi-select options:", error);
        } finally {
          setIsLoading(false);
          setHasLoaded(true);
        }
      };
      fetchOptions();
    }
  }, [open, optionsLoader, hasLoaded, isLoading]);

  const handleUnselect = (optionValue: T) => {
    onChange?.(value.filter((v) => v !== optionValue));
  };

  const handleSelect = (optionValue: T) => {
    if (value.includes(optionValue)) {
      handleUnselect(optionValue);
    } else {
      onChange?.([...value, optionValue]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          aria-haspopup="listbox"
          tabIndex={0}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-10 h-auto cursor-pointer",
            className
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setOpen(true);
            }
          }}
        >
          <div className="flex flex-wrap gap-1">
            {value.length > 0 ? (
              value.map((val) => {
                const option = internalOptions.find((o) => o.value === val);
                return (
                  <Badge
                    key={String(val)}
                    variant="secondary"
                    className="mr-1 mb-1"
                  >
                    {option?.label ?? val}
                    <button
                      type="button"
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUnselect(val);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnselect(val);
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                );
              })
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command className="w-full" id={`${id}-content`}>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                "No results found."
              )}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {internalOptions.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <CommandItem
                    key={String(option.value)}
                    value={String(option.label)}
                    onSelect={() => {
                      handleSelect(option.value);
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
