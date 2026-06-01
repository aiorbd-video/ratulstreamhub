'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────
// ✅ NO top-level imports for Artplayer / Hls / Shaka
//    They are dynamically imported inside useEffect (browser-only)
//    This fixes: "player shows but stream doesn't play" in Next.js 14
// ─────────────────────────────────────────────────────────────

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
  const b   = base.replace(/\/$/, '') + '/';
  const sep = b.includes('?') ? '&' : '?';
  let out   = `${b}${sep}url=${encodeURIComponent(url)}`;
  if (ref) out += `&ref=${encodeURIComponent(ref)}`;
  return out;
}

// ─────────────────────────────────────────────────────────────

export default function WatchPage() {
  const params  = useParams();
  const shortId = params.id as string;

  const playerRef = useRef<HTMLDivElement>(null);

  const [stream,     setStream]     = useState<StreamData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [playMethod, setPlayMethod] = useState<PlayMethod>(null);

  const TG_BOT = 'ratulnotific_bot';

  // ── Fetch stream metadata ──────────────────────────────────
  useEffect(() => {
    fetch(`/api/watch/${shortId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setStream(data);
        else setErrorMsg(data.message ?? 'স্ট্রিমটি আর সচল নেই বা মুছে ফেলা হয়েছে!');
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('সার্ভার থেকে ডাটা আনতে সমস্যা হয়েছে!');
        setLoading(false);
      });
  }, [shortId]);

  // ── Init player (browser-only, dynamic imports) ────────────
  useEffect(() => {
    if (!stream || !playerRef.current) return;

    // Refs for cleanup
    let art:  any = null;
    let hls:  any = null;
    let shak: any = null;
    let dead      = false; // guard against stale closures after unmount

    const { referer = '' } = stream.headers ?? {};
    const proxyUrl = stream.proxy_url
      ? buildProxyUrl(stream.proxy_url, stream.streamUrl, referer || undefined)
      : '';
    const isDash = stream.stream_type === 'dash';

    async function init() {
      // ✅ Dynamic imports — only runs in browser, never on server
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

      // ────────────────────────────────────────────────
      // HLS custom type handler
      // ────────────────────────────────────────────────
      function handleHls(video: HTMLVideoElement, artInst: any) {
        if (!Hls.isSupported()) {
          // Safari native HLS fallback
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = stream!.streamUrl;
          }
          return;
        }

        let proxied = false;

        function loadHls(url: string, isProxy: boolean) {
          if (hls) hls.destroy();

          hls = new Hls({
            lowLatencyMode:         true,
            maxBufferLength:        30,
            fragLoadingTimeOut:     15_000,
            manifestLoadingTimeOut: 12_000,
          });

          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
            if (dead) return;
            setPlayMethod(isProxy ? 'proxy' : 'direct');
            artInst.notice.show = isProxy ? '🔁 Proxy-তে চলছে' : '✅ Direct-এ চলছে';

            // Quality levels
            if (hls.levels.length > 1 && !artInst.setting.find('quality')) {
              artInst.setting.add({
                name:     'quality',
                width:    180,
                html:     '🎬 গুণমান',
                tooltip:  'Auto',
                selector: [
                  { html: 'Auto', value: -1, default: true },
                  ...hls.levels.map((l: any, i: number) => ({
                    html:    l.height ? `${l.height}p` : `Level ${i + 1}`,
                    value:   i,
                    default: false,
                  })),
                ],
                onSelect(item: any) {
                  hls.currentLevel = Number(item.value);
                  return item.html;
                },
              });
            }
          });

          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (!isProxy && proxyUrl && !proxied) {
                proxied = true;
                artInst.notice.show = '⚡ Proxy-তে সুইচ হচ্ছে…';
                loadHls(proxyUrl, true);
              } else {
                hls.startLoad();
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              if (!dead) setErrorMsg('স্ট্রিমটি প্লে হতে ব্যর্থ হয়েছে।');
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

        if (stream!.drm_key_id && stream!.drm_key)
          cfg.drm = { clearKeys: { [stream!.drm_key_id]: stream!.drm_key } };

        shak.configure(cfg);

        shak.addEventListener('error', (e: any) => {
          if (
            e.detail.severity === shaka.util.Error.Severity.CRITICAL &&
            (proxied || !proxyUrl) &&
            !dead
          ) setErrorMsg('DRM বা স্ট্রিম লিংকটি কাজ করছে না!');
        });

        async function loadDash(url: string, isProxy: boolean) {
          try {
            await shak.load(url);
            if (dead) return;
            setPlayMethod(isProxy ? 'proxy' : 'direct');
            artInst.notice.show = isProxy ? '🔁 Proxy-তে চলছে' : '✅ Direct-এ চলছে';

            const tracks = shak.getVariantTracks() as any[];
            if (tracks.length > 0 && !artInst.setting.find('quality')) {
              const heights: number[] = Array.from(
                new Set(tracks.map((t: any) => t.height))
              ).sort((a, b) => b - a);

              artInst.setting.add({
                name:     'quality',
                width:    180,
                html:     '🎬 গুণমান',
                tooltip:  'Auto',
                selector: [
                  { html: 'Auto', value: -1, default: true },
                  ...heights.map((h) => ({ html: h ? `${h}p` : '?', value: h, default: false })),
                ],
                onSelect(item: any) {
                  const h = Number(item.value);
                  if (h === -1) {
                    shak.configure({ abr: { enabled: true } });
                  } else {
                    shak.configure({ abr: { enabled: false } });
                    const t = shak.getVariantTracks().find((t: any) => t.height === h);
                    if (t) shak.selectVariantTrack(t, true);
                  }
                  return item.html;
                },
              });
            }
          } catch {
            if (!isProxy && proxyUrl && !proxied) {
              proxied = true;
              artInst.notice.show = '⚡ Proxy-তে সুইচ হচ্ছে…';
              loadDash(proxyUrl, true);
            } else if (!dead) {
              setErrorMsg('স্ট্রিমটি লোড হয়নি।');
            }
          }
        }

        loadDash(stream!.streamUrl, false);
      }

      // ────────────────────────────────────────────────
      // Create ArtPlayer instance
      // ────────────────────────────────────────────────
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
        fastForward:     true,
        lock:            true,
        airplay:         true,

        pip:           true,
        autoMini:      true,
        setting:       true,
        playbackRate:  true,
        aspectRatio:   true,
        fullscreen:    true,
        fullscreenWeb: true,
        hotkey:        true,
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

    init().catch(console.error);

    // ── Cleanup ──────────────────────────────────────────────
    return () => {
      dead = true;
      hls?.destroy();
      shak?.destroy();
      art?.destroy?.(false);
    };
  }, [stream]);

  // ── Render ─────────────────────────────────────────────────
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
        <div className="relative w-full aspect-video md:h-[76vh] md:aspect-auto bg-black">
          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black gap-3">
              <div className="w-11 h-11 border-[3px] border-red-500/30 border-t-red-500 rounded-full animate-spin" />
              <p className="text-xs text-white/30 tracking-wide">লোড হচ্ছে…</p>
            </div>
          )}

          {/* Error */}
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
                           text-white text-sm font-bold px-5 py-2.5 rounded-xl
                           shadow-lg shadow-sky-500/20 transition-all duration-200
                           hover:scale-[1.02] active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                বট থেকে নতুন লিংক নিন ↗
              </a>
            </div>
          )}

          {/* Player mount */}
          {!errorMsg && <div ref={playerRef} className="w-full h-full" />}
        </div>
      </div>
    </div>
  );
}
