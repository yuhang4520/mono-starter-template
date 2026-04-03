"use client";

import React, { useState } from "react";
import { FileIcon, FileAudio, FileVideo } from "lucide-react";
import { FileObject } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

export interface FilePreviewProps {
  file: FileObject;
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

interface PreviewBaseProps extends FilePreviewProps {
  children: React.ReactNode;
  defaultThumbnail: React.ReactNode;
  dialogContentClassName?: string;
  title?: string;
  description?: string;
}

function PreviewBase({
  trigger,
  onOpenChange,
  children,
  defaultThumbnail,
  dialogContentClassName = "max-w-3xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none",
  title = "File Preview",
  description,
}: PreviewBaseProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const dialog = (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={dialogContentClassName}>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {trigger ? (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenChange(true);
          }}
          className="cursor-pointer h-full flex items-center"
        >
          {trigger}
        </div>
      ) : (
        <div
          className="cursor-pointer w-full h-full"
          onClick={() => handleOpenChange(true)}
        >
          {defaultThumbnail}
        </div>
      )}

      {trigger ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {dialog}
        </div>
      ) : (
        dialog
      )}
    </>
  );
}

export function ImagePreview(props: FilePreviewProps) {
  return (
    <PreviewBase
      {...props}
      title="Image Preview"
      description={props.file.name}
      defaultThumbnail={
        <picture>
          <img
            src={props.file.previewUrl}
            alt={props.file.name}
            className="w-full h-full object-cover transition-transform hover:scale-105"
          />
        </picture>
      }
    >
      <picture>
        <img
          src={props.file.previewUrl}
          alt={props.file.name}
          className="w-full h-auto max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
      </picture>
    </PreviewBase>
  );
}

export function VideoPreview(props: FilePreviewProps) {
  return (
    <PreviewBase
      {...props}
      title="Video Preview"
      description={props.file.name}
      defaultThumbnail={
        <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-muted">
          <FileVideo className="w-8 h-8 mb-2 text-muted-foreground" />
          <span className="text-xs text-center text-muted-foreground truncate w-full px-2">
            {props.file.name}
          </span>
        </div>
      }
    >
      <video
        src={props.file.previewUrl}
        className="w-full h-auto max-h-[90vh] rounded-lg shadow-2xl"
        controls
        autoPlay
      />
    </PreviewBase>
  );
}

export function AudioPreview(props: FilePreviewProps) {
  return (
    <PreviewBase
      {...props}
      title="Audio Preview"
      description={props.file.name}
      defaultThumbnail={
        <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-muted">
          <FileAudio className="w-8 h-8 mb-2 text-muted-foreground" />
          <span className="text-xs text-center text-muted-foreground truncate w-full px-2">
            {props.file.name}
          </span>
        </div>
      }
    >
      <audio src={props.file.previewUrl} controls autoPlay className="w-full" />
    </PreviewBase>
  );
}

export function GenericFilePreview({ file, trigger }: FilePreviewProps) {
  return trigger ? (
    <div className="h-full flex items-center">{trigger}</div>
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-muted">
      <FileIcon className="w-8 h-8 mb-2 text-muted-foreground" />
      <span className="text-xs text-center text-muted-foreground truncate w-full px-2">
        {file.name}
      </span>
    </div>
  );
}
