import React, { memo, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Control,
  useFieldArray,
  Controller,
  FieldValues,
  Path,
  FieldArrayPath,
  FieldArray,
} from "react-hook-form";

interface TextListFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  placeholder?: string;
  maxInputs?: number;
  splitUnit?: (text: string, maxUnitCount?: number) => string[] | null;
  getUnitCount?: (text: string) => number;
  maxUnitCount?: number;
  className?: string;
  error?: string;
}

export const TextListField = memo(function TextListField<
  T extends FieldValues,
>({
  control,
  name,
  placeholder,
  maxInputs,
  splitUnit,
  getUnitCount,
  maxUnitCount,
  className,
}: TextListFieldProps<T>) {
  // Safely cast to FieldArrayPath to use useFieldArray internally
  const fieldArrayName = name as unknown as FieldArrayPath<T>;
  const { fields, append, remove, update, insert } = useFieldArray<T>({
    control,
    name: fieldArrayName,
  });

  const handleInputChange = useCallback(
    (index: number, text: string): boolean => {
      if (!splitUnit) return false;

      const segments = splitUnit(text, maxUnitCount);
      if (segments && segments.length > 1) {
        // Respect maxInputs
        let finalSegments = segments;
        if (maxInputs && fields.length + segments.length - 1 > maxInputs) {
          const allowedAdditional = maxInputs - fields.length;
          if (allowedAdditional <= 0) {
            // Already at limit, let the standard field.onChange handle it
            return false;
          }
          finalSegments = segments.slice(0, allowedAdditional);
          // Append everything else to the last allowed segment
          finalSegments.push(segments.slice(allowedAdditional).join(" "));
        }

        // Apply structural updates
        update(
          index,
          finalSegments[0] as unknown as FieldArray<T, FieldArrayPath<T>>,
        );

        insert(
          index + 1,
          finalSegments.slice(1) as unknown as FieldArray<
            T,
            FieldArrayPath<T>
          >[],
          {
            focusName: `${name}.${index + finalSegments.length - 1}`,
          },
        );

        return true;
      }
      return false;
    },
    [splitUnit, maxUnitCount, maxInputs, fields.length, update, insert, name],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2 group">
          <Controller
            control={control}
            name={`${name}.${index}` as Path<T>}
            render={({ field: { ref, ...controllerField } }) => {
              const unitCount = getUnitCount
                ? getUnitCount(controllerField.value || "")
                : 0;
              const isOverLimit = maxUnitCount
                ? unitCount > maxUnitCount
                : false;

              const handleFocus = (
                e: React.FocusEvent<HTMLTextAreaElement>,
              ) => {
                // Move cursor to the end on focus
                const val = e.target.value;
                e.target.setSelectionRange(val.length, val.length);
              };

              return (
                <div className="relative flex-1">
                  <Textarea
                    {...controllerField}
                    ref={ref}
                    onFocus={handleFocus}
                    onChange={(e) => {
                      const val = e.target.value;
                      const wasSplit = handleInputChange(index, val);
                      // ONLY call field.onChange if no split happened.
                      if (!wasSplit) {
                        controllerField.onChange(e);
                      }
                    }}
                    placeholder={placeholder || `Item ${index + 1}`}
                    className={cn("flex-1 min-h-20", getUnitCount && "pb-6")}
                  />
                  {getUnitCount && maxUnitCount && (
                    <div
                      className={cn(
                        "absolute bottom-2 right-3 text-xs pointer-events-none select-none transition-colors",
                        isOverLimit
                          ? "text-destructive font-medium"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {unitCount} / {maxUnitCount}
                    </div>
                  )}
                </div>
              );
            }}
          />
          {fields.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => remove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {maxInputs && fields.length < maxInputs && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() =>
            append("" as unknown as FieldArray<T, FieldArrayPath<T>>)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      )}
    </div>
  );
}) as <T extends FieldValues>(
  props: TextListFieldProps<T>,
) => React.ReactElement;
