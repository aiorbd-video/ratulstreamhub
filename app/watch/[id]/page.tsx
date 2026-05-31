// ফাইল পাথ: app/watch/[id]/page.tsx 
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
// @ts-ignore
import shaka from 'shaka-player/dist/shaka-player.compiled';
import Link from 'next/link';

export default function WatchPage() {
  const params = useParams();
  const shortId = params.id as string;
  const playerRef = useRef<HTMLDivElement>(null);
  
  const [streamData, setStreamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 🎯 আপনার টেলিগ্রাম বটের আসল ইউজারনেম
  const TELEGRAM_BOT_USERNAME = "ratulnotific_bot"; 

  useEffect(() => {
    fetch(`/api/watch/${shortId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStreamData(data);
        else setErrorMsg('এই স্ট্রিমটি আর সচল নেই বা মুছে ফেলা হয়েছে!');
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('সার্ভার থেকে ডাটা আনতে সমস্যা হয়েছে!');
        setLoading(false);
      });
  }, [shortId]);

  useEffect(() => {
    if (!streamData || !playerRef.current) return;

    let art: Artplayer;
    let hls: Hls;
    let shakaPlayer: any;

    const { referer = '', origin = '', cookie = '', userAgent = '' } = streamData.headers || {};
    
    // 🎯 Cloudflare Proxy Logic (প্রক্সি থাকলে প্রক্সি, না থাকলে ডাইরেক্ট)
    const finalStreamUrl = streamData.proxy_url 
        ? `${streamData.proxy_url}${streamData.streamUrl}` 
        : streamData.streamUrl;

    const isDash = streamData.stream_type === 'dash';

    // 🌟 Enterprise Artplayer Configuration
    art = new Artplayer({
      container: playerRef.current,
      url: finalStreamUrl, 
      type: isDash ? 'mpd' : 'm3u8',
      poster: streamData.logo,
      volume: 0.8,
      isLive: true,
      muted: true, // Auto-play পলিসির জন্য মিউট
      autoplay: true,
      
      // 📱 Mobile & TV Controls
      playsInline: true,
      autoOrientation: true, // মোবাইল ল্যান্ডস্কেপ করলে অটো ফুলস্ক্রিন
      fastForward: true, // লং প্রেসে 3x স্পিড
      lock: true, // মোবাইল স্ক্রিন লক বাটন
      airplay: true, // Apple Airplay সাপোর্ট
      
      pip: true,
      autoMini: true,
      setting: true,
      playbackRate: true, 
      aspectRatio: true,  
      fullscreen: true,
      fullscreenWeb: true,
      hotkey: true,
      theme: '#ef4444',
      
      customType: {
        // ==========================================
        // 🟢 HLS (m3u8) ইঞ্জিন - Powered by Hls.js
        // ==========================================
        m3u8: function (video, url, artInstance) {
          if (Hls.isSupported()) {
            if (hls) hls.destroy();
            
            hls = new Hls({
              lowLatencyMode: true,
              maxBufferLength: 30,
              xhrSetup: function (xhr: any) {
                if (userAgent) xhr.setRequestHeader('X-User-Agent', userAgent);
                if (cookie) xhr.setRequestHeader('X-Cookie', cookie);
                if (referer) xhr.setRequestHeader('X-Referer', referer);
                if (origin) xhr.setRequestHeader('X-Origin', origin);
              }
            });
            
            hls.loadSource(url);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
              if (hls.levels.length > 1) {
                const qualityOptions = hls.levels.map((level, index) => ({
                  html: (level.height ? level.height + 'p' : 'Quality ' + (index + 1)),
                  level: index,
                }));
                qualityOptions.unshift({ html: 'Auto', level: -1 });

                const qualitySetting = artInstance.setting.settings.find(s => s.name === 'quality');
                if (!qualitySetting) {
                  artInstance.setting.add({
                    name: 'quality',
                    width: 200,
                    html: 'Quality',
                    tooltip: 'Auto',
                    selector: qualityOptions.map(q => ({
                      html: q.html,
                      value: q.level,
                      default: q.level === -1
                    })),
                    onSelect: function (item: any) {
                      hls.currentLevel = Number(item.value);
                      return item.html;
                    },
                  });
                }
              }
            });

            hls.on(Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    artInstance.notice.show = `⚠️ Stream Error: ${data.details}`;
                    hls.destroy();
                    setTimeout(() => setErrorMsg('স্ট্রিমটি প্লে হতে ব্যর্থ হয়েছে।'), 3000);
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          }
        },

        // ==========================================
        // 🔵 DASH (mpd) & DRM ইঞ্জিন - Powered by Shaka
        // ==========================================
        mpd: async function (video, url, artInstance) {
          shaka.polyfill.installAll();

          if (!shaka.Player.isBrowserSupported()) {
            artInstance.notice.show = "⚠️ Browser not supported for DASH!";
            return;
          }

          shakaPlayer = new shaka.Player(video);

          // হেডার প্রক্সি
          shakaPlayer.getNetworkingEngine().registerRequestFilter((type: any, request: any) => {
            if (userAgent) request.headers['X-User-Agent'] = userAgent;
            if (cookie) request.headers['X-Cookie'] = cookie;
          });

          // 🎯 Anti-Buffering Configuration
          const shakaConfig: any = {
            abr: { enabled: true, defaultBandwidthEstimate: 1000000 },
            streaming: {
              bufferingGoal: 10,
              rebufferingGoal: 2,
              bufferBehind: 30,
              retryParameters: { maxAttempts: 5, baseDelay: 1000 }
            },
            manifest: { retryParameters: { maxAttempts: 5 } }
          };

          // 🔐 Clearkey DRM 
          if (streamData.drm_key_id && streamData.drm_key) {
            shakaConfig.drm = {
              clearKeys: {
                [streamData.drm_key_id]: streamData.drm_key
              }
            };
          }

          shakaPlayer.configure(shakaConfig);

          shakaPlayer.addEventListener('error', (event: any) => {
            console.error("Shaka Error Details:", event.detail);
            if (event.detail.severity === shaka.util.Error.Severity.CRITICAL) {
              artInstance.notice.show = `⚠️ DRM/Stream Error: ${event.detail.code}`;
              setTimeout(() => setErrorMsg('DRM অথবা স্ট্রিম লিংকটি কাজ করছে না!'), 3000);
            }
          });

          try {
            await shakaPlayer.load(url);
            
            // 🎯 Shaka Quality Control in Artplayer Menu
            const tracks = shakaPlayer.getVariantTracks();
            if (tracks.length > 0) {
              const resolutions = Array.from(new Set(tracks.map((t: any) => t.height))).sort((a: any, b: any) => b - a);
              const qualityOptions = resolutions.map(h => ({
                html: h ? `${h}p` : 'Unknown',
                level: h
              }));
              qualityOptions.unshift({ html: 'Auto', level: -1 });

              const qualitySetting = artInstance.setting.settings.find(s => s.name === 'quality');
              if (!qualitySetting) {
                artInstance.setting.add({
                  name: 'quality',
                  width: 200,
                  html: 'Quality',
                  tooltip: 'Auto',
                  selector: qualityOptions.map(q => ({
                    html: q.html,
                    value: q.level,
                    default: q.level === -1
                  })),
                  onSelect: function (item: any) {
                    const targetHeight = Number(item.value);
                    if (targetHeight === -1) {
                      shakaPlayer.configure({ abr: { enabled: true } });
                    } else {
                      shakaPlayer.configure({ abr: { enabled: false } });
                      const track = shakaPlayer.getVariantTracks().find((t: any) => t.height === targetHeight);
                      if (track) shakaPlayer.selectVariantTrack(track, true);
                    }
                    return item.html;
                  },
                });
              }
            }
          } catch (e: any) {
            console.error("Shaka Load Error:", e);
          }
        }
      },
    });

    // 🧹 Cleanup on Unmount
    return () => {
      if (hls) hls.destroy();
      if (shakaPlayer) shakaPlayer.destroy();
      if (art && art.destroy) art.destroy(false);
    };
  }, [streamData]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-2 md:p-6">
      <div className="w-full max-w-[1400px] bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm z-10 relative">
          <h1 className="text-sm md:text-lg font-bold flex items-center gap-2 line-clamp-1 max-w-[70%]">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
            {streamData ? streamData.title : 'Live Stream'}
          </h1>
          <Link href="/" className="text-xs md:text-sm bg-slate-800 hover:bg-red-600 px-3 py-1.5 rounded-xl transition-all font-medium border border-slate-700/50">
            ← ফিরে যান
          </Link>
        </div>

        {/* Player Container */}
        <div className="relative w-full aspect-video md:h-[75vh] md:aspect-auto bg-black flex items-center justify-center overflow-hidden">
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-slate-400">খেলার লিংক লোড হচ্ছে...</p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-30 p-6 text-center backdrop-blur-sm">
              <div className="text-4xl mb-3">🤖</div>
              <h2 className="text-xl font-bold text-red-500 mb-1">স্ট্রিমিং ব্যর্থ হয়েছে!</h2>
              <p className="text-xs text-slate-400 mb-5 max-w-md">{errorMsg}</p>
              
              <a 
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${shortId}`} 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#0088cc] hover:bg-[#0077b3] text-white text-sm font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 animate-bounce"
              >
                <span>বট থেকে নতুন লিংক নিন</span>
                <span>↗️</span>
              </a>
            </div>
          )}

          {/* Artplayer Target Div */}
          {!errorMsg && <div ref={playerRef} className="w-full h-full"></div>}
        </div>
      </div>
    </div>
  );
}
