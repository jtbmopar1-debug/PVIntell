"use client";

import { useEffect } from "react";

const recoveryKey = "pvintell:stale-app-recovery";

export function isStaleAppAssetError(value: unknown) {
  const message = value instanceof Error
    ? value.message
    : typeof value === "string"
      ? value
      : value && typeof value === "object" && "message" in value
        ? String((value as { message?: unknown }).message ?? "")
        : "";
  return /chunkloaderror|loading chunk .* failed|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(message);
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reloading = false;
    const recover = () => {
      if (reloading) return;
      const previous = Number(window.sessionStorage.getItem(recoveryKey) ?? 0);
      if (Date.now() - previous < 60_000) return;
      reloading = true;
      window.sessionStorage.setItem(recoveryKey, String(Date.now()));
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => {
      const asset = event.target instanceof HTMLScriptElement
        ? event.target.src
        : event.target instanceof HTMLLinkElement
          ? event.target.href
          : "";
      if (asset.includes("/_next/static/") || isStaleAppAssetError(event.error ?? event.message)) recover();
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isStaleAppAssetError(event.reason)) recover();
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => { if (hadController) recover(); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    let registration: ServiceWorkerRegistration | undefined;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((nextRegistration) => {
        registration = nextRegistration;
        return nextRegistration.update();
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  return null;
}
