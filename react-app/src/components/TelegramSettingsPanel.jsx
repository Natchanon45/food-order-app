import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

function showAppToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 3200);
}

const platformChannels = [
  { purpose: "superadmin_slip_manual", title: "Superadmin • แจ้งสลิปการชำระเงิน",
    detail: "แจ้งทุกผลการตรวจสลิปค่าบริการ ส่วนแบ่ง Delivery และเติมเครดิต Lalamove รวมถึงกรณีรอตรวจด้วยคน" },
];
const tenantChannels = [
  { purpose: "admin_store", title: "Admin ร้านค้า • แจ้งเตือนการเงินและ COD",
    detail: "แจ้ง Admin ร้านนี้ทุกผลตรวจสลิปที่ส่งถึง Superadmin (เติมเครดิต ค่าบริการ ส่วนแบ่ง Delivery) และแจ้งคำขอ COD ตามร้าน โดยไม่ส่งลิงก์ที่ต้องใช้สิทธิ์ Superadmin" },
  { purpose: "cashier_delivery", title: "แคชเชียร์ • ออร์เดอร์ Delivery ใหม่",
    detail: "แจ้งแคชเชียร์พร้อมลิงก์เปิดหน้าจัดการออร์เดอร์และรหัสรายการ" },
  { purpose: "kitchen_delivery", title: "ครัว • ออร์เดอร์ Delivery ใหม่",
    detail: "แจ้งครัวพร้อมลิงก์เปิดคิวอาหารและรหัสออร์เดอร์" },
];
const emptyChannel = purpose => ({
  purpose, chatId: "", botToken: "", enabled: false,
  tokenConfigured: false, tokenMasked: "", clearToken: false,
  savedChatId: "", savedEnabled: false,
});
const errorLabel = error => {
  const code = String(error?.message || "");
  if (code === "TELEGRAM_CREDENTIALS_REQUIRED") return "ต้องกรอก Chat ID และ Token ก่อนเปิดใช้งาน";
  if (code === "TELEGRAM_CREDENTIALS_INVALID") return "Bot Token หรือ Chat ID ไม่ถูกต้อง";
  if (code === "TELEGRAM_TEST_SEND_FAILED") return "Telegram ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Bot และ Chat ID";
  if (code === "TELEGRAM_CHANNEL_NOT_READY") return "ช่องทางนี้ยังไม่พร้อมส่ง กรุณาบันทึก Bot Token และ Chat ID ก่อน";
  if (code === "TELEGRAM_SETTINGS_SAVE_UNCONFIRMED") return "ยังไม่สามารถยืนยันผลการบันทึกได้";
  if (code === "TELEGRAM_SETTINGS_SAVE_FAILED") return "ไม่สามารถบันทึกข้อมูล Telegram ได้";
  if (code === "TELEGRAM_SETTINGS_UNAVAILABLE") return "ฐานข้อมูลการแจ้งเตือนยังไม่พร้อม กรุณาตรวจสอบ Migration";
  return "เกิดข้อผิดพลาดในการตั้งค่า โปรดตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง";
};
async function request(endpoint, options) {
  if (!endpoint.startsWith("/api/platform/telegram")) {
    throw new Error("TELEGRAM_SETTINGS_UNAVAILABLE");
  }
  const method = String(options?.method || "GET").toUpperCase();
  const name = method === "GET" ? "getPlatformTelegramSettings"
    : endpoint.endsWith("/test") ? "testPlatformTelegramSettings"
    : "savePlatformTelegramSettings";
  const payload = options?.body ? JSON.parse(options.body) : {};
  try {
    const response = await httpsCallable(functions, name)(payload);
    const result = response?.data;
    if (!result?.ok) throw new Error("TELEGRAM_SETTINGS_UNAVAILABLE");
    return result;
  } catch (error) {
    if (error?.code === "functions/failed-precondition") {
      const typed = String(error?.details?.code || error?.message || "");
      if (typed.includes("TELEGRAM_")) throw new Error(typed.match(/TELEGRAM_[A-Z_]+/)?.[0] || "TELEGRAM_SETTINGS_UNAVAILABLE");
    }
    throw error;
  }
}
function TelegramChannel({ definition, channel, onChange, onSave, onTest, saving, testing }) {
  const id = "telegram-" + definition.purpose;
  // The test endpoint uses SERVER-PERSISTED credentials, not unsaved edits.
  // Disable Test until the current Chat ID / enabled state has been saved.
  const configured = channel.tokenConfigured && Boolean(channel.chatId) &&
    channel.chatId.trim() === channel.savedChatId &&
    channel.enabled === channel.savedEnabled;
  const needToken = channel.enabled && !channel.tokenConfigured && !channel.clearToken;
  return (
    <fieldset className="lukkaja-telegram-channel" data-telegram-channel={definition.purpose} disabled={saving || testing}>
      <legend>{definition.title}</legend>
      <p>{definition.detail}</p>
      {/* Use the SOURCE-wide FormValidationUi instead of panel-local errors.
          The shared validator scans this form and renders its standard feedback. */}
      <form className="lukkaja-telegram-form" onSubmit={event => {event.preventDefault(); onSave();}}>
        <label className="lukkaja-telegram-checkbox">
          <input type="checkbox" checked={channel.enabled} onChange={event => onChange({ enabled: event.target.checked })} />
          <span>เปิดรับการแจ้งเตือนช่องทางนี้</span>
        </label>
        <div className="lukkaja-telegram-input-grid">
          <label htmlFor={id+"-token"}>
            <strong>Telegram Bot Token</strong>
            <input id={id+"-token"} type="password" autoComplete="new-password" spellCheck="false"
              placeholder={channel.tokenConfigured ? "ตั้งค่าแล้ว " + channel.tokenMasked + " • ว่างไว้เพื่อใช้ค่าเดิม" : "กรอก Bot Token จาก @BotFather"}
              value={channel.botToken}
              onChange={event => onChange({ botToken: event.target.value, clearToken: false })}
              maxLength={160} required={needToken}
              pattern="[0-9]{7,20}:(?:[a-zA-Z0-9_]|-){30,120}"
              title="Bot Token ต้องเป็นรหัสตัวเลข ตามด้วย : และรหัสที่ได้รับจาก @BotFather" />
            <small>{channel.tokenConfigured ? "Token ถูกเข้ารหัสแล้ว ไม่สามารถแสดงค่าเดิมได้" : "Token จะถูกเข้ารหัสในฐานข้อมูลและไม่ส่งกลับมาที่ Browser"}</small>
          </label>
          <label htmlFor={id+"-chat"}>
            <strong>Chat ID</strong>
            <input id={id+"-chat"} type="text" inputMode="text"
              placeholder="-100xxxxxxxxxx หรือเลขแชทส่วนตัว"
              value={channel.chatId}
              onChange={event => onChange({ chatId: event.target.value })}
              maxLength={80} required={channel.enabled}
              pattern="-?[0-9]{5,20}"
              title="Chat ID ต้องเป็นตัวเลข 5–20 หลัก และอาจขึ้นต้นด้วยเครื่องหมายลบ" />
            <small>Bot ต้องอยู่ในแชทหรือกลุ่มที่ระบุ และมีสิทธิ์ส่งข้อความ</small>
          </label>
        </div>
        {channel.tokenConfigured ? (
          <label className="lukkaja-telegram-clear">
            <input type="checkbox" checked={channel.clearToken}
              onChange={event => onChange({clearToken: event.target.checked, botToken:"", enabled: event.target.checked ? false : channel.enabled})} />
            ลบ Bot Token ที่บันทึกไว้ (ปิดช่องทางนี้)
          </label>
        ) : null}
        <div className="lukkaja-telegram-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || testing}>
            <i className="bi bi-floppy" aria-hidden="true"></i>{saving ? "กำลังบันทึก..." : "บันทึกช่องทาง"}
          </button>
          <button type="button" className="btn" onClick={onTest}
            disabled={!configured || !channel.enabled || Boolean(channel.botToken) || channel.clearToken || saving || testing}>
            <i className="bi bi-send" aria-hidden="true"></i>{testing ? "กำลังส่ง..." : "ส่งข้อความทดสอบ"}
          </button>
        </div>
      </form>
    </fieldset>
  );
}
export function TelegramSettingsPanel({ scope = "tenant", onActiveCountChange }) {
  const definitions = scope === "platform" ? platformChannels : tenantChannels;
  const endpoint = scope === "platform" ? "/api/platform/telegram" : "/api/tenant/telegram";
  const [channels, setChannels] = useState(() => Object.fromEntries(
    definitions.map(def => [def.purpose, emptyChannel(def.purpose)])));
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [testBusy, setTestBusy] = useState("");
  const [writeUncertain, setWriteUncertain] = useState(false);
  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError("");
    try {
      const data = await request(endpoint);
      if (data.storageReady !== true || !Array.isArray(data.channels)) throw Error("TELEGRAM_SETTINGS_UNAVAILABLE");
      const items = Object.fromEntries(definitions.map(def => {
        const saved = data.channels.find(item => item.purpose === def.purpose) || {};
        return [def.purpose, {
          ...emptyChannel(def.purpose), ...saved,
          botToken: "", clearToken: false,
          savedChatId: String(saved.chatId || ""),
          savedEnabled: Boolean(saved.enabled),
        }];
      }));
      setChannels(items);
      onActiveCountChange?.(definitions.filter(def => items[def.purpose]?.enabled &&
        items[def.purpose]?.tokenConfigured && items[def.purpose]?.chatId).length);
      setStatus("ready");
      setWriteUncertain(false);
    } catch (error) {
      const message = errorLabel(error);
      setStatus("error"); setLoadError(message);
      showAppToast(message, "error");
    }
  }, [endpoint, scope]);
  useEffect(() => { void load(); }, [load]);
  const patch = (purpose, value) => setChannels(current => ({
    ...current, [purpose]: {...current[purpose], ...value},
  }));
  const save = async purpose => {
    const current = channels[purpose];
    if (!current || writeUncertain || busy || testBusy) return;
    // Required / pattern / length checks are owned by FormValidationUi,
    // which intercepts this channel form's submit before this callback.
    setBusy(purpose);
    try {
      const data = await request(endpoint, {
        method:"PUT", body:JSON.stringify({
          purpose, chatId:current.chatId.trim(), botToken:current.botToken.trim(),
          clearToken:current.clearToken, enabled:current.enabled,
        }),
      });
      if (!data?.item || data.item.purpose !== purpose) throw Error("TELEGRAM_SETTINGS_SAVE_UNCONFIRMED");
      const next={...channels, [purpose]:{...emptyChannel(purpose),...data.item,
        savedChatId: String(data.item.chatId || ""),
        savedEnabled: Boolean(data.item.enabled)}};
      setChannels(next);
      onActiveCountChange?.(definitions.filter(def => next[def.purpose]?.savedEnabled &&
        next[def.purpose]?.tokenConfigured && next[def.purpose]?.savedChatId).length);
      showAppToast("บันทึกการตั้งค่า Telegram สำเร็จ");
    } catch (error) {
      // A definite validation rejection is safe to correct and submit again.
      // Network/server/ambiguous acknowledgement remains locked until reload,
      // preventing accidental duplicate sensitive writes.
      const definiteRejection = error?.status === 422 || error?.status === 400;
      if (!definiteRejection) setWriteUncertain(true);
      showAppToast(errorLabel(error) + (definiteRejection ? "" : " • โปรดโหลดข้อมูลใหม่ก่อนบันทึกซ้ำ"), "error");
    } finally { setBusy(""); }
  };
  const test = async purpose => {
    if (busy || testBusy || writeUncertain) return;
    setTestBusy(purpose);
    try {
      const data = await request(endpoint + "/test", {
        method:"POST", body:JSON.stringify({purpose}),
      });
      if (data.sent !== true) throw Error("TELEGRAM_TEST_SEND_FAILED");
      showAppToast("ส่งข้อความทดสอบแล้ว กรุณาตรวจสอบใน Telegram");
    } catch (error) {
      showAppToast(errorLabel(error), "error");
    } finally {setTestBusy("");}
  };
  return (
    <section className="lukkaja-telegram-panel" data-telegram-settings={scope}>
      <div className="lukkaja-telegram-heading">
        <div className="lukkaja-telegram-icon"><i className="bi bi-telegram" aria-hidden="true"></i></div>
        <div>
          <h2>การแจ้งเตือนผ่าน Telegram</h2>
          <p>แจ้งเตือนผ่าน Bot ชั่วคราว พร้อมปุ่มเปิดรายการใน PENGUIN</p>
        </div>
        <button className="btn btn-sm" type="button" onClick={() => void load()}
          disabled={Boolean(busy) || Boolean(testBusy)}><i className="bi bi-arrow-clockwise" aria-hidden="true"></i>โหลดใหม่</button>
      </div>
      <div className="lukkaja-telegram-info">
        สร้าง Bot ผ่าน <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a>
        {" "}เพิ่ม Bot ลงในแชทหรือกลุ่มที่ต้องการ แล้วนำ Token และ Chat ID มากรอก
        <span> ระบบจะส่งเฉพาะข้อมูลสรุปและลิงก์ ไม่ส่งภาพสลิปหรือข้อมูลส่วนตัวผ่าน Telegram</span>
      </div>
      {status==="loading"?<p role="status">กำลังโหลดการตั้งค่า Telegram...</p>:null}
      {status==="error"?<p role="alert" className="lukkaja-telegram-message error">{loadError}</p>:null}
      {status==="ready" && definitions.map(def => (
        <TelegramChannel key={def.purpose} definition={def} channel={channels[def.purpose]}
          onChange={value => patch(def.purpose,value)}
          onSave={() => {if (!writeUncertain) void save(def.purpose);}}
          onTest={() => void test(def.purpose)}
          saving={busy===def.purpose || writeUncertain}
          testing={testBusy===def.purpose} />
      ))}
      {writeUncertain?<p role="alert" className="lukkaja-telegram-message error">ผลการบันทึกไม่ชัดเจน เพื่อป้องกันการส่งซ้ำกรุณากดโหลดใหม่ก่อน</p>:null}
    </section>
  );
}
