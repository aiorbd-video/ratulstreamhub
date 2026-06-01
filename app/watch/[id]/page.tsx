'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
// @ts-ignore
import shaka from 'shaka-player';
import Link from 'next/link';

export default function WatchPage() {
  const params = useParams();
  const shortId = params.id as string;
  const playerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const [streamData, setStreamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 🎯 লগস স্টোর করার স্টেট
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'ok' | 'err' | 'warn' | 'info' }[]>([]);

  const TELEGRAM_BOT_USERNAME = "ratulnotific_bot"; 

  // 🎯 লগ প্রিন্ট করার ফাংশন
  const addLog = useCallback((msg: string, type: 'ok' | 'err' | 'warn' | 'info' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const newLogs = [...prev, { time, msg, type }];
      if (newLogs.length > 100) newLogs.shift(); // সর্বোচ্চ ১০০ লাইন লগ রাখবে
      return newLogs;
    });
    console.log(`[${type.toUpperCase()}] ${msg}`);
  }, []);

  // লগের স্ক্রল অটো নিচে নেওয়ার জন্য
  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    addLog('Fetching stream data from database...', 'info');
    fetch(`/api/watch/${shortId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStreamData(data);
          addLog('Stream data fetched successfully!', 'ok');
        } else {
          setErrorMsg('এই স্ট্রিমটি আর সচল নেই বা মুছে ফেলা হয়েছে!');
          addLog('Failed: Stream data not found or expired', 'err');
        }
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg('সার্ভার থেকে ডাটা আনতে সমস্যা হয়েছে!');
        addLog(`Server Error: ${err.message}`, 'err');
        setLoading(false);
      });
  }, [shortId, addLog]);

  useEffect(() => {
    if (!streamData || !playerRef.current) return;

    let art: Artplayer;
    let hls: Hls;
    let shakaPlayer: any;

    const { referer = '', origin = '', cookie = '', userAgent = '' } = streamData.headers || {};
    
    // 🎯 Proxy URL Builder
    const fallbackProxyUrl = streamData.proxy_url 
      ? (streamData.proxy_url.includes('?') 
          ? `${streamData.proxy_url}${encodeURIComponent(streamData.streamUrl)}${referer ? `&ref=${encodeURIComponent(referer)}` : ''}`
          : `${streamData.proxy_url}?url=${encodeURIComponent(streamData.streamUrl)}${referer ? `&ref=${encodeURIComponent(referer)}` : ''}`)
      : '';

    const isDash = streamData.stream_type === 'dash';
    addLog(`Booting ArtPlayer for ${isDash ? 'DASH (MPD)' : 'HLS (M3U8)'}...`, 'warn');

    art = new Artplayer({
      container: playerRef.current,
      url: streamData.streamUrl, 
      type: isDash ? 'mpd' : 'm3u8',
      poster: streamData.logo,
      volume: 0.8,
      isLive: true,
      muted: true, 
      autoplay: true,
      playsInline: true,
      autoOrientation: true, 
      fastForward: true, 
      lock: true, 
      airplay: true, 
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
        // 🟢 HLS (m3u8) Smart Fallback
        // ==========================================
        m3u8: function (video, url, artInstance) {
          if (Hls.isSupported()) {
            let isProxyFallback = false;

            const loadHls = (targetUrl: string, isProxy: boolean) => {
              if (hls) hls.destroy();
              
              addLog(`Initializing HLS.js (${isProxy ? 'Proxy' : 'Direct'})...`, 'info');
              addLog(`Target URL: ${targetUrl}`, 'warn');

              hls = new Hls({
                lowLatencyMode: true,
                maxBufferLength: 20,
                fragLoadingTimeOut: 15000,
                manifestLoadingTimeOut: 12000,
                xhrSetup: function (xhr: any) {
                  if (userAgent) xhr.setRequestHeader('X-User-Agent', userAgent);
                  if (cookie) xhr.setRequestHeader('X-Cookie', cookie);
                }
              });
              
              hls.loadSource(targetUrl);
              hls.attachMedia(video);
              
              hls.on(Hls.Events.MANIFEST_PARSED, function (_, data) {
                addLog(`✅ Manifest OK — ${data.levels.length} quality levels via ${isProxy ? 'Proxy' : 'Direct'}`, 'ok');
                artInstance.notice.show = isProxy ? "🟢 Playing via Proxy" : "🟢 Playing Direct";
                
                if (hls.levels.length > 1) {
                  const qualityOptions = hls.levels.map((level, index) => ({
                    html: (level.height ? level.height + 'p' : 'Quality ' + (index + 1)),
                    level: index,
                  }));
                  qualityOptions.unshift({ html: 'Auto', level: -1 });

                  const qualitySetting = artInstance.setting.find('quality');
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
                        addLog(`Quality switched to: ${item.html}`, 'info');
                        return item.html;
                      },
                    });
                  }
                }
              });

              hls.on(Hls.Events.ERROR, function (_, data) {
                if (data.fatal) {
                  addLog(`HLS Fatal Error: ${data.type} | ${data.details}`, 'err');
                  
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      if (!isProxy && fallbackProxyUrl && !isProxyFallback) {
                        isProxyFallback = true;
                        addLog("Direct URL blocked (CORS/403) → Switching to Proxy...", 'warn');
                        artInstance.notice.show = "🔄 Direct Blocked! Switching to Proxy...";
                        loadHls(fallbackProxyUrl, true);
                      } else {
                        addLog("Network Error! Attempting to recover...", 'warn');
                        hls.startLoad();
                      }
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      addLog("Media Error! Attempting to recover...", 'warn');
                      hls.recoverMediaError();
                      break;
                    default:
                      addLog(`Stream destroyed due to fatal error.`, 'err');
                      artInstance.notice.show = `⚠️ Stream Error`;
                      hls.destroy();
                      setTimeout(() => setErrorMsg('স্ট্রিমটি প্লে হতে ব্যর্থ হয়েছে।'), 3000);
                      break;
                  }
                }
              });
            };

            loadHls(url, false);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            addLog("HLS not supported natively, trying browser default...", 'warn');
            video.src = url;
          }
        },

        // ==========================================
        // 🔵 DASH (mpd) Smart Fallback
        // ==========================================
        mpd: async function (video, url, artInstance) {
          shaka.polyfill.installAll();

          if (!shaka.Player.isBrowserSupported()) {
            addLog("Browser not supported for Shaka Player (DASH)", 'err');
            artInstance.notice.show = "⚠️ Browser not supported for DASH!";
            return;
          }

          let isProxyFallback = false;
          shakaPlayer = new shaka.Player(video);

          shakaPlayer.getNetworkingEngine().registerRequestFilter((type: any, request: any) => {
            if (userAgent) request.headers['X-User-Agent'] = userAgent;
            if (cookie) request.headers['X-Cookie'] = cookie;
          });

          const shakaConfig: any = {
            abr: { enabled: true, defaultBandwidthEstimate: 1000000 },
            streaming: {
              bufferingGoal: 10,
              rebufferingGoal: 2,
              bufferBehind: 30,
              retryParameters: { maxAttempts: 3, baseDelay: 1000 }
            },
            manifest: { retryParameters: { maxAttempts: 3 } }
          };

          if (streamData.drm_key_id && streamData.drm_key) {
            addLog(`Applying Clearkey DRM... (KeyID: ${streamData.drm_key_id})`, 'info');
            shakaConfig.drm = {
              clearKeys: { [streamData.drm_key_id]: streamData.drm_key }
            };
          } else {
            addLog("No DRM keys provided.", 'info');
          }

          shakaPlayer.configure(shakaConfig);

          shakaPlayer.addEventListener('error', (event: any) => {
            addLog(`Shaka Error Detail: ${event.detail.code} | ${event.detail.message || 'Network Fail'}`, 'err');
            if (event.detail.severity === shaka.util.Error.Severity.CRITICAL) {
              if (isProxyFallback || !fallbackProxyUrl) {
                artInstance.notice.show = `⚠️ DRM/Stream Error`;
                setTimeout(() => setErrorMsg('DRM অথবা স্ট্রিম লিংকটি কাজ করছে না!'), 3000);
              }
            }
          });

          const loadDash = async (targetUrl: string, isProxy: boolean) => {
            try {
              addLog(`Loading Shaka Player (${isProxy ? 'Proxy' : 'Direct'})...`, 'warn');
              addLog(`Target URL: ${targetUrl}`, 'info');
              
              await shakaPlayer.load(targetUrl);
              
              addLog(`✅ DASH Manifest Loaded successfully via ${isProxy ? 'Proxy' : 'Direct'}`, 'ok');
              artInstance.notice.show = isProxy ? "🟢 Playing via Proxy" : "🟢 Playing Direct";
              
              const tracks = shakaPlayer.getVariantTracks();
              if (tracks.length > 0) {
                const resolutions = Array.from(new Set(tracks.map((t: any) => t.height))).sort((a: any, b: any) => b - a);
                const qualityOptions = resolutions.map(h => ({
                  html: h ? `${h}p` : 'Unknown',
                  level: h
                }));
                qualityOptions.unshift({ html: 'Auto', level: -1 });

                const qualitySetting = artInstance.setting.find('quality');
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
                        addLog('Quality switched to: Auto (ABR ON)', 'info');
                      } else {
                        shakaPlayer.configure({ abr: { enabled: false } });
                        const track = shakaPlayer.getVariantTracks().find((t: any) => t.height === targetHeight);
                        if (track) shakaPlayer.selectVariantTrack(track, true);
                        addLog(`Quality switched to: ${targetHeight}p (ABR OFF)`, 'warn');
                      }
                      return item.html;
                    },
                  });
                }
              }
            } catch (e: any) {
              addLog(`Shaka Load Failed: ${e.message || e.code}`, 'err');
              if (!isProxy && fallbackProxyUrl && !isProxyFallback) {
                isProxyFallback = true;
                addLog("Direct blocked (CORS/Network) → Switching to Proxy...", 'warn');
                artInstance.notice.show = "🔄 Direct Failed! Switching to Proxy...";
                loadDash(fallbackProxyUrl, true);
              }
            }
          };

          loadDash(url, false);
        }
      },
    });

    art.on('play', () => addLog('Video Playback Started', 'ok'));
    art.on('pause', () => addLog('Video Paused', 'warn'));
    art.on('waiting', () => addLog('Buffering/Waiting for data...', 'info'));

    return () => {
      addLog('Destroying player instances...', 'warn');
      if (hls) hls.destroy();
      if (shakaPlayer) shakaPlayer.destroy();
      if (art && art.destroy) art.destroy(false);
    };
  }, [streamData, addLog]);

  return (
    <div className="min-h-screen bg-[#070710] text-white flex flex-col items-center justify-start p-2 md:p-6 font-sans">
      
      {/* 📺 Top Bar */}
      <div className="w-full max-w-[1000px] flex items-center gap-3 mb-4 pb-3 border-b border-[#1c1c2e]">
        <div className="bg-[#c0392b] rounded-lg w-8 h-8 flex items-center justify-center text-lg flex-shrink-0 shadow-lg shadow-red-500/20">📺</div>
        <h1 className="text-base md:text-lg font-bold tracking-wide">HLS/DASH Smart Player</h1>
        <div className="ml-auto text-[10px] md:text-xs bg-[#1c1c2e] text-[#4a4a6a] px-3 py-1 rounded-full border border-[#2a2a3e]">
          Enterprise Engine
        </div>
      </div>

      <div className="w-full max-w-[1000px] bg-[#13131f] border border-[#1c1c2e] rounded-xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* 🎬 Video Frame */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          
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
                className="bg-[#0088cc] hover:bg-[#0077b3] text-white text-sm font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center gap-2 animate-bounce"
              >
                <span>বট থেকে নতুন লিংক নিন</span>
                <span>↗️</span>
              </a>
            </div>
          )}

          {!errorMsg && <div ref={playerRef} className="w-full h-full"></div>}
        </div>

        {/* 📟 Terminal Logs Section */}
        <div className="bg-[#0a0a14] p-3 md:p-4 border-t border-[#1c1c2e] flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-bold text-[#4a4a6a] uppercase tracking-wider">System Logs</span>
          </div>
          
          <div className="bg-[#070710] border border-[#1c1c2e] rounded-lg p-3 h-48 md:h-64 overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar shadow-inner">
            {logs.length === 0 && <span className="text-[#4a4a6a]">Waiting for engine initialization...</span>}
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`mb-1 break-words ${
                  log.type === 'ok' ? 'text-[#00c853]' : 
                  log.type === 'err' ? 'text-[#ff1744]' : 
                  log.type === 'warn' ? 'text-[#ffd600]' : 
                  'text-[#40c4ff]'
                }`}
              >
                <span className="opacity-60 mr-2">[{log.time}]</span> 
                {log.msg}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
