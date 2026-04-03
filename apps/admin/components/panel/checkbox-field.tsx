"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PanelFieldOption } from "./types";

interface CheckboxFieldProps<T extends string | number> {
  options: PanelFieldOption<T>[];
  value?: T[];
  onChange?: (value: T[]) => void;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export function CheckboxField<T extends string | number>({
  options,
  value: propValue,
  onChange,
  className,
  orientation = "vertical",
}: CheckboxFieldProps<T>) {
  const value = Array.isArray(propValue) ? propValue : [];
  const handleToggle = (optionValue: T, checked: boolean) => {
    if (checked) {
      onChange?.([...value, optionValue]);
    } else {
      onChange?.(value.filter((v) => v !== optionValue));
    }
  };

  return (
    <div
      className={cn(
        "flex gap-4",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
        className
      )}
    >
      {options.map((option) => {
        const id = `checkbox-${String(option.value)}`;
        const isSelected = value.includes(option.value);

        return (
          <div
            key={String(option.value)}
            className="flex items-center space-x-2"
          >
            <Checkbox
              id={id}
              checked={isSelected}
              onCheckedChange={(checked) =>
                handleToggle(option.value, !!checked)
              }
            />
            <Label
              htmlFor={id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
