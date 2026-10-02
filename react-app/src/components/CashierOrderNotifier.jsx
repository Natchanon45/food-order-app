import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

const ENABLED_KEY = "food_order_order_alerts_enabled_v3";
const CLOSED = new Set(["paid", "completed", "cancelled", "deleted", "voided"]);

function initialEnabled() {
  try {
    const stored = localStorage.getItem(ENABLED_KEY);
    if (stored === null) {
      localStorage.setItem(ENABLED_KEY, "0");
      return false;
    }
    return stored === "1";
  } catch {
    return false;
  }
}

function actualOrder(order) {
  if (!order?.id || CLOSED.has(String(order.status || "").toLowerCase())) return false;
  return (Array.isArray(order.items) ? order.items : []).some(
    item => !item?.cancelled && Number(item?.qty || 0) > 0,
  );
}

function eligible(order, surface = "cashier") {
  if (!actualOrder(order)) return false;
  const type = String(order.orderType || "").toLowerCase();
  return surface === "kitchen" ? true : type !== "walkin";
}

export function CashierOrderNotifier({ orders = [], onToast, surface = "cashier" }) {
  const { t } = useI18n();
  const [enabled, setEnabledState] = useState(initialEnabled);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const titleTimerRef = useRef(null);
  const titleResetTimerRef = useRef(null);
  const audioRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  const rows = useMemo(
    () => orders.filter(order => eligible(order, surface)),
    [orders, surface],
  );

  const setEnabled = value => {
    setEnabledState(value);
    try {
      localStorage.setItem(ENABLED_KEY, value ? "1" : "0");
    } catch {}
  };

  const stopTitleAlert = () => {
    window.clearInterval(titleTimerRef.current);
    window.clearTimeout(titleResetTimerRef.current);
    titleTimerRef.current = null;
    titleResetTimerRef.current = null;
  };

  const unlockOrderSound = () => {
    const audio = audioRef.current;
    if (!audio || audioUnlockedRef.current) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 0.0001;
      const playback = audio.play();
      playback?.then?.(() => {
        audioUnlockedRef.current = true;
        window.setTimeout(() => {
          try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0.95;
          } catch {}
        }, 80);
      }).catch?.(error => {
        console.warn("[order-notifier] HTMLAudioElement unlock blocked", error);
      });
    } catch (error) {
      console.warn("[order-notifier] HTMLAudioElement unlock failed", error);
    }
  };

  const playOrderSound = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.95;
      const playback = audio.play();
      playback?.catch?.(error => {
        console.warn("[order-notifier] HTMLAudioElement playback blocked", error);
      });
    } catch (error) {
      console.warn("[order-notifier] HTMLAudioElement playback failed", error);
    }
  };

  const flashTitle = count => {
    stopTitleAlert();
    const alertTitle = t(
      count > 1 ? "notifications.order.new_count" : "notifications.order.new",
      { count },
    );
    const original = document.title;
    let visible = true;

    document.title = alertTitle;
    titleTimerRef.current = window.setInterval(() => {
      document.title = visible ? original : alertTitle;
      visible = !visible;
    }, 900);

    titleResetTimerRef.current = window.setTimeout(() => {
      stopTitleAlert();
      document.title = original;
    }, 12000);
  };

  useEffect(() => {
    const ids = rows.map(order => String(order.id));

    if (!initializedRef.current) {
      initializedRef.current = true;
      seenRef.current = new Set(ids);
      return;
    }

    const newOrders = rows.filter(order => !seenRef.current.has(String(order.id)));
    ids.forEach(id => seenRef.current.add(id));

    if (!enabled || !newOrders.length) return;

    onToast?.(
      t(
        newOrders.length > 1
          ? "notifications.order.incoming_count"
          : "notifications.order.incoming",
        { count: newOrders.length },
      ),
    );
    playOrderSound();
    flashTitle(newOrders.length);
  }, [rows, enabled, t, onToast]);

  useEffect(() => () => {
    stopTitleAlert();
  }, []);

  const toggle = () => {
    const next = !enabled;
    if (next) unlockOrderSound();
    setEnabled(next);
  };

  const label = t(
    enabled ? "notifications.order.disable" : "notifications.order.enable",
  );

  return (
    <>
      <audio
        ref={audioRef}
        src="/assets/audio/order-notification.wav?v=20260930-001"
        preload="auto"
        aria-hidden="true"
        style={{ display: "none" }}
      />
      <button
      type="button"
      id="orderAlertButton"
      className="delivery-alert-toggle order-alert-toggle"
      data-enabled={enabled ? "true" : "false"}
      aria-pressed={String(enabled)}
      aria-label={label}
      title={label}
      onClick={toggle}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        border: "1px solid #d9e5dc",
        borderRadius: "50%",
        background: "#fff",
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      }}
    >
      <i
        className={`bi bi-${enabled ? "bell-fill" : "bell-slash"} app-icon`}
        aria-hidden="true"
      />
      </button>
    </>
  );
}
