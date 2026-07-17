import { useEffect, useRef, useState } from "react";

export default function SearchableSelect({ options, value, onChange, placeholder, searchPlaceholder, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div className="searchable-select" ref={containerRef}>
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        aria-expanded={open}
      >
        <span className={selected ? "" : "searchable-select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`searchable-select-chevron${open ? " open" : ""}`}>&#9662;</span>
      </button>

      {open && (
        <div className="searchable-select-panel">
          <input
            ref={searchRef}
            type="search"
            className="searchable-select-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder={searchPlaceholder}
          />
          <div className="searchable-select-options">
            {filtered.length === 0 ? (
              <div className="searchable-select-empty">{emptyLabel}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`searchable-select-option${String(o.value) === String(value) ? " active" : ""}`}
                  onClick={() => handleSelect(o.value)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
