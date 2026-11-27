"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/dictionary";

export function ShareBar({
  title,
  url,
  dict,
}: {
  title: string;
  url: string;
  dict: Dictionary;
}) {
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(dict.copied);
      setManual(false);
    } catch {
      setManual(true);
      setStatus(dict.copyFallback);
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  }

  return (
    <div className="share">
      <button type="button" onClick={share}>
        {dict.share}
      </button>
      <button type="button" onClick={copy}>
        {dict.copyLink}
      </button>
      <p role="status">{status}</p>
      {manual ? <input readOnly value={url} aria-label={dict.copyFallback} /> : null}
    </div>
  );
}
