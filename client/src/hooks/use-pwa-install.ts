import { useState, useEffect } from "react";
import { onInstallPromptChange, promptInstall, isStandalone } from "@/lib/pwa";

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isStandalone());

  useEffect(() => {
    return onInstallPromptChange((available) => {
      setCanInstall(available);
    });
  }, []);

  useEffect(() => {
    const handler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setCanInstall(false);
      setIsInstalled(true);
    }
    return accepted;
  };

  return { canInstall, isInstalled, install };
}
