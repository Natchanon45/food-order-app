import { useEffect, useId, useMemo, useRef, useState } from "react";

export const RECEIVER_BANK_PAGE_SIZE = 12;

export function filterReceiverBanks(entries, query) {
  const normalized = String(query || "").normalize("NFKC").trim().toLocaleLowerCase();
  if (!normalized) return entries;
  return entries.filter(([code, label]) =>
    (String(code) + " " + String(label)).normalize("NFKC").toLocaleLowerCase().includes(normalized));
}

// React combobox: no jQuery/Select2 bridge and no network dependency.
// Bank codes are the original Slip2Go account type keys, not array indices.
export function PlatformReceiverBankSelect({
  id, value, options, disabled = false, onChange,
  searchPlaceholder, noResultsText, loadMoreText,
}) {
  const uid = useId().replace(/:/g, "");
  const listId = uid + "-receiver-banks";
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(RECEIVER_BANK_PAGE_SIZE);
  const [activeIndex, setActiveIndex] = useState(0);
  const entries = useMemo(() => Object.entries(options || {}), [options]);
  const filtered = useMemo(() => filterReceiverBanks(entries, query), [entries, query]);
  const visible = filtered.slice(0, limit);
  const selectedLabel = options?.[value] ?? value ?? "";

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const active = document.getElementById(listId + "-option-" + activeIndex);
    active?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open, listId, limit]);

  const openMenu = () => {
    if (disabled) return;
    setQuery("");
    setLimit(RECEIVER_BANK_PAGE_SIZE);
    setActiveIndex(0);
    setOpen(true);
  };
  const changeQuery = next => {
    setQuery(next);
    setLimit(RECEIVER_BANK_PAGE_SIZE);
    setActiveIndex(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setOpen(true);
  };
  const choose = bankCode => {
    onChange(bankCode);
    setOpen(false);
    setQuery("");
    inputRef.current?.focus();
  };
  const loadMore = () => setLimit(previous => Math.min(filtered.length, previous + RECEIVER_BANK_PAGE_SIZE));
  const onListScroll = event => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 36) loadMore();
  };
  const onKeyDown = event => {
    if (disabled) return;
    if (event.key === "Escape") {
      if (open) { event.preventDefault(); setOpen(false); setQuery(""); }
      return;
    }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { openMenu(); return; }
      const next = Math.max(0, Math.min(filtered.length - 1,
        activeIndex + (event.key === "ArrowDown" ? 1 : -1)));
      if (next >= limit) setLimit(current => Math.min(filtered.length, current + RECEIVER_BANK_PAGE_SIZE));
      setActiveIndex(next);
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (filtered[activeIndex]) choose(filtered[activeIndex][0]);
    }
  };

  return (
    <div className={"platform-bank-combobox" + (open ? " is-open" : "")} ref={rootRef}>
      <div className="platform-bank-combobox-input">
        <i className="bi bi-search" aria-hidden="true"></i>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          type="text"
          className="input"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && visible[activeIndex] ? listId + "-option-" + activeIndex : undefined}
          disabled={disabled}
          placeholder={searchPlaceholder}
          value={open ? query : selectedLabel}
          onFocus={() => { if (!open) openMenu(); }}
          onClick={() => { if (!open) openMenu(); }}
          onChange={event => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="platform-bank-combobox-toggle" aria-label={searchPlaceholder}
          disabled={disabled} aria-expanded={open}
          onClick={() => { if (open) setOpen(false); else { openMenu(); inputRef.current?.focus(); } }}>
          <i className={"bi " + (open ? "bi-chevron-up" : "bi-chevron-down")} aria-hidden="true"></i>
        </button>
      </div>
      {open && !disabled && (
        <div className="platform-bank-combobox-popup">
          <div className="platform-bank-combobox-list" id={listId} role="listbox"
            ref={scrollRef} onScroll={onListScroll}>
            {visible.length ? visible.map(([code, label], index) => (
              <button type="button" role="option" tabIndex={-1}
                key={code || "none"}
                id={listId + "-option-" + index}
                className={"platform-bank-combobox-option" + (activeIndex === index ? " active" : "")}
                aria-selected={value === code}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(code)}>
                <i className={"bi " + (code ? "bi-bank" : "bi-question-circle")} aria-hidden="true"></i>
                <span className="platform-bank-combobox-option-text">{label}</span>
                {code ? <small>{code}</small> : null}
                {value === code ? <i className="bi bi-check-lg" aria-hidden="true"></i> : null}
              </button>
            )) : <p className="platform-bank-combobox-empty">{noResultsText}</p>}
          </div>
          {filtered.length > visible.length ? (
            <button type="button" className="platform-bank-combobox-more" onClick={loadMore}>
              <i className="bi bi-arrow-down-circle" aria-hidden="true"></i>
              <span>{loadMoreText} ({visible.length}/{filtered.length})</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
