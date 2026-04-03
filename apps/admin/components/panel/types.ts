import { ColumnDef, Table as ReactTable } from "@tanstack/react-table";
import {
  FieldValues,
  Path,
  ControllerRenderProps,
  ControllerFieldState,
  FormState,
  PathValue,
} from "react-hook-form";
import { z } from "zod";
import { FilePreviewProps } from "./file-previews";

export interface DateRange {
  from: Date;
  to?: Date;
}

export type PanelColumnFilterType = "text" | "select" | "date" | "date-range";

export interface PanelColumnFilterOption {
  label: string;
  value: string | number;
}

export type PanelColumn<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  hidden?: boolean;
  meta?: {
    filter?: {
      type: PanelColumnFilterType;
      options?: PanelColumnFilterOption[];
      label?: string;
    };
  };
};

export interface FileObject {
  objectKey?: string;
  previewUrl: string;
  name: string;
  type: string;
  size: number;
  localFile?: File;
}

export type FileValue = FileObject | FileObject[] | undefined | null;

export interface PanelFieldOption<T = string | number> {
  label: string;
  value: T;
  children?: PanelFieldOption<T>[];
  media?: FileObject[];
}

type ElementType<T> = T extends (infer U)[] ? U : T;
type BaseElementType<T> = T extends (infer U)[] ? BaseElementType<U> : T;

export type PanelFieldConfig<
  TFormValues extends FieldValues,
  TPath extends Path<TFormValues>,
> = {
  name: TPath;
  label: string;
  placeholder?: string;
  description?: string;
  rules?: z.ZodTypeAny;
  defaultValue?: unknown;
  render?: (props: {
    field: ControllerRenderProps<TFormValues, TPath>;
    fieldState: ControllerFieldState;
    formState: FormState<TFormValues>;
  }) => React.ReactNode;
  updatable?: boolean;
} & (
    | { type: "text" | "textarea" | "password"; min?: number; max?: number }
    | {
      type: "number";
      min?: number;
      max?: number;
      step?: number;
      /**
       * decode the raw value for display
       *
       * @param value raw value
       * @returns for display
       */
      decode?: (value: number) => number;
      /**
       * encode the edited value for storage
       *
       * @param value decoded value
       * @returns for storage
       */
      encode?: (value: number) => number;
    }
    | { type: "date" | "date-range"; min?: Date; max?: Date }
    | {
      type: "select";
      options?: PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[];
      optionsLoader?: () => Promise<
        PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[]
      >;
    }
    | {
      type: "radio";
      options: PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[];
    }
    | {
      type: "multi-select";
      options?: PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[];
      optionsLoader?: () => Promise<
        PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[]
      >;
    }
    | {
      type: "checkbox";
      options: PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[];
      orientation?: "horizontal" | "vertical";
    }
    | { type: "boolean" }
    | {
      type: "cascade" | "combobox";
      options?: PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[];
      optionsLoader?: (
        ...args: ElementType<PathValue<TFormValues, TPath>>[]
      ) => Promise<
        PanelFieldOption<ElementType<PathValue<TFormValues, TPath>>>[]
      >;
    }
    | {
      type: "cascade-v2";
      options?: PanelFieldOption<BaseElementType<PathValue<TFormValues, TPath>>>[];
      optionsLoader?: (
        ...args: BaseElementType<PathValue<TFormValues, TPath>>[]
      ) => Promise<PanelFieldOption<BaseElementType<PathValue<TFormValues, TPath>>>[]>;
      // Note: the inferred form value should be BaseElementType<PathValue<TFormValues, TPath>>[][]
    }
    | {
      type: "image" | "file";
      accept?: string;
      multiple?: boolean;
      maxFiles?: number;
      previewComponent?: React.ComponentType<FilePreviewProps>;
    }
    | { type: "custom" }
    | {
      type: "text-list";
      maxInputs?: number;
      splitUnit?: (text: string, maxUnitCount?: number) => string[] | null;
      getUnitCount?: (text: string) => number;
      maxUnitCount?: number;
    }
  );

export type PanelField<TFormValues extends FieldValues> = {
  [K in Path<TFormValues>]: PanelFieldConfig<TFormValues, K>;
}[Path<TFormValues>];

export interface PanelBatchAction<TData> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  onClick: (rows: TData[], table: ReactTable<TData>) => void | Promise<void>;
  variant?:
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
}

export interface PanelRowAction<TData> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: TData) => void | Promise<void>;
  className?: string;
  isVisible?: (row: TData) => boolean;
  isDisabled?: (row: TData) => boolean;
}
