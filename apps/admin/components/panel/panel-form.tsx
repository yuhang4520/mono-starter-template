"use client";

import React from "react";
import {
  useForm,
  Resolver,
  FieldValues,
  DefaultValues,
  Controller,
  Path,
  Control,
  useController,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PanelField, FileObject } from "./types";
import { FileUpload } from "./file-upload";
import { Switch } from "../ui/switch";
import { ComboboxField } from "./combobox-field";
import { CascadeField } from "./cascade-field";
import { MultiSelectField } from "./multi-select-field";
import { CheckboxField } from "./checkbox-field";
import { SelectField } from "./select-field";
import { ImagePreview } from "./file-previews";
import { TextListField } from "./text-list-field";
import { CascadeV2Field } from "./cascade-v2-field";

// Helper component to handle error state without triggering full re-render of the list
function ErrorMessage<TFieldValues extends FieldValues>({
  control,
  name,
}: {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
}) {
  const { fieldState } = useController({ control, name });
  return <FieldError errors={[{ message: fieldState.error?.message }]} />;
}

interface PanelFormProps<TFormValues extends FieldValues> {
  fields: PanelField<TFormValues>[];
  defaultValues?: DefaultValues<TFormValues>;
  onSubmit: (data: TFormValues) => Promise<void>;
  onCancel: () => void;
  onUpload?: (file: File, fieldName: Path<TFormValues>) => Promise<FileObject>;
}

