"use client";

import * as React from "react";
import { ChevronsUpDown, ChevronRight, Loader2, Image as ImageIcon, Video, FileAudio, FileIcon } from "lucide-react";

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
import { ImagePreview, VideoPreview, AudioPreview } from "./file-previews";

interface CascadeV2FieldProps<T extends string | number> {
    options?: PanelFieldOption<T>[];
    optionsLoader?: (...args: T[]) => Promise<PanelFieldOption<T>[]>;
    value?: T[][];
    onChange?: (value: T[][]) => void;
    placeholder?: string;
    className?: string;
}

export function CascadeV2Field<T extends string | number>({
    options: initialOptions = [],
    optionsLoader,
    value: propValue,
    onChange,
    placeholder = "Select options...",
    className,
}: CascadeV2FieldProps<T>) {
    const value = Array.isArray(propValue) ? propValue : [];
    const [open, setOpen] = React.useState(false);
    const [activePath, setActivePath] = React.useState<PanelFieldOption<T>[]>([]);
    const [internalOptions, setInternalOptions] = React.useState<PanelFieldOption<T>[]>(initialOptions);
    const [loadingValues, setLoadingValues] = React.useState<Set<T>>(new Set());
    const [loadedValues, setLoadedValues] = React.useState<Set<T | "ROOT">>(new Set());
    const [failedValues, setFailedValues] = React.useState<Set<T | "ROOT">>(new Set());
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const valueRef = React.useRef(value);
    React.useEffect(() => {
        valueRef.current = value;
    }, [value]);

    const findPath = React.useCallback((opts: PanelFieldOption<T>[], target: T, currentPath: PanelFieldOption<T>[] = []): PanelFieldOption<T>[] | null => {
        for (const opt of opts) {
            const path = [...currentPath, opt];
            if (opt.value === target) return path;
            if (opt.children) {
                const res = findPath(opt.children, target, path);
                if (res) return res;
            }
        }
        return null;
    }, []);

    const getMediaIcon = (type: string) => {
        if (type.startsWith("image/")) return <ImageIcon className="h-3 w-3" />;
        if (type.startsWith("video/")) return <Video className="h-3 w-3" />;
        if (type.startsWith("audio/")) return <FileAudio className="h-3 w-3" />;
        return <FileIcon className="h-3 w-3" />;
    };

    const id = React.useId();

    // Reset root loading state when closed only if we don't have data yet
    React.useEffect(() => {
        if (!open) {
            if (internalOptions.length === 0) {
                setLoadedValues(prev => {
                    if (!prev.has("ROOT")) return prev;
                    const next = new Set(prev);
                    next.delete("ROOT");
                    return next;
                });
                setFailedValues(prev => {
                    if (!prev.has("ROOT")) return prev;
                    const next = new Set(prev);
                    next.delete("ROOT");
                    return next;
                });
            }
        }
    }, [open, internalOptions.length]);

    // Sync internal options with initialOptions if optionsLoader is not provided
    React.useEffect(() => {
        if (!optionsLoader) {
            setInternalOptions(prev => {
                if (prev === initialOptions) return prev;
                // Also shallow compare to prevent infinite loops if parent recreates array
                if (prev.length === initialOptions.length && prev.every((v, i) => v === initialOptions[i])) return prev;
                return initialOptions;
            });
        }
    }, [initialOptions, optionsLoader]);

    // Initial load
    React.useEffect(() => {
        if (open && optionsLoader && !loadedValues.has("ROOT") && !isInitialLoading && internalOptions.length === 0) {
            const fetchRoot = async () => {
                setIsInitialLoading(true);
                setFailedValues(prev => {
                    const next = new Set(prev);
                    next.delete("ROOT");
                    return next;
                });
                try {
                    const data = await optionsLoader();
                    setInternalOptions(data);
                } catch (error) {
                    console.error("Failed to load root cascadeV2Field options:", error);
                    setFailedValues(prev => prev.has("ROOT") ? prev : new Set(prev).add("ROOT"));
                } finally {
                    setIsInitialLoading(false);
                    setLoadedValues(prev => prev.has("ROOT") ? prev : new Set(prev).add("ROOT"));
                }
            };
            fetchRoot();
        }
    }, [open, optionsLoader, loadedValues, isInitialLoading, internalOptions.length]);

    const updateOptions = (opts: PanelFieldOption<T>[], parentValue: T | undefined, children: PanelFieldOption<T>[]): PanelFieldOption<T>[] => {
        if (parentValue === undefined) return children;
        return opts.map((opt) =>
            opt.value === parentValue ? { ...opt, children } :
                opt.children ? { ...opt, children: updateOptions(opt.children, parentValue, children) } : opt
        );
    };

    const handleLoadChildren = async (option: PanelFieldOption<T>, fullPath: PanelFieldOption<T>[]) => {
        if (!optionsLoader || loadingValues.has(option.value)) return;

        // Only load if not loaded, or if it failed, or if it's empty
        const hasData = Array.isArray(option.children) && option.children.length > 0;
        if (hasData && !failedValues.has(option.value)) return;

        const val = option.value;
        const pathValues = fullPath.map(o => o.value);
        setLoadingValues((prev) => prev.has(val) ? prev : new Set(prev).add(val));
        setFailedValues((prev) => {
            if (!prev.has(val)) return prev;
            const next = new Set(prev);
            next.delete(val);
            return next;
        });

        try {
            const children = await optionsLoader(...pathValues);
            setInternalOptions((prev) => updateOptions(prev, val, children));

            // Update active path if the loaded option is still in the path
            setActivePath((prev) => {
                const index = prev.findIndex(o => o.value === option.value);
                if (index !== -1) {
                    const newPath = [...prev];
                    newPath[index] = { ...option, children };
                    return newPath;
                }
                return prev;
            });
        } catch (error) {
            console.error(`Failed to load children for ${val}:`, error);
            setFailedValues((prev) => new Set(prev).add(val));
        } finally {
            setLoadingValues((prev) => {
                if (!prev.has(val)) return prev;
                const next = new Set(prev);
                next.delete(val);
                return next;
            });
            setLoadedValues(prev => prev.has(val) ? prev : new Set(prev).add(val));
        }
    };

    const getSelectedSetFrom2D = React.useCallback((val2D: T[][], options: PanelFieldOption<T>[]): Set<T> => {
        const selected = new Set<T>();
        const addDescendants = (opt: PanelFieldOption<T>) => {
            selected.add(opt.value);
            opt.children?.forEach(addDescendants);
        };

        const findAndAdd = (opts: PanelFieldOption<T>[], depth: number) => {
            const levelValues = new Set(val2D[depth] || []);
            for (const opt of opts) {
                if (levelValues.has(opt.value)) {
                    addDescendants(opt);
                } else if (opt.children && depth + 1 < val2D.length) {
                    findAndAdd(opt.children, depth + 1);
                }
            }
        };

        findAndAdd(options, 0);
        return selected;
    }, []);

    const allSelectedSet = React.useMemo(() => getSelectedSetFrom2D(value, internalOptions), [value, internalOptions, getSelectedSetFrom2D]);

    const getPathSelectionState = React.useCallback(
        (pathValues: T[]): "selected" | "indeterminate" | "none" => {
            // If any node in the path (ancestor or self) is in the selection set,
            // we consider this node selected (Topmost selection rule).
            if (pathValues.some(val => allSelectedSet.has(val))) return "selected";

            // Check if any descendant is selected
            const findOption = (opts: PanelFieldOption<T>[], vals: T[]): PanelFieldOption<T> | undefined => {
                let current = opts;
                let found: PanelFieldOption<T> | undefined;
                for (const v of vals) {
                    found = current.find(o => o.value === v);
                    if (!found) return undefined;
                    current = found.children || [];
                }
                return found;
            };

            const opt = findOption(internalOptions, pathValues);
            if (!opt?.children) return "none";

            const hasAnySelected = (o: PanelFieldOption<T>): boolean => {
                if (allSelectedSet.has(o.value)) return true;
                return o.children?.some(hasAnySelected) ?? false;
            };

            return opt.children.some(hasAnySelected) ? "indeterminate" : "none";
        },
        [allSelectedSet, internalOptions]
    );

    const build2DSelectionArray = (
        opts: PanelFieldOption<T>[],
        selectedSet: Set<T>,
        depth: number = 0,
        result: T[][] = []
    ): T[][] => {
        if (!result[depth]) result[depth] = [];

        for (const opt of opts) {
            if (selectedSet.has(opt.value)) {
                // If it's selected, we check if it's "Full" selection. 
                // For lazy loaded ones, if it's in the Set, we assume it's full.
                // We only store the TOPMOST selected ID at this level.
                result[depth].push(opt.value);
                // DO NOT traverse children
            } else if (opt.children) {
                build2DSelectionArray(opt.children, selectedSet, depth + 1, result);
            }
        }
        return result;
    };

    const handleSelect = (path: PanelFieldOption<T>[], checked: boolean) => {
        const nextValueSet = new Set(allSelectedSet);

        // ALWAYS find the fresh node from the tree to avoid stale references (lazy loading)
        const findFreshNode = (pathVals: T[]): PanelFieldOption<T> | null => {
            let curr = internalOptions;
            let found: PanelFieldOption<T> | null = null;
            for (const val of pathVals) {
                found = curr.find(opt => opt.value === val) || null;
                if (!found) return null;
                curr = found.children || [];
            }
            return found;
        };

        const pathValues = path.map(o => o.value);
        const freshTarget = findFreshNode(pathValues);
        if (!freshTarget) return;

        const toggleNodeAndDescendants = (node: PanelFieldOption<T>, isChecked: boolean) => {
            if (isChecked) {
                nextValueSet.add(node.value);
            } else {
                nextValueSet.delete(node.value);
            }
            node.children?.forEach(child => toggleNodeAndDescendants(child, isChecked));
        };

        if (checked) {
            // Selecting: Add node and all loaded descendants
            toggleNodeAndDescendants(freshTarget, true);

            // Propagate up: If all siblings are now selected, mark parent as selected
            // We need to re-find fresh ancestors too
            for (let i = pathValues.length - 2; i >= 0; i--) {
                const freshParent = findFreshNode(pathValues.slice(0, i + 1));
                if (freshParent && freshParent.children?.every(child => nextValueSet.has(child.value))) {
                    nextValueSet.add(freshParent.value);
                } else {
                    break;
                }
            }
        } else {
            // Unselecting: 
            // 1. If any ancestor was the "topmost selected" node, we must expand it
            // into its other children so they remain selected.
            for (let i = 0; i < pathValues.length - 1; i++) {
                const ancestorVal = pathValues[i];
                if (nextValueSet.has(ancestorVal)) {
                    // This ancestor was fully selected. Remove it.
                    nextValueSet.delete(ancestorVal);

                    // Find fresh ancestor to get its current children
                    const freshAncestor = findFreshNode(pathValues.slice(0, i + 1));
                    if (freshAncestor) {
                        const nextValInPath = pathValues[i + 1];
                        freshAncestor.children?.forEach(sibling => {
                            if (sibling.value !== nextValInPath) {
                                toggleNodeAndDescendants(sibling, true);
                            }
                        });
                    }
                }
            }

            // 2. Remove target node and descendants
            toggleNodeAndDescendants(freshTarget, false);

            // 3. Keep parents unchecked
            for (let i = pathValues.length - 2; i >= 0; i--) {
                nextValueSet.delete(pathValues[i]);
            }
        }

        const result = build2DSelectionArray(internalOptions, nextValueSet);
        // Clean up empty trailing levels
        while (result.length > 0 && result[result.length - 1].length === 0) {
            result.pop();
        }
        onChange?.(result);
    };

    const renderColumn = (
        opts: PanelFieldOption<T>[],
        depth: number,
        isLoading?: boolean,
        isError?: boolean,
        onRetry?: () => void
    ) => {
        if (isLoading) {
            return (
                <div className="h-72 min-w-48 max-w-[24rem] border-r last:border-r-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            );
        }

        if (isError && opts.length === 0) {
            return (
                <div className="h-72 min-w-48 max-w-[24rem] border-r last:border-r-0 flex flex-col items-center justify-center text-sm p-4 text-center">
                    <p className="text-destructive mb-2">Failed to load options.</p>
                    <button
                        type="button"
                        className="text-xs text-primary hover:underline underline-offset-4"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRetry?.();
                        }}
                    >
                        Click to retry
                    </button>
                </div>
            );
        }

        if (opts.length === 0 && !isLoading) {
            return (
                <div className="h-72 min-w-48 max-w-[24rem] border-r last:border-r-0 flex flex-col items-center justify-center text-sm text-muted-foreground p-4 text-center">
                    <p className="mb-2">No options available</p>
                    {optionsLoader && (
                        <button
                            type="button"
                            className="text-xs text-primary hover:underline underline-offset-4"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRetry?.();
                            }}
                        >
                            Try again
                        </button>
                    )}
                </div>
            );
        }

        return (
            <ScrollArea className="h-72 min-w-48 max-w-[24rem] w-auto border-r last:border-r-0">
                <div className="p-2 grid gap-1">
                    {opts.map((option) => {
                        const isCategory = Array.isArray(option.children);
                        const isActive = activePath[depth]?.value === option.value;
                        const isNodeLoading = loadingValues.has(option.value);

                        return (
                            <div
                                key={String(option.value)}
                                className={cn(
                                    "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer group/item w-full max-w-full overflow-hidden",
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
                                        const currentPathVals = activePath.slice(0, depth).concat(option).map(o => o.value);
                                        handleSelect(activePath.slice(0, depth).concat(option), getPathSelectionState(currentPathVals) !== "selected");
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Checkbox
                                        id={`cascadeV2Field-${String(option.value)}`}
                                        checked={(() => {
                                            const state = getPathSelectionState(activePath.slice(0, depth).map(o => o.value).concat(option.value));
                                            return state === "selected" ? true : state === "indeterminate" ? "indeterminate" : false;
                                        })()}
                                        onCheckedChange={(checked) =>
                                            handleSelect(activePath.slice(0, depth).concat(option), checked === true || checked === "indeterminate")
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">{option.label}</span>
                                    {option.media && (
                                        <div className="flex items-center gap-1 shrink-0 px-1">
                                            {(Array.isArray(option.media) ? option.media : [option.media]).map((m, i) => {
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

                                                if (m.type.startsWith("image/")) {
                                                    return <ImagePreview key={i} file={m} trigger={icon} onOpenChange={setIsPreviewOpen} />;
                                                }
                                                if (m.type.startsWith("video/")) {
                                                    return <VideoPreview key={i} file={m} trigger={icon} onOpenChange={setIsPreviewOpen} />;
                                                }
                                                if (m.type.startsWith("audio/")) {
                                                    return <AudioPreview key={i} file={m} trigger={icon} onOpenChange={setIsPreviewOpen} />;
                                                }
                                                return <div key={i}>{icon}</div>;
                                            })}
                                        </div>
                                    )}
                                </div>
                                {isCategory && (
                                    isNodeLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin opacity-50 shrink-0 ml-2" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        );
    };

    return (
        <>
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
                        <div className="flex flex-wrap gap-1 max-h-24 md:max-h-32 overflow-y-auto pr-2">
                            {value.length > 0 ? (
                                (() => {
                                    const getStats = (opt: PanelFieldOption<T>): { selected: number; total: number } => {
                                        if (!opt.children || opt.children.length === 0) {
                                            return { selected: allSelectedSet.has(opt.value) ? 1 : 0, total: 1 };
                                        }

                                        let selected = 0;
                                        let total = 0;
                                        opt.children.forEach(child => {
                                            const s = getStats(child);
                                            selected += s.selected;
                                            total += s.total;
                                        });

                                        if (allSelectedSet.has(opt.value)) {
                                            selected = total;
                                        }

                                        return { selected, total };
                                    };

                                    const badges: React.ReactNode[] = [];

                                    const truncatePath = (path: React.ReactNode[]): React.ReactNode[] => {
                                        if (!isMobile || path.length <= 5) return path; // Truncate only on mobile & > 3 levels
                                        return [
                                            path[0],
                                            path[1],
                                            <span key="ellipsis" className="opacity-40 font-normal">...</span>,
                                            path[path.length - 2],
                                            path[path.length - 1]
                                        ];
                                    };

                                    const collectBadges = (
                                        options: PanelFieldOption<T>[],
                                        parentPath: React.ReactNode[] = []
                                    ) => {
                                        options.forEach(opt => {
                                            const stats = getStats(opt);
                                            if (stats.selected === 0) return;

                                            const currentPath = parentPath.length > 0
                                                ? [
                                                    ...parentPath,
                                                    <span key={`sep-${opt.value}`} className="mx-0.5 opacity-40 font-normal">/</span>,
                                                    opt.label
                                                ]
                                                : [opt.label];

                                            const displayPath = truncatePath(currentPath);

                                            if (stats.selected === stats.total) {
                                                badges.push(
                                                    <Badge key={String(opt.value)} variant="secondary" className="mr-1 mb-1 bg-secondary/50 font-medium h-auto py-1 max-w-full">
                                                        <span className="flex flex-wrap items-center gap-y-0.5">{displayPath}</span>
                                                    </Badge>
                                                );
                                            } else if (opt.children && opt.children.length > 0) {
                                                const hasPartialChild = opt.children.some(c => {
                                                    const s = getStats(c);
                                                    return s.selected > 0 && s.selected < s.total;
                                                });

                                                if (!hasPartialChild) {
                                                    const directSelected = opt.children.filter(c => getStats(c).selected > 0).length;
                                                    const directTotal = opt.children.length;
                                                    badges.push(
                                                        <Badge key={String(opt.value)} variant="secondary" className="mr-1 mb-1 bg-secondary/50 font-medium h-auto py-1 max-w-full">
                                                            <span className="flex flex-wrap items-center gap-y-0.5">
                                                                {displayPath}
                                                                <span className="ml-1 text-[10px] opacity-60 shrink-0">({directSelected}/{directTotal})</span>
                                                            </span>
                                                        </Badge>
                                                    );
                                                } else {
                                                    collectBadges(opt.children, currentPath);
                                                }
                                            }
                                        });
                                    };

                                    if (internalOptions.length === 0 && allSelectedSet.size > 0) {
                                        badges.push(
                                            <Badge key="total" variant="secondary" className="mr-1 bg-secondary/50">
                                                Selected {allSelectedSet.size} items
                                            </Badge>
                                        );
                                    } else {
                                        collectBadges(internalOptions);
                                    }

                                    return badges;
                                })()
                            ) : (
                                <span className="text-muted-foreground">{placeholder}</span>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    id={id}
                    className="w-[calc(100vw-1.25rem)] md:w-auto p-0 max-w-[calc(100vw-1.25rem)] md:max-w-[80vw] overflow-x-auto"
                    align="start"
                    sideOffset={4}
                    collisionPadding={10}
                >
                    <div className="flex flex-row">
                        {renderColumn(
                            internalOptions,
                            0,
                            isInitialLoading,
                            failedValues.has("ROOT"),
                            () => {
                                setLoadedValues(prev => {
                                    const next = new Set(prev);
                                    next.delete("ROOT");
                                    return next;
                                });
                            }
                        )}
                        {activePath.map((option, index) => {
                            const isLoading = loadingValues.has(option.value as T);
                            const isError = failedValues.has(option.value as T);
                            return (
                                <React.Fragment key={option.value}>
                                    {(option.children || isLoading || isError) && renderColumn(
                                        option.children || [],
                                        index + 1,
                                        isLoading,
                                        isError,
                                        () => handleLoadChildren(option, activePath.slice(0, index + 1))
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </PopoverContent>
            </Popover>
        </>
    );
}
