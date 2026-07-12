"use client";

import { useEffect, useRef, useState } from "react";

export default function MobilePublicNav({ items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    };
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  return (
    <div className="manalio-mobile-nav" ref={rootRef}>
      <button ref={buttonRef} type="button" aria-expanded={open} aria-controls="manalio-mobile-menu" onClick={() => setOpen((current) => !current)}>
        <span aria-hidden="true">☰</span>
        <span>メニュー</span>
      </button>
      {open && (
        <nav id="manalio-mobile-menu" aria-label="公開サイトのメニュー">
          {items.map(([label, href]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
          <a className="manalio-mobile-nav-cta" href="#contact" onClick={() => setOpen(false)}>導入相談をする</a>
        </nav>
      )}
    </div>
  );
}