export function PanelForm<TFormValues extends FieldValues>({
  fields,
  defaultValues,
  onSubmit,
  onCancel,
  onUpload,
}: PanelFormProps<TFormValues>) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Dynamically build default values and schema from fields
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  const effectiveDefaultValues = (
    defaultValues ? { ...defaultValues } : {}
  ) as Record<string, unknown>;

  fields.forEach((field) => {
    if (field.rules) {
      schemaShape[field.name] = field.rules;
    }

    const fieldName = field.name as string;

    // Apply field-level defaultValue if not already set in defaultValues prop
    if (
      field.defaultValue !== undefined &&
      (effectiveDefaultValues[fieldName] === undefined ||
        effectiveDefaultValues[fieldName] === null)
    ) {
      effectiveDefaultValues[fieldName] = field.defaultValue;
    }

    // Fallback to sensible defaults to prevent uncontrolled input warnings
    if (
      effectiveDefaultValues[fieldName] === undefined ||
      effectiveDefaultValues[fieldName] === null
    ) {
      switch (field.type) {
        case "text":
        case "textarea":
        case "number":
          effectiveDefaultValues[fieldName] = "";
          break;
        case "boolean":
          effectiveDefaultValues[fieldName] = false;
          break;
        case "select":
        case "radio":
          effectiveDefaultValues[fieldName] = "";
          break;
        case "cascade":
        case "multi-select":
        case "checkbox":
          effectiveDefaultValues[fieldName] = [];
          break;
        case "text-list":
          effectiveDefaultValues[fieldName] = [""];
          break;
        case "file":
        case "image":
          effectiveDefaultValues[fieldName] = field.multiple ? [] : undefined;
          break;
        default:
          effectiveDefaultValues[fieldName] = undefined;
      }
    }
  });

  const hasSchema = Object.keys(schemaShape).length > 0;

  const form = useForm<TFormValues>({
    resolver: (hasSchema
      ? zodResolver(z.object(schemaShape))
      : undefined) as Resolver<TFormValues>,
    defaultValues: effectiveDefaultValues as DefaultValues<TFormValues>,
  });

  // Reset form when defaultValues change (e.g. when editing item changes)
  React.useEffect(() => {
    form.reset(effectiveDefaultValues as DefaultValues<TFormValues>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const handleSubmit = async (data: TFormValues) => {
    setIsSubmitting(true);
    try {
      const processedData = { ...data };

      if (onUpload) {
        const uploadPromises: Promise<void>[] = [];

        for (const field of fields) {
          if (field.type === "image" || field.type === "file") {
            const value = processedData[field.name];
            if (!value) continue;

            if (Array.isArray(value)) {
              const newValues = await Promise.all(
                (value as FileObject[]).map(async (item) => {
                  // Check if item is a FileObject with a localFile
                  if (
                    item &&
                    typeof item === "object" &&
                    "localFile" in item &&
                    item.localFile instanceof File
                  ) {
                    return await onUpload(item.localFile, field.name);
                  }
                  return item;
                }),
              );
              processedData[field.name as keyof TFormValues] =
                newValues as never;
            } else if (
              value &&
              typeof value === "object" &&
              "localFile" in value &&
              value.localFile instanceof File
            ) {
              uploadPromises.push(
                (async () => {
                  const uploadedFile = await onUpload(
                    value.localFile,
                    field.name,
                  );
                  processedData[field.name as keyof TFormValues] =
                    uploadedFile as never;
                })(),
              );
            }
          }
        }

        await Promise.all(uploadPromises);
      }

      await onSubmit(processedData);
    } catch (error) {
      console.error("Form submission failed:", error);
      // You might want to set a form error here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {fields.map((field) => {
        const fieldId = `${field.name}-field`;

        // Special case for smart-text-list to prevent focus loss
        // by avoiding the outer Controller re-render loop
        if (field.type === "text-list") {
          return (
            <Field key={field.name}>
              {field.label && (
                <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
              )}
              {field.description && (
                <FieldDescription>{field.description}</FieldDescription>
              )}
              <TextListField
                control={form.control}
                name={field.name as Path<TFormValues>}
                placeholder={field.placeholder}
                maxInputs={field.maxInputs}
                splitUnit={field.splitUnit}
                getUnitCount={field.getUnitCount}
                maxUnitCount={field.maxUnitCount}
              />
              <ErrorMessage control={form.control} name={field.name} />
            </Field>
          );
        }

        return (
          <Controller
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: formField, fieldState, formState }) => {
              const content = (() => {
                if (field.render) {
                  return field.render({
                    field: formField,
                    fieldState,
                    formState,
                  });
                }

                switch (field.type) {
                  case "text":
                    return (
                      <Input
                        id={fieldId}
                        placeholder={field.placeholder}
                        {...formField}
                        value={formField.value ?? ""}
                        minLength={field.min}
                        maxLength={field.max}
                      />
                    );
                  case "textarea":
                    return (
                      <Textarea
                        id={fieldId}
                        placeholder={field.placeholder}
                        {...formField}
                        value={formField.value ?? ""}
                        minLength={field.min}
                        maxLength={field.max}
                      />
                    );
                  case "password":
                    return (
                      <Input
                        id={fieldId}
                        type="password"
                        autoComplete="off"
                        placeholder={field.placeholder}
                        {...formField}
                        value={formField.value ?? ""}
                      />
                    );
                  case "number":
                    const displayValue =
                      field.decode &&
                        formField.value !== undefined &&
                        formField.value !== null
                        ? field.decode(formField.value as number)
                        : formField.value;
                    return (
                      <Input
                        id={fieldId}
                        type="number"
                        placeholder={field.placeholder}
                        {...formField}
                        onChange={(e) => {
                          const value =
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value);
                          const encodedValue =
                            field.encode && value !== undefined
                              ? field.encode(value)
                              : value;
                          formField.onChange(encodedValue);
                        }}
                        value={displayValue ?? ""}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                      />
                    );
                  case "select":
                    return (
                      <SelectField
                        options={field.options}
                        optionsLoader={field.optionsLoader}
                        value={formField.value}
                        onChange={formField.onChange}
                        placeholder={field.placeholder}
                        id={fieldId}
                      />
                    );
                  case "combobox":
                    return (
                      <ComboboxField
                        id={fieldId}
                        options={field.options}
                        optionsLoader={field.optionsLoader}
                        value={formField.value}
                        onChange={formField.onChange}
                        placeholder={field.placeholder}
                      />
                    );
                  case "cascade":
                    return (
                      <CascadeField
                        id={fieldId}
                        options={field.options}
                        optionsLoader={field.optionsLoader}
                        value={formField.value}
                        onChange={formField.onChange}
                        placeholder={field.placeholder}
                      />
                    );
                  case "cascade-v2":
                    return (
                      <CascadeV2Field
                        options={field.options}
                        optionsLoader={field.optionsLoader}
                        value={formField.value}
                        onChange={formField.onChange}
                        placeholder={field.placeholder}
                      />
                    );
                  case "multi-select":
                    return (
                      <MultiSelectField
                        id={fieldId}
                        options={field.options}
                        optionsLoader={field.optionsLoader}
                        value={formField.value}
                        onChange={formField.onChange}
                        placeholder={field.placeholder}
                      />
                    );
                  case "checkbox":
                    return (
                      <CheckboxField
                        options={field.options}
                        value={formField.value}
                        onChange={formField.onChange}
                        orientation={field.orientation}
                      />
                    );
                  case "radio":
                    return (
                      <RadioGroup
                        onValueChange={formField.onChange}
                        value={formField.value ? String(formField.value) : ""}
                        className="flex flex-col space-y-1"
                      >
                        {field.options.map((option) => (
                          <div
                            key={option.value}
                            className="flex items-center space-x-3 space-y-0"
                          >
                            <RadioGroupItem
                              value={String(option.value)}
                              id={`${field.name}-${option.value}`}
                            />
                            <label
                              htmlFor={`${field.name}-${option.value}`}
                              className="font-normal"
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    );
                  case "boolean":
                    return (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={fieldId}
                          checked={!!formField.value}
                          onCheckedChange={formField.onChange}
                        />
                        {field.placeholder && (
                          <label
                            htmlFor={fieldId}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {field.placeholder}
                          </label>
                        )}
                      </div>
                    );
                  case "date":
                  case "date-range": {
                    const isRange = field.type === "date-range";

                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id={fieldId}
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !formField.value && "text-muted-foreground",
                            )}
                          >
                            {isRange ? (
                              formField.value?.from ? (
                                formField.value.to ? (
                                  <>
                                    {format(formField.value.from, "yyyy-MM-dd")}
                                    &nbsp; ~ &nbsp;
                                    {format(formField.value.to, "yyyy-MM-dd")}
                                  </>
                                ) : (
                                  format(formField.value.from, "yyyy-MM-dd")
                                )
                              ) : (
                                <span>Pick a date range</span>
                              )
                            ) : formField.value ? (
                              format(formField.value, "yyyy-MM-dd")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          {isRange ? (
                            <Calendar
                              mode="range"
                              timeZone="UTC"
                              selected={formField.value}
                              onSelect={formField.onChange}
                              disabled={(date) => {
                                if (field.min && date < field.min) return true;
                                if (field.max && date > field.max) return true;
                                return false;
                              }}
                              numberOfMonths={2}
                              startMonth={field.min}
                              endMonth={field.max}
                              autoFocus
                            />
                          ) : (
                            <Calendar
                              mode="single"
                              captionLayout="dropdown"
                              timeZone="UTC"
                              selected={formField.value}
                              onSelect={formField.onChange}
                              disabled={(date) => {
                                if (field.min && date < field.min) return true;
                                if (field.max && date > field.max) return true;
                                return false;
                              }}
                              startMonth={field.min}
                              endMonth={field.max}
                              autoFocus
                            />
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  case "image":
                  case "file":
                    return (
                      <FileUpload
                        value={formField.value}
                        onChange={formField.onChange}
                        accept={
                          field.accept ||
                          (field.type === "image" ? "image/*" : undefined)
                        }
                        multiple={field.multiple}
                        maxFiles={field.maxFiles}
                        previewComponent={
                          field.previewComponent ||
                          (field.type === "image" ? ImagePreview : undefined)
                        }
                      />
                    );
                  default:
                    return null;
                }
              })();

              return (
                <Field key={field.name}>
                  {field.label && (
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                  )}
                  {field.description && (
                    <FieldDescription>{field.description}</FieldDescription>
                  )}
                  {content}
                  <FieldError
                    errors={[{ message: fieldState.error?.message }]}
                  />
                </Field>
              );
            }}
          />
        );
      })}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
