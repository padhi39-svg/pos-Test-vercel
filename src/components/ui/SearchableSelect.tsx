"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export type SearchableSelectOption = {
  value: string | number;
  label: string;
  description?: string;
};

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  allowClear?: boolean;
  showSearch?: boolean;
  loadOptions?: (query: string) => Promise<SearchableSelectOption[]>;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  disabled = false,
  className = "",
  inputClassName = "",
  allowClear = true,
  showSearch = true,
  loadOptions,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [remoteOptions, setRemoteOptions] = useState<SearchableSelectOption[]>(
    [],
  );
  const [loadingRemote, setLoadingRemote] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const initialLoadRef = useRef(false);

  const localFiltered = options.filter(
    (option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (option.description &&
        option.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const displayOptions = loadOptions
    ? remoteOptions.length > 0
      ? remoteOptions
      : localFiltered
    : localFiltered;

  const selectedOption = (
    loadOptions ? [...remoteOptions, ...options] : options
  ).find((option) => option.value === value);

  const doLoadOptions = useCallback(
    async (query: string) => {
      if (!loadOptions) return;
      setLoadingRemote(true);
      try {
        const results = await loadOptions(query);
        setRemoteOptions(results);
      } finally {
        setLoadingRemote(false);
      }
    },
    [loadOptions],
  );

  useEffect(() => {
    if (!loadOptions) return;
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      doLoadOptions("");
    }
  }, [loadOptions, doLoadOptions]);

  useEffect(() => {
    if (!loadOptions) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doLoadOptions(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, loadOptions, doLoadOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(target);
      const isOutsidePortal =
        portalRef.current && !portalRef.current.contains(target);
      if (isOutsideContainer && isOutsidePortal) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const reposition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const maxHeight = Math.min(displayOptions.length, 8) * 36 + 8;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const showAbove = spaceBelow < maxHeight && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, Math.max(spaceBelow, spaceAbove) - 4);
    let top = showAbove
      ? Math.max(8, rect.bottom - height - 4)
      : rect.bottom + 4;
    if (showAbove && top < 8) top = 8;
    setDropdownStyle({
      position: "fixed",
      top,
      left: rect.left,
      width: Math.max(rect.width, 200),
      maxHeight: height,
      zIndex: 9999,
    });
  }, [displayOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, reposition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        else
          setHighlightedIndex((prev) =>
            prev < displayOptions.length - 1 ? prev + 1 : 0,
          );
        break;
      case "ArrowUp":
        e.preventDefault();
        if (isOpen)
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : displayOptions.length - 1,
          );
        break;
      case "Enter":
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0)
          handleSelect(displayOptions[highlightedIndex]);
        else if (!isOpen) setIsOpen(true);
        break;
      case "Escape":
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case "Backspace":
        if (searchQuery === "" && selectedOption && allowClear) onChange(null);
        break;
    }
  };

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const handleInputClick = () => {
    if (!disabled) {
      reposition();
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  const displayValue = isOpen ? searchQuery : selectedOption?.label || "";

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      <div
        className={`
          relative rounded-pill border bg-white cursor-pointer transition-colors
          ${disabled ? "bg-slate-100 cursor-not-allowed" : "hover:border-slate-400"}
          ${
            isOpen
              ? "border-teal-primary ring-2 ring-[#E8F6F5]"
              : "border-slate-300"
          }
        `}
        onClick={handleInputClick}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pr-8 bg-transparent outline-none px-3 py-2
            ${disabled ? "cursor-not-allowed text-slate-500" : "cursor-pointer"}
            ${inputClassName || "text-sm"}
          `}
          readOnly={!isOpen}
        />

        {selectedOption && allowClear && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={portalRef}
            style={dropdownStyle}
            className="bg-white border border-slate-300 rounded-lg shadow-lg overflow-auto text-sm z-[9999]"
          >
            {showSearch && (
              <div className="sticky top-0 bg-white border-b border-slate-200 px-3 py-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  placeholder="Cari..."
                  className="w-full border border-slate-300 rounded-pill px-2 py-1.5 text-xs outline-none focus:border-teal-primary focus:ring-1 focus:ring-[#E8F6F5]"
                  autoFocus
                />
              </div>
            )}
            {loadingRemote ? (
              <div className="px-3 py-3 text-slate-500 text-xs text-center">
                Loading...
              </div>
            ) : displayOptions.length === 0 ? (
              <div className="px-3 py-3 text-slate-500 text-xs text-center">
                Tidak ada data ditemukan
              </div>
            ) : (
              displayOptions.map((option, index) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                  px-3 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors
                  ${index === highlightedIndex ? "bg-[#E8F6F5] text-teal-primary" : "hover:bg-[#E8F6F5]"}
                  ${option.value === value ? "bg-teal-primary text-white font-medium" : "text-slate-700"}
                `}
                >
                  <div className="text-sm">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {option.description}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
