"use client";

import { useEffect, useState } from "react";

export const purchasePromptPreferenceKey = "pvintell:prompt-for-purchase-cost";
const purchasePromptPreferenceEvent = "pvintell:purchase-prompt-preference";

function readPurchasePromptPreference() {
  try {
    return window.localStorage.getItem(purchasePromptPreferenceKey) !== "false";
  } catch {
    return true;
  }
}

export function usePurchasePromptPreference() {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    const sync = () => setEnabledState(readPurchasePromptPreference());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(purchasePromptPreferenceEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(purchasePromptPreferenceEvent, sync);
    };
  }, []);

  const setEnabled = (next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(purchasePromptPreferenceKey, String(next));
      window.dispatchEvent(new Event(purchasePromptPreferenceEvent));
    } catch {
      // Keep the preference usable for this session when storage is unavailable.
    }
  };

  return { enabled, setEnabled };
}
