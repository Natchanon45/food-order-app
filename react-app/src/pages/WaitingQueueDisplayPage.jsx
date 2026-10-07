import { useEffect, useMemo, useRef, useState } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useI18n } from "@/i18n/I18nProvider";
import { waitingQueueNamespaceTranslator } from "@/i18n/waitingQueueI18n";
import { useParityPage } from "@/hooks/useParityPage";
import { watchPublicQueueBoard } from "@/data/waitingQueueCore";

const VOICE_BASE = { th: "/assets/audio/waiting-queue-th", en: "/assets/audio/waiting-queue-en" };

export function WaitingQueueDisplayPage() {
  const { locale, intlLocale } = useI18n();
  const tr = useMemo(() => waitingQueueNamespaceTranslator(locale, "waiting_queue_display"), [locale]);
  const stylesReady = useParityPage({ title: tr("meta.title"), styles: ["retail-pos.css", "waiting-queue-display.css"] });
  const tenantId = useMemo(() => new URLSearchParams(location.search).get("tenantId")?.trim() || "", []);
  const [rows, setRows] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("waiting_queue_display_sound") !== "off");
  const [soundArmed, setSoundArmed] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(Boolean(VOICE_BASE[locale]));
  const lastSignature = useRef("");
  const audioContext = useRef(null);

  useEffect(() => {
    if (!tenantId) { setInitialReady(true); return undefined; }
    setInitialReady(false);
    return watchPublicQueueBoard(
      tenantId,
      nextRows => { setRows(nextRows); setInitialReady(true); },
      error => { console.error("WAITING_DISPLAY_WATCH_FAILED", error); setInitialReady(true); },
    );
  }, [tenantId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { clearInterval(timer); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const todayKey = useMemo(() => {
    const date = new Date(now);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }, [now]);
  const todayRows = useMemo(
    () => rows.filter(row => String(row.queueDate || "") === todayKey),
    [rows, todayKey],
  );
  const called = useMemo(() => todayRows.filter(row => ["called","acknowledged","preparing_table"].includes(row.status)).sort((a,b) => Number(b.calledAtMs || b.updatedAtMs || 0)-Number(a.calledAtMs || a.updatedAtMs || 0)), [todayRows]);
  const primary = called[0] || null;
  const upcoming = useMemo(() => todayRows.filter(row => ["waiting","deferred"].includes(row.status)).sort((a,b) => Number(a.effectiveQueuedAtMs || a.queuedAtMs || 0)-Number(b.effectiveQueuedAtMs || b.queuedAtMs || 0)).slice(0,3), [todayRows]);

  const ensureContext = async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioContext.current || audioContext.current.state === "closed") audioContext.current = new Ctx();
    if (audioContext.current.state === "suspended") await audioContext.current.resume();
    return audioContext.current;
  };
  const chime = async () => {
    try {
      const ctx = await ensureContext(); if (!ctx) return false; const start=ctx.currentTime; const master=ctx.createGain(); master.gain.setValueAtTime(.72,start); master.connect(ctx.destination);
      [659.25,783.99,987.77,783.99].forEach((frequency,index)=>{ const at=start+index*.24, duration=index===3?.48:.36, osc=ctx.createOscillator(), gain=ctx.createGain(); osc.frequency.setValueAtTime(frequency,at); gain.gain.setValueAtTime(.0001,at); gain.gain.exponentialRampToValueAtTime(.18,at+.025); gain.gain.exponentialRampToValueAtTime(.0001,at+duration); osc.connect(gain); gain.connect(master); osc.start(at); osc.stop(at+duration+.02); }); return true;
    } catch { return false; }
  };
  const playFile = src => new Promise(resolve => { const a=new Audio(src); a.onended=()=>resolve(true); a.onerror=()=>resolve(false); a.play().catch(()=>resolve(false)); });
  const announce = async queueNumber => {
    if (!soundEnabled || !soundArmed) return; await chime(); await new Promise(r=>setTimeout(r,1320));
    const base=VOICE_BASE[locale]; if (!base || !voiceAvailable) return;
    const digits=String(queueNumber||"").replace(/\D/g,"").split("");
    for (const src of [`${base}/intro.wav`,...digits.map(d=>`${base}/${d}.wav`),`${base}/outro.wav`]) { if (!await playFile(src)) { setVoiceAvailable(false); break; } }
  };

  useEffect(() => {
    if (!primary) { lastSignature.current=""; return; }
    const signature=`${primary.waitingQueueId}:${primary.calledAtMs || primary.updatedAtMs}:${primary.recallSignalAtMs || 0}`;
    if (signature !== lastSignature.current) { lastSignature.current=signature; announce(primary.queueNumber); }
  }, [primary?.waitingQueueId, primary?.calledAtMs, primary?.updatedAtMs, primary?.recallSignalAtMs, soundArmed, soundEnabled, locale]);

  const toggleSound = async () => {
    if (!soundEnabled || !soundArmed) {
      setSoundEnabled(true); localStorage.setItem("waiting_queue_display_sound","on");
      try { const ctx=await ensureContext(); if (ctx?.state === "running") { setSoundArmed(true); if (primary) setTimeout(()=>announce(primary.queueNumber),0); else chime(); } } catch {}
      return;
    }
    setSoundEnabled(false); localStorage.setItem("waiting_queue_display_sound","off");
  };
  const countdown = row => {
    const deadline=Number(row?.responseDeadlineAtMs||0); if (!deadline) return tr("called.instruction");
    const seconds=Math.ceil((deadline-now)/1000); if (seconds<=0) return tr("called.overdue");
    const min=Math.floor(seconds/60), sec=seconds%60; return tr("called.countdown",{time:`${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`});
  };
  const clock = new Date(now).toLocaleString(intlLocale,{weekday:"long",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const ready=soundEnabled && soundArmed;
  const audioMode=!ready ? tr("audio.off") : voiceAvailable && VOICE_BASE[locale] ? tr("audio.mode_voice") : tr("audio.mode_chime");

  if (!stylesReady || !initialReady) return <PageReadyOverlay />;

  return <main className="waiting-display-shell">
    <header className="waiting-display-head">
      <div className="waiting-display-brand"><span className="waiting-display-logo" aria-hidden="true"><i className="bi bi-megaphone"></i></span><div><strong>{tr("header.title")}</strong><span>{tr("header.description")}</span></div></div>
      <div className="waiting-display-head-actions">
        <span id="waitingDisplayClock" className="waiting-display-clock">{clock}</span>
        <button id="waitingDisplaySound" className={"waiting-display-sound"+(ready?" is-armed":"")} type="button" aria-label={tr(ready?"controls.sound_off_aria":"controls.sound_on_aria")} onClick={toggleSound}><i className={ready?"bi bi-volume-up":"bi bi-volume-mute"}></i><span>{tr(ready?"controls.sound_off":"controls.sound_on")}</span></button>
        <button id="waitingDisplayFullscreen" type="button" aria-label={tr("controls.fullscreen_aria")} onClick={async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{}}}><i className="bi bi-fullscreen"></i><span>{tr("controls.fullscreen")}</span></button>
      </div>
    </header>
    <div id="waitingDisplayAudioNotice" className={"waiting-display-audio-notice"+(ready?" is-ready":"")} role="status"><i className={ready?"bi bi-check-circle":"bi bi-volume-up"}></i><span>{ready ? (voiceAvailable?tr("audio.ready_recorded"):tr("audio.ready_chime")) : tr("audio.prompt")}</span></div>
    <section className="waiting-display-main">
      <div className="waiting-display-current"><div className="waiting-display-current-label">{tr("called.label")}</div>
        <div id="waitingDisplayCalledEmpty" className="waiting-display-empty-state" hidden={Boolean(primary)}><span className="waiting-display-empty-icon"><i className="bi bi-hourglass-split"></i></span><strong>{tenantId?tr("called.empty_title"):tr("errors.missing_link_title")}</strong><span>{tenantId?tr("called.empty_description"):tr("errors.missing_link_description")}</span></div>
        <div id="waitingDisplayCalledWrap" className="waiting-display-called-wrap" hidden={!primary}><strong id="waitingDisplayCalled" className="waiting-display-called">{primary?.queueNumber||"W---"}</strong><div className="waiting-display-instruction">{tr("called.instruction")}</div><div id="waitingDisplayCalledTimer" className={"waiting-display-timer"+(primary && Number(primary.responseDeadlineAtMs||0)<=now?" overdue":"")}>{primary?countdown(primary):""}</div></div>
      </div>
      <aside className="waiting-display-next-panel"><div className="waiting-display-next-head"><div><span>{tr("next.eyebrow")}</span><h2>{tr("next.title")}</h2></div><i className="bi bi-list-ol"></i></div>
        <div id="waitingDisplayNext" className="waiting-display-next">{upcoming.length?upcoming.map((row,index)=><article key={row.waitingQueueId||row.id}><span>{index+1}</span><strong>{row.queueNumber||"-"}</strong><small>{tr("next.party",{count:Number(row.partySize||1).toLocaleString(intlLocale)})}</small></article>):<div className="waiting-display-next-empty">{tr("next.empty")}</div>}</div>
        <p className="waiting-display-next-note">{tr("next.note")}</p>
      </aside>
    </section>
    <footer className="waiting-display-foot"><span id="waitingDisplayStatus" className={"waiting-display-status"+(!online?" offline":"")}>{!tenantId?tr("errors.missing_tenant"):tr(online?"status.online":"status.offline")}</span><span id="waitingDisplayAudioMode" className={"waiting-display-audio-mode"+(ready?" is-ready":"")}>{audioMode}</span><span>{tr("footer.privacy")}</span></footer>
  </main>;
}
