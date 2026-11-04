import { useEffect, useState } from 'react';

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, delay = 0) {
  const [resource, setResource] = useState<{ data?: T; error: string }>({ error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      load(controller.signal).then((data) => {
        if (!controller.signal.aborted) setResource({ data, error: '' });
      }).catch((error: Error) => {
        if (!controller.signal.aborted) setResource((previous) => ({ ...previous, error: error.message }));
      });
    }, delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, delay, revision]);
  const refresh = () => {
    setResource((previous) => ({ ...previous, error: '' }));
    setRevision((value) => value + 1);
  };
  return { ...resource, refresh };
}
