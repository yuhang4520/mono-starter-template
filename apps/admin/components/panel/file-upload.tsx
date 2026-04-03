"use client";

import React, { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload } from "lucide-react";
import { FileObject } from "./types";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FilePreviewProps, GenericFilePreview } from "./file-previews";

interface FileUploadProps {
  value?: FileObject | FileObject[];
  onChange?: (value: FileObject | FileObject[] | undefined | null) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  previewComponent?: React.ComponentType<FilePreviewProps>;
}

export function FileUpload({
  value,
  onChange,
  accept,
  multiple,
  maxFiles,
  className,
  previewComponent: PreviewComponent = GenericFilePreview,
}: FileUploadProps) {
  const files = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  const canAddMore = multiple
    ? maxFiles
      ? files.length < maxFiles
      : true
    : files.length === 0;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!multiple && acceptedFiles.length > 1) {
        toast.error("You can only upload one file at a time.");
        return;
      }

      if (maxFiles && files.length + acceptedFiles.length > maxFiles) {
        toast.error(`You can only upload up to ${maxFiles} files.`);
        return;
      }

      const newFiles: FileObject[] = acceptedFiles.map((file) => ({
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
        size: file.size,
        localFile: file,
      }));

      if (multiple) {
        onChange?.([...files, ...newFiles]);
      } else {
        onChange?.(newFiles[0]);
      }
    },
    [multiple, maxFiles, files, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    multiple: multiple,
    maxFiles: maxFiles,
    disabled: !canAddMore,
    onDropRejected: (fileRejections) => {
      if (fileRejections.length > 0) {
        const errors = fileRejections
          .map((r) => r.errors.map((e) => e.message).join(", "))
          .join("; ");
        toast.error(`File upload failed: ${errors}`);
      }
    },
  });

  const handleRemove = (index: number) => {
    if (multiple) {
      const newFiles = files.filter((_, i) => i !== index);
      onChange?.(newFiles.length > 0 ? newFiles : []);
    } else {
      onChange?.(null);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map((file, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border bg-background shadow-sm"
            >
              <PreviewComponent file={file} />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-70 group-hover:opacity-100 transition-opacity z-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove(index);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="p-4 rounded-full bg-muted/50">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive
                ? "Drop the files here"
                : "Drag & drop files here, or click to select"}
            </p>
            <p className="text-xs text-muted-foreground">
              {accept ? `Accepted formats: ${accept}` : "All files accepted"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
