// ফাইল পাথ: app/components/NativeBanner.tsx
'use client';

import { useEffect, useRef } from 'react';

export default function NativeBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bannerRef.current || bannerRef.current.querySelector('script')) return;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://momrollback.com/20de90ea69932a42f48d546002f6a472/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');

    bannerRef.current.append(script);
  }, []);

  return (
    <div className="flex justify-center items-center w-full my-4">
      <div id="container-20de90ea69932a42f48d546002f6a472" ref={bannerRef} />
    </div>
  );
}
