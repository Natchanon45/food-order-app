import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { createOrderAlertAudioController } from "@/components/orderAlertAudio";
import { deliveryKitchenAdmitted } from "@/data/deliveryKitchenGate";
import { cashierOrderAlertEligible } from "@/components/orderAlertEligibility";

const ENABLED_KEY = "food_order_order_alerts_enabled_v4";
const CLOSED = new Set(["paid", "completed", "cancelled", "deleted", "voided"]);

function initialEnabled() {
  try {
    const stored = localStorage.getItem(ENABLED_KEY);
    if (stored === null) {
      localStorage.setItem(ENABLED_KEY, "1");
      return true;
    }
    return stored === "1";
  } catch {
    return true;
  }
}

function actualOrder(order) {
  if (!order?.id || CLOSED.has(String(order.status || "").toLowerCase())) return false;
  return (Array.isArray(order.items) ? order.items : []).some(
    item => !item?.cancelled && Number(item?.qty || 0) > 0,
  );
}

export function CashierOrderNotifier({ orders = [], onToast, surface = "cashier" }) {
  const { t } = useI18n();
  const [enabled, setEnabledState] = useState(initialEnabled);
  const [armed, setArmed] = useState(false);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const titleTimerRef = useRef(null);
  const titleResetTimerRef = useRef(null);
  const controllerRef = useRef(null);
  const announcementChainRef = useRef(Promise.resolve());

  if (!controllerRef.current) controllerRef.current = createOrderAlertAudioController();

  const rows = useMemo(
    () => orders.filter(actualOrder)
      .filter(order => cashierOrderAlertEligible(order, surface))
      .filter(order => surface !== "kitchen" || deliveryKitchenAdmitted(order)),
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
    if (!enabled || armed) return undefined;
    let active = true;
    const tryArm = () => {
      controllerRef.current.arm().then(ok => {
        if (active && ok) setArmed(true);
      }).catch(() => {});
    };
    const unlockFromInteraction = event => {
      if (event?.target?.closest?.("#orderAlertButton")) return;
      tryArm();
    };

    tryArm();
    document.addEventListener("pointerdown", unlockFromInteraction, true);
    document.addEventListener("keydown", unlockFromInteraction, true);
    document.addEventListener("touchstart", unlockFromInteraction, { capture: true, passive: true });
    return () => {
      active = false;
      document.removeEventListener("pointerdown", unlockFromInteraction, true);
      document.removeEventListener("keydown", unlockFromInteraction, true);
      document.removeEventListener("touchstart", unlockFromInteraction, true);
    };
  }, [enabled, armed]);

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

    const incoming = t(
      newOrders.length > 1
        ? "notifications.order.incoming_count"
        : "notifications.order.incoming",
      { count: newOrders.length },
    );
    onToast?.(!armed ? `${incoming} • ${t("notifications.order.enable")}` : incoming);
    flashTitle(newOrders.length);

    newOrders.forEach(order => {
      announcementChainRef.current = announcementChainRef.current
        .catch(() => {})
        .then(async () => {
          const result = await controllerRef.current.announce(order);
          if (result?.chimePlayed) setArmed(true);
        });
    });
  }, [rows, enabled, armed, t, onToast]);

  useEffect(() => () => {
    stopTitleAlert();
    controllerRef.current?.cancel?.();
  }, []);

  const toggle = async () => {
    if (!enabled || !armed) {
      setEnabled(true);
      const ok = await controllerRef.current.arm();
      setArmed(ok);
      if (ok) await controllerRef.current.playChime();
      onToast?.(t(ok ? "notifications.order.enabled" : "notifications.order.enable"));
      return;
    }

    controllerRef.current.cancel();
    setArmed(false);
    setEnabled(false);
    onToast?.(t("notifications.order.disabled"));
  };

  const label = t(
    !enabled
      ? "notifications.order.enable"
      : armed
        ? "notifications.order.disable"
        : "notifications.order.enable",
  );

  return (
    <button
      type="button"
      id="orderAlertButton"
      className="delivery-alert-toggle order-alert-toggle"
      data-enabled={enabled ? "true" : "false"}
      data-armed={armed ? "true" : "false"}
      data-surface={surface}
      aria-pressed={String(enabled && armed)}
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
        className={`bi bi-${!enabled ? "bell-slash" : armed ? "bell-fill" : "bell"} app-icon`}
        aria-hidden="true"
      />
    </button>
  );
}
