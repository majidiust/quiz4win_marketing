"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
  hint?: string;
  // Free-form keyword string used to broaden the substring match
  // (e.g. native language name, alternate spellings).
  keywords?: string;
  leading?: React.ReactNode;
}

interface ComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  contentClassName?: string;
}

// Searchable single-select dropdown built on top of Radix Popover. Filter is
// substring-only against label + value + keywords; no fuzzy library to keep
// the bundle small.
export function Combobox({
  value,
  onChange,
  items,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled,
  clearable = true,
  className,
  contentClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [rawActiveIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.value} ${it.keywords ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // Derive a clamped active index instead of correcting it in an effect; that
  // avoids the cascading-render warning when `filtered` shrinks.
  const activeIndex = filtered.length === 0 ? 0 : Math.min(rawActiveIndex, filtered.length - 1);

  function handleOpenChange(o: boolean) {
    if (disabled) return;
    setOpen(o);
    if (!o) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  const selected = items.find((i) => i.value === value);

  function commit(item: ComboboxItem) {
    onChange(item.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) commit(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Keep the active row in view as the user navigates with the keyboard.
  React.useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index='${activeIndex}']`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.leading}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <span className="ml-2 flex items-center gap-1">
            {clearable && selected && !disabled ? (
              <X
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
              />
            ) : null}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[min(28rem,var(--radix-popover-trigger-width))] p-0", contentClassName)}
        onOpenAutoFocus={(e) => { e.preventDefault(); }}
      >
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDown}
            className="h-8"
          />
        </div>
        <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((it, idx) => {
              const isActive = idx === activeIndex;
              const isSelected = it.value === value;
              return (
                <button
                  type="button"
                  key={it.value}
                  data-index={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(it)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                    isActive && "bg-muted",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    {it.leading}
                    <span className="truncate">{it.label}</span>
                    {it.hint ? <span className="ml-1 truncate text-xs text-muted-foreground">{it.hint}</span> : null}
                  </span>
                  {isSelected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
