"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent>();
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const detection = window.setTimeout(() => {
      setInstalled(standalone);
      setIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    }, 0);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", markInstalled, { once: true });
    return () => {
      window.clearTimeout(detection);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (!installed && !prompt && !ios) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(undefined);
  }

  return <section className="card mt-4 flex items-center gap-3 p-4">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fff1b8] text-brand"><Smartphone size={17}/></span>
    <div className="min-w-0 flex-1">
      <h2 className="text-xs font-bold">PVIntell mobile app</h2>
      <p className="mt-1 text-[9px] leading-4 text-muted">{installed ? "Installed on this device and running in app mode." : ios && !prompt ? "In Safari, use Share, then Add to Home Screen." : "Install PVIntell for a full-screen mobile experience."}</p>
    </div>
    {prompt && !installed ? <button type="button" onClick={() => void install()} className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-brand px-3 text-[10px] font-bold text-white"><Download size={14}/>Install</button> : null}
  </section>;
}
