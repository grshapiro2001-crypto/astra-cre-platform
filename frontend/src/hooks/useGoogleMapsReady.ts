import { useState, useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMapsReady = () =>
  typeof window !== 'undefined' && !!(window as any).google?.maps;

export function useGoogleMapsReady(): { isLoaded: boolean } {
  const [isLoaded, setIsLoaded] = useState(isMapsReady);

  useEffect(() => {
    if (isLoaded) return;
    const id = setInterval(() => {
      if (isMapsReady()) {
        setIsLoaded(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [isLoaded]);

  return { isLoaded };
}
