"use client";

import * as React from "react";
import {
  ChevronsUpDown,
  ChevronRight,
  X,
  Loader2,
  FileIcon,
  FileAudio,
  Video,
  ImageIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { PanelFieldOption } from "./types";
import { AudioPreview, ImagePreview, VideoPreview } from "./file-previews";

interface CascadeFieldProps<T extends string | number> {
  options?: PanelFieldOption<T>[];
  optionsLoader?: (...args: T[]) => Promise<PanelFieldOption<T>[]>;
  value?: T[];
  onChange?: (value: T[]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function CascadeField<T extends string | number>({
  options: initialOptions = [],
  optionsLoader,
  value: propValue,
  onChange,
  placeholder = "Select options...",
  className,
  id,
}: CascadeFieldProps<T>) {
  const value = Array.isArray(propValue) ? propValue : [];
  const [open, setOpen] = React.useState(false);
  const [activePath, setActivePath] = React.useState<PanelFieldOption<T>[]>([]);
  const [internalOptions, setInternalOptions] =
    React.useState<PanelFieldOption<T>[]>(initialOptions);
  const [loadingValues, setLoadingValues] = React.useState<Set<T>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const getMediaIcon = (type: string) => {
    if (type.startsWith("image")) return <ImageIcon className="h-3 w-3" />;
    if (type.startsWith("video")) return <Video className="h-3 w-3" />;
    if (type.startsWith("audio")) return <FileAudio className="h-3 w-3" />;
    return <FileIcon className="h-3 w-3" />;
  };

  // Sync internal options with initialOptions if optionsLoader is not provided
  React.useEffect(() => {
    if (!optionsLoader) {
      setInternalOptions(initialOptions);
    }
  }, [initialOptions, optionsLoader]);

  // Initial load
  React.useEffect(() => {
    if (open && optionsLoader && !hasLoaded && !isInitialLoading) {
      const fetchRoot = async () => {
        setIsInitialLoading(true);
        try {
          const data = await optionsLoader();
          setInternalOptions(data);
        } catch (error) {
          console.error("Failed to load root cascader options:", error);
        } finally {
          setIsInitialLoading(false);
          setHasLoaded(true);
        }
      };
      fetchRoot();
    }
  }, [open, optionsLoader, hasLoaded, isInitialLoading]);

  const updateOptions = (
    opts: PanelFieldOption<T>[],
    parentValue: T | undefined,
    children: PanelFieldOption<T>[]
  ): PanelFieldOption<T>[] => {
    if (parentValue === undefined) return children;
    return opts.map((opt) => {
      if (opt.value === parentValue) {
        return { ...opt, children };
      }
      if (opt.children) {
        return {
          ...opt,
          children: updateOptions(opt.children, parentValue, children),
        };
      }
      return opt;
    });
  };

  const handleLoadChildren = async (
    option: PanelFieldOption<T>,
    fullPath: PanelFieldOption<T>[]
  ) => {
    if (
      !optionsLoader ||
      !Array.isArray(option.children) ||
      option.children.length > 0
    )
      return;

    const val = option.value;
    const pathValues = fullPath.map((o) => o.value);
    setLoadingValues((prev) => new Set(prev).add(val));
    try {
      const children = await optionsLoader(...pathValues);
      setInternalOptions((prev) => updateOptions(prev, val, children));

      // Update active path if the loaded option is still in the path
      setActivePath((prev) => {
        const index = prev.findIndex((o) => o.value === option.value);
        if (index !== -1) {
          const newPath = [...prev];
          newPath[index] = { ...option, children };
          return newPath;
        }
        return prev;
      });
    } catch (error) {
      console.error(`Failed to load children for ${val}:`, error);
    } finally {
      setLoadingValues((prev) => {
        const next = new Set(prev);
        next.delete(val);
        return next;
      });
    }
  };

  const handleSelect = (optionValue: T, checked: boolean) => {
    const newValue = checked
      ? [...value, optionValue]
      : value.filter((v) => v !== optionValue);
    onChange?.(newValue);
  };

  const isSelected = (optionValue: T) => value.includes(optionValue);

  const getOptionLabel = (
    val: T,
    opts: PanelFieldOption<T>[]
  ): string | undefined => {
    for (const opt of opts) {
      if (opt.value === val) return opt.label;
      if (opt.children) {
        const label = getOptionLabel(val, opt.children);
        if (label) return label;
      }
    }
    return undefined;
  };

  const renderColumn = (
    opts: PanelFieldOption<T>[],
    depth: number,
    isLoading?: boolean
  ) => {
    if (isLoading) {
      return (
        <div className="h-72 min-w-48 max-w-[24rem] border-r last:border-r-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (opts.length === 0) {
      return (
        <div className="h-72 min-w-48 max-w-[24rem] border-r last:border-r-0 flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
          No options available
        </div>
      );
    }

    return (
      <ScrollArea className="h-72 min-w-48 max-w-[24rem] w-auto border-r last:border-r-0">
        <div className="p-2 space-y-1">
          {opts.map((option) => {
            const isCategory = Array.isArray(option.children);
            const isActive = activePath[depth]?.value === option.value;
            const isNodeLoading = loadingValues.has(option.value);

            return (
              <div
                key={String(option.value)}
                className={cn(
                  "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer group/item",
                  isActive && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  const newPath = activePath.slice(0, depth);
                  if (isCategory) {
                    newPath.push(option);
                    setActivePath(newPath);
                    handleLoadChildren(option, newPath);
                  } else {
                    setActivePath(newPath);
                    handleSelect(option.value, !isSelected(option.value));
                  }
                }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {!isCategory && (
                    <Checkbox
                      id={`cascade-${String(option.value)}`}
                      checked={isSelected(option.value)}
                      onCheckedChange={(checked) =>
                        handleSelect(option.value, checked as boolean)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <span className="text-wrap flex-1" title={option.label}>
                    {option.label}
                  </span>
                  {option.media && (
                    <div className="flex items-center gap-1 shrink-0 px-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      {(Array.isArray(option.media)
                        ? option.media
                        : [option.media]
                      ).map((m, i) => {
                        const icon = (
                          <div
                            role="button"
                            tabIndex={0}
                            className="p-0.5 hover:bg-accent-foreground/10 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                            title={`Preview ${m.name}`}
                          >
                            {getMediaIcon(m.type)}
                          </div>
                        );

                        if (m.type.startsWith("image")) {
                          return (
                            <ImagePreview
                              key={i}
                              file={m}
                              trigger={icon}
                              onOpenChange={setIsPreviewOpen}
                            />
                          );
                        }
                        if (m.type.startsWith("video")) {
                          return (
                            <VideoPreview
                              key={i}
                              file={m}
                              trigger={icon}
                              onOpenChange={setIsPreviewOpen}
                            />
                          );
                        }
                        if (m.type.startsWith("audio")) {
                          return (
                            <AudioPreview
                              key={i}
                              file={m}
                              trigger={icon}
                              onOpenChange={setIsPreviewOpen}
                            />
                          );
                        }
                        return <div key={i}>{icon}</div>;
                      })}
                    </div>
                  )}
                </div>
                {isCategory &&
                  (isNodeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v && isPreviewOpen) return;
        setOpen(v);
      }}
      modal
    >
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-controls={id}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer min-h-10 h-auto",
            className
          )}
        >
          <div className="flex flex-wrap gap-1">
            {value.length > 0 ? (
              value.map((val) => (
                <Badge
                  key={val}
                  variant="secondary"
                  className="px-4 py-1 flex gap-1 bg-secondary/50 hover:bg-secondary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                >
                  <span className="text-wrap flex-1">
                    {getOptionLabel(val, internalOptions) || val}
                  </span>
                  <div
                    role="button"
                    tabIndex={0}
                    className="ml-1 ring-offset-background rounded-full outline-none cursor-pointer hover:bg-background/50 p-0.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSelect(val, false);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(val, false);
                    }}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </div>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        id={id}
        className="w-auto p-0 max-w-[calc(100vw-2rem)] overflow-x-auto"
        align="start"
      >
        <div className="flex flex-row">
          {renderColumn(internalOptions, 0, isInitialLoading)}
          {activePath.map((option, index) => {
            const isLoading = loadingValues.has(option.value as T);
            return (
              <React.Fragment key={option.value}>
                {(option.children || isLoading) &&
                  renderColumn(option.children || [], index + 1, isLoading)}
              </React.Fragment>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
