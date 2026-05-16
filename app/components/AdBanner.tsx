// ফাইল পাথ: app/components/AdBanner.tsx
'use client';

import { useEffect, useRef } from 'react';

export default function AdBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // যদি আগে থেকেই অ্যাড লোড হয়ে থাকে, তবে আবার লোড করবে না
    if (!bannerRef.current || bannerRef.current.hasChildNodes()) return;

    const conf = document.createElement('script');
    conf.type = 'text/javascript';
    conf.innerHTML = `
      atOptions = {
        'key' : 'bdc21b8adb83683debd9ca7a900f0b26',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `;
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://momrollback.com/bdc21b8adb83683debd9ca7a900f0b26/invoke.js';
    script.async = true;

    bannerRef.current.append(conf);
    bannerRef.current.append(script);
  }, []);

  return <div ref={bannerRef} className="flex justify-center items-center w-full overflow-hidden my-4" />;
}
