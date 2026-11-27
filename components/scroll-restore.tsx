"use client";

import { useEffect } from "react";

export function ScrollRestore() {
  useEffect(() => {
    const keyFor = () => `scroll:${window.location.pathname}${window.location.search}`;
    const restore = () => {
      const raw = sessionStorage.getItem(keyFor());
      if (!raw) return;
      const top = Number(raw);
      const go = () => window.scrollTo(0, top);
      go();
      requestAnimationFrame(go);
    };
    const save = () => {
      sessionStorage.setItem(keyFor(), String(window.scrollY));
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.origin !== window.location.origin) return;
      save();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", restore);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pagehide", save);
    };
  }, []);
  return null;
}
