"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { PanelFieldOption } from "./types";

interface ComboboxFieldProps<T extends string | number> {
  options?: PanelFieldOption<T>[];
  optionsLoader?: (keyword: T) => Promise<PanelFieldOption<T>[]>;
  value?: T;
  onChange?: (value: T | undefined) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

export function ComboboxField<T extends string | number>({
  options: initialOptions = [],
  optionsLoader,
  value,
  onChange,
  placeholder,
  id,
  disabled,
}: ComboboxFieldProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] =
    React.useState<PanelFieldOption<T>[]>(initialOptions);

  const handleSearch = React.useCallback(
    async (keyword: T) => {
      setLoading(true);
      try {
        const options = await optionsLoader?.(keyword);
        setOptions(options ?? []);
      } finally {
        setLoading(false);
      }
    },
    [optionsLoader]
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild id={id}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="justify-between"
        >
          {value
            ? options.find((option) => option.value == value)?.label
            : "Select an option"}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={keyword}
            disabled={loading}
            onValueChange={setKeyword}
            onKeyUp={(event) => {
              if (event.key === "Enter") {
                // TODO: avoid forces type convert
                handleSearch(keyword as T);
              }
            }}
            placeholder={placeholder}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value.toString()}
                  onSelect={() => {
                    onChange?.(
                      value === option.value ? undefined : option.value
                    );
                    setOpen(false);
                  }}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
