'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface StreamHeaders {
  referer?:   string;
  origin?:    string;
  cookie?:    string;
  userAgent?: string;
}

interface StreamData {
  title:       string;
  streamUrl:   string;
  stream_type: 'hls' | 'dash';
  logo?:       string;
  proxy_url?:  string;
  headers?:    StreamHeaders;
  drm_key_id?: string;
  drm_key?:    string;
}

type PlayMethod = 'direct' | 'proxy' | null;

function buildProxyUrl(base: string, url: string, ref?: string): string {
  try {
    const proxyUrl = new URL(base);
    proxyUrl.searchParams.set('url', url);
    if (ref) proxyUrl.searchParams.set('ref', ref);
    return proxyUrl.toString();
  } catch (e) {
    const b = base.replace(/\/$/, '');
    const sep = b.includes('?') ? '&' : '?';
    let out = `${b}${sep}url=${encodeURIComponent(url)}`;
    if (ref) out += `&ref=${encodeURIComponent(ref)}`;
    return out;
  }
}

export default function WatchPage() {
  const params  = useParams();
  const shortId = params.id as string;

  const playerRef = useRef<HTMLDivElement>(null);

  const [stream,     setStream]     = useState<StreamData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [playMethod, setPlayMethod] = useState<PlayMethod>(null);
  
  // 🎯 লাইভ লগ ট্র্যাকিং স্টেট
  const [logs,       setLogs]       = useState<string[]>([]);

  const TG_BOT = 'ratulnotific_bot';

  // লগ পুশ করার হেল্পার ফাংশন (ডিপেন্ডেন্সি লুপ এড়াতে ফাংশনাল আপডেট ব্যবহার করা হয়েছে)
  const addLog = (tag: string, msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] [${tag}] ${msg}`]);
  };

  // ── Fetch stream metadata ──────────────────────────────────
  useEffect(() => {
    addLog('API', `স্ট্রিম ডাটা খোঁজা হচ্ছে... ID: ${shortId}`);
    fetch(`/api/watch/${shortId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStream(data);
          addLog('API', `✅ ডাটা পাওয়া গেছে! টাইটেল: ${data.title}`);
          addLog('API', `🔗 মূল ইউআরএল: ${data.streamUrl}`);
          addLog('API', `🔁 প্রক্সি ইউআরএল: ${data.proxy_url || '❌ ডাটাবেসে কোনো প্রক্সি লিংক নাই!'}`);
        } else {
          const err = data.message ?? 'স্ট্রিমটি আর সচল নেই বা মুছে ফেলা হয়েছে!';
          setErrorMsg(err);
          addLog('API', `❌ এরর: ${err}`);
        }
        setLoading(false);
      })
      .catch((e) => {
        setErrorMsg('সার্ভার থেকে ডাটা আনতে সমস্যা হয়েছে!');
        addLog('API', `❌ সার্ভার এরর: ${e.message}`);
        setLoading(false);
      });
  }, [shortId]);

  // ── Init player (browser-only, dynamic imports) ────────────
  useEffect(() => {
    if (!stream || !playerRef.current) return;

    let art:  any = null;
    let hls:  any = null;
    let shak: any = null;
    let dead      = false;

    const { referer = '' } = stream.headers ?? {};
    const proxyUrl = stream.proxy_url
      ? buildProxyUrl(stream.proxy_url, stream.streamUrl, referer || undefined)
      : '';
    const isDash = stream.stream_type === 'dash';

    async function init() {
      addLog('PLAYER', `প্লেয়ার লোড হচ্ছে... টাইপ: ${stream!.stream_type.toUpperCase()}`);
      
      const [
        { default: Artplayer },
        { default: Hls },
        shakaModule,
      ] = await Promise.all([
        import('artplayer'),
        import('hls.js'),
        import('shaka-player'),
      ]);

      if (dead || !playerRef.current) return;
      const shaka = shakaModule.default ?? shakaModule;
      addLog('PLAYER', `✅ আর্টপ্লেয়ার এবং লাইব্রেরি মডিউল ইম্পোর্ট সম্পন্ন।`);

      // ────────────────────────────────────────────────
      // HLS custom type handler
      // ────────────────────────────────────────────────
      function handleHls(video: HTMLVideoElement, artInst: any) {
        if (!Hls.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            addLog('HLS', `Safari নেটিভ প্লেব্যাক ব্যবহার করা হচ্ছে।`);
            video.src = stream!.streamUrl;
          } else {
            addLog('HLS', `❌ এই ব্রাউজারে HLS সাপোর্ট করে না!`);
          }
          return;
        }

        let proxied = false;

        function loadHls(url: string, isProxy: boolean) {
          if (hls) hls.destroy();
          addLog('HLS', `${isProxy ? '🔁 প্রক্সি লিংকে' : '⚡ ডিরেক্ট লিংকে'} HLS কানেক্ট করা হচ্ছে...`);

          hls = new Hls({
            lowLatencyMode:         true,
            maxBufferLength:        30,
            fragLoadingTimeOut:     15_000,
            manifestLoadingTimeOut: 12_000,
          });

          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (dead) return;
            addLog('HLS', `🎉 ম্যানিফেস্ট পার্সড! ভিডিও চলা শুরু হয়েছে। (${isProxy ? 'Proxy' : 'Direct'})`);
            setPlayMethod(isProxy ? 'proxy' : 'direct');
            artInst.notice.show = isProxy ? '🔁 Proxy-তে চলছে' : '✅ Direct-এ চলছে';
          });

          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            addLog('HLS_WARN', `ইভেন্ট এরর কোড: ${data.details} | Fatal: ${data.fatal}`);
            if (!data.fatal) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              addLog('HLS_ERR', `❌ নেটওয়ার্ক এরর ধরা পড়েছে!`);
              if (!isProxy && proxyUrl && !proxied) {
                proxied = true;
                addLog('HLS', `⚠️ ডিরেক্ট লিংক ফেল করেছে। প্রক্সি লিংকে সুইচ করা হচ্ছে...`);
                artInst.notice.show = '⚡ Proxy-তে সুইচ হচ্ছে…';
                loadHls(proxyUrl, true);
              } else {
                addLog('HLS', `রিকানেক্ট করার চেষ্টা করা হচ্ছে...`);
                hls.startLoad();
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              addLog('HLS_ERR', `মিডিয়া এরর! রিকভার করার চেষ্টা করা হচ্ছে...`);
              hls.recoverMediaError();
            } else {
              if (!dead) {
                addLog('HLS_FATAL', `স্ট্রিম লোড হতে সম্পূর্ণ ব্যর্থ।`);
                setErrorMsg('স্ট্রিমটি প্লে হতে ব্যর্থ হয়েছে।');
              }
            }
          });
        }

        loadHls(stream!.streamUrl, false);
      }

      // ────────────────────────────────────────────────
      // DASH custom type handler
      // ────────────────────────────────────────────────
      async function handleDash(video: HTMLVideoElement, artInst: any) {
        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
          addLog('DASH', `❌ এই ব্রাউজারে DASH সাপোর্ট নেই!`);
          if (!dead) setErrorMsg('এই ব্রাউজারে DASH সাপোর্ট নেই!');
          return;
        }

        let proxied = false;
        shak = new shaka.Player(video);

        const cfg: any = {
          abr: { enabled: true, defaultBandwidthEstimate: 1_000_000 },
          streaming: {
            bufferingGoal:   10,
            rebufferingGoal: 2,
            bufferBehind:    30,
            retryParameters: { maxAttempts: 3, baseDelay: 1000 },
          },
          manifest: { retryParameters: { maxAttempts: 3 } },
        };

        if (stream!.drm_key_id && stream!.drm_key) {
          addLog('DASH', `🔐 DRM কী ডিটেক্ট হয়েছে। কি আইডি: ${stream!.drm_key_id}`);
          cfg.drm = { clearKeys: { [stream!.drm_key_id]: stream!.drm_key } };
        }

        shak.configure(cfg);

        shak.addEventListener('error', (e: any) => {
          addLog('DASH_ERR', `Shaka Error Code: ${e.detail.code} | Severity: ${e.detail.severity}`);
          if (
            e.detail.severity === shaka.util.Error.Severity.CRITICAL &&
            (proxied || !proxyUrl) &&
            !dead
          ) {
            addLog('DASH_FATAL', `DRM অথবা স্ট্রিম লিংক ক্র্যাশ করেছে।`);
            setErrorMsg('DRM বা স্ট্রিম লিংকটি কাজ করছে না!');
          }
        });

        async function loadDash(url: string, isProxy: boolean) {
          try {
            addLog('DASH', `${isProxy ? '🔁 প্রক্সি লিংকে' : '⚡ ডিরেক্ট লিংকে'} DASH লোড হচ্ছে...`);
            await shak.load(url);
            if (dead) return;
            addLog('DASH', `🎉 DASH সফলভাবে লোড হয়েছে!`);
            setPlayMethod(isProxy ? 'proxy' : 'direct');
            artInst.notice.show = isProxy ? '🔁 Proxy-তে চলছে' : '✅ Direct-এ চলছে';
          } catch (err) {
            if (!isProxy && proxyUrl && !proxied) {
              proxied = true;
              addLog('DASH', `⚠️ ডিরেক্ট লিংক ফেল! প্রক্সিতে ট্রাই করা হচ্ছে...`);
              artInst.notice.show = '⚡ Proxy-তে সুইচ হচ্ছে…';
              loadDash(proxyUrl, true);
            } else if (!dead) {
              addLog('DASH_FATAL', `DASH স্ট্রিম প্লে করতে ব্যর্থ।`);
              setErrorMsg('স্ট্রিমটি লোড হয়নি।');
            }
          }
        }

        loadDash(stream!.streamUrl, false);
      }

      // ────────────────────────────────────────────────
      // Create ArtPlayer instance
      // ────────────────────────────────────────────────
      addLog('PLAYER', `আর্টপ্লেয়ার কনফিগারেশন ইনিশিয়েট হচ্ছে...`);
      art = new Artplayer({
        container: playerRef.current!,
        url:       stream!.streamUrl,
        type:      isDash ? 'mpd' : 'm3u8',
        poster:    stream!.logo ?? '',
        volume:    0.8,
        isLive:    true,
        muted:     true,
        autoplay:  true,
        playsInline:     true,
        autoOrientation: true,
        lock:            true,
        setting:       true,
        fullscreen:    true,
        theme:         '#ef4444',
        customType: {
          m3u8: (video: HTMLVideoElement, _url: string, inst: any) => {
            handleHls(video, inst);
          },
          mpd: async (video: HTMLVideoElement, _url: string, inst: any) => {
            await handleDash(video, inst);
          },
        },
      });
    }

    init().catch(e => {
      addLog('CRITICAL_ERR', `প্লেয়ার ক্র্যাশ করেছে: ${e.message}`);
    });

    return () => {
      dead = true;
      hls?.destroy();
      shak?.destroy();
      art?.destroy?.(false);
      addLog('PLAYER', `প্লেয়ার রিলিজ (Cleanup) করা হয়েছে।`);
    };
  }, [stream]);

  return (
    <div className="min-h-screen bg-[#06060f] text-white flex flex-col items-center justify-center p-2 md:p-5">
      <div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden shadow-2xl border border-white/5"
        style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #080810 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          {stream?.logo && (
            <img
              src={stream.logo}
              alt={stream.title}
              className="w-9 h-9 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0"
            />
          )}

          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-sm md:text-base truncate flex items-center gap-2">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {stream?.title ?? 'Live Stream'}
            </span>

            {playMethod && (
              <span
                className={`text-[10px] font-semibold mt-0.5 w-fit px-2 py-px rounded-full border ${
                  playMethod === 'direct'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                    : 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                }`}
              >
                {playMethod === 'direct' ? '⚡ Direct' : '🔁 Proxy'}
              </span>
            )}
          </div>

          <Link
            href="/"
            className="flex-shrink-0 text-xs font-semibold bg-white/5 hover:bg-red-600
                       border border-white/10 hover:border-red-600
                       px-3 py-1.5 rounded-xl transition-all duration-200"
          >
            ← ফিরে যান
          </Link>
        </div>

        {/* Player area */}
        <div className="relative w-full aspect-video md:h-[70vh] md:aspect-auto bg-black">
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black gap-3">
              <div className="w-11 h-11 border-[3px] border-red-500/30 border-t-red-500 rounded-full animate-spin" />
              <p className="text-xs text-white/30 tracking-wide">লোড হচ্ছে…</p>
            </div>
          )}

          {errorMsg && !loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center
                            bg-[#080810]/95 backdrop-blur-sm p-6 text-center">
              <div className="text-5xl mb-4">📡</div>
              <h2 className="text-base md:text-lg font-bold text-red-400 mb-1">স্ট্রিম ব্যর্থ হয়েছে</h2>
              <p className="text-xs text-white/40 mb-6 max-w-xs leading-relaxed">{errorMsg}</p>

              <a
                href={`https://t.me/${TG_BOT}?start=${shortId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8fc4]
                           text-white text-sm font-bold px-5 py-2.5 rounded-xl"
              >
                বট থেকে নতুন লিংক নিন ↗
              </a>
            </div>
          )}

          {!errorMsg && <div ref={playerRef} className="w-full h-full" />}
        </div>
      </div>

      {/* 🎯 নতুন যুক্ত করা লাইভ ডেভলপার লগ টার্মিনাল UI */}
      <div className="w-full max-w-[1400px] mt-4 p-4 bg-[#0c0c14] rounded-2xl border border-white/5 font-mono text-xs shadow-2xl">
        <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2 text-white/40 font-sans font-bold">
          <span className="flex items-center gap-2 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            🖥️ Live Debug Logs (লাইভ ট্র্যাকিং টার্মিনাল)
          </span>
          <button 
            onClick={() => setLogs([])} 
            className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-white transition-all"
          >
            Clear Logs
          </button>
        </div>
        <div className="h-44 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-2">
          {logs.length === 0 ? (
            <p className="text-white/20 italic tracking-wide">কোনো লগ নেই। স্ট্রিম শুরু হওয়ার অপেক্ষা করা হচ্ছে...</p>
          ) : (
            logs.map((log, i) => {
              let color = "text-gray-300";
              if (log.includes("[❌") || log.includes("_ERR") || log.includes("_FATAL")) color = "text-red-400";
              else if (log.includes("[✅") || log.includes("🎉")) color = "text-emerald-400";
              else if (log.includes("⚠️") || log.includes("_WARN")) color = "text-amber-400";
              else if (log.includes("[API]")) color = "text-sky-400";
              
              return <div key={i} className={`text-[11px] leading-relaxed break-all ${color}`}>{log}</div>;
            })
          )}
        </div>
      </div>
    </div>
  );
}
