import { useEffect, useState } from 'react';

/** Prompt reload when a waiting service worker has a newer build. */
export function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onController = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onController);

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) setWaiting(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(worker);
          }
        });
      });
    });

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onController);
  }, []);

  if (!waiting) return null;

  return (
    <div className="update-banner" role="status">
      <span>New version ready</span>
      <button
        type="button"
        onClick={() => {
          waiting.postMessage('skipWaiting');
          setWaiting(null);
        }}
      >
        Reload now
      </button>
    </div>
  );
}
