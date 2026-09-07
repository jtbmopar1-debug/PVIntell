"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled || (!promptEvent && !isIos)) return null;

  const install = async () => {
    if (isIos) {
      setShowIosHelp((shown) => !shown);
      return;
    }
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  };

  return (
    <div className="relative">
      <button type="button" onClick={install} className={`inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border px-6 text-sm font-bold backdrop-blur sm:w-auto ${tone === "light" ? "border-line bg-white text-brand hover:border-[#9db9d2]" : "border-white/25 bg-white/8 text-white"}`}>
        <Download size={17}/>
        Install PVIntell
      </button>
      {showIosHelp ? <div className={`mt-2 rounded-xl border px-4 py-3 text-xs leading-5 sm:absolute sm:left-0 sm:w-64 ${tone === "light" ? "border-line bg-white text-muted shadow-lg" : "border-white/15 bg-[#10243a] text-white/80"}`}><Share className="mr-1 inline text-[#69b9f2]" size={15}/> Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</div> : null}
    </div>
  );
}
