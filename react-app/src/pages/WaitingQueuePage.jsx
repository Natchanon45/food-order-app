import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { resetFormValidationUi } from "@/components/FormValidationUi";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { sweetAlert, sweetConfirm, sweetPrompt } from "@/components/sweetDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { waitingQueueTranslator } from "@/i18n/waitingQueueI18n";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { qrDataUrl } from "@/utils/localQr";
import {
  WAITING_QUEUE_ACTIVE_STATUSES,
  WAITING_QUEUE_STATUS,
  acknowledgeCustomerResponse,
  callCountdownSeconds,
  compatibleQueuesForTable,
  createWaitingQueue,
  customerTrackingUrl,
  ensureWaitingNumberLease,
  estimateWaitRange,
  getWaitingQueueOutbox,
  isOnline,
  loadWaitingQueueTables,
  queueDisplayUrl,
  recallWaitingQueue,
  recommendQueueForTable,
  schedulePublicSnapshotRefresh,
  seatWaitingQueue,
  syncWaitingQueueOutbox,
  transitionWaitingQueue,
  waitDurationMinutes,
  watchWaitingQueuePublicResponses,
  watchWaitingQueues,
} from "@/data/waitingQueueCore";

const ROLES = new Set(["owner", "admin", "manager", "cashier"]);
const LONG_WAIT_MINUTES = 60;

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-${type === "error" ? "x-circle" : "check-circle"} app-icon"></i></span><span class="app-toast-message"></span>`;
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, 2800);
}

function waitText(queue, locale) {
  const minutes = waitDurationMinutes(queue);
  if (minutes < 1) return locale === "en" ? "Less than 1 minute" : "น้อยกว่า 1 นาที";
  if (minutes < 60) return locale === "en" ? `${minutes} min` : `${minutes.toLocaleString("th-TH")} นาที`;
  const hours = Math.floor(minutes / 60), remain = minutes % 60;
  return locale === "en" ? `${hours}h ${remain}m` : `${hours} ชม. ${remain} นาที`;
}
function statusClass(status) {
  return ({ waiting: "waiting", called: "called", acknowledged: "acknowledged", preparing_table: "preparing",
    seated: "seated", deferred: "deferred", no_show: "no-show", cancelled: "cancelled" })[status] || "waiting";
}
function queueActionList(queue, wq) {
  const actions = [];
  if ([WAITING_QUEUE_STATUS.WAITING, WAITING_QUEUE_STATUS.DEFERRED].includes(queue.status)) actions.push(["call", wq("actions.call"), "volume-up"]);
  if (queue.status === WAITING_QUEUE_STATUS.CALLED) {
    actions.push(["ack", wq("actions.acknowledge"), "check2-circle"]);
    actions.push(["recall", wq("actions.recall"), "volume-up"]);
  }
  if ([WAITING_QUEUE_STATUS.CALLED, WAITING_QUEUE_STATUS.ACKNOWLEDGED].includes(queue.status)) actions.push(["prepare", wq("actions.prepare"), "hourglass-split"]);
  if (WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status)) {
    actions.push(["seat", wq("seat.open"), "door-open"]);
    if (Number(queue.deferCount || 0) < Number(queue.maxDefers ?? 2)) actions.push(["defer", wq("actions.defer"), "arrow-clockwise"]);
    actions.push(["cancel", wq("actions.cancel"), "x-circle"]);
  }
  const countdown = callCountdownSeconds(queue);
  if (queue.status === WAITING_QUEUE_STATUS.CALLED && countdown !== null && countdown <= 0) actions.unshift(["no-show", wq("actions.no_show"), "person-x"]);
  actions.push(["copy", wq("actions.customer_link"), "qr-code"]);
  return actions;
}
function needLabels(queue, wq) {
  const tags = [];
  if (queue.needs?.highChair) tags.push(wq("needs.high_chair"));
  if (queue.needs?.wheelchair) tags.push(wq("needs.wheelchair"));
  if (queue.needs?.quietArea) tags.push(wq("needs.quiet"));
  if (queue.needs?.strollerSpace) tags.push(wq("needs.stroller"));
  if (queue.priority && queue.priority !== "normal") tags.push(wq(`priority.${queue.priority}`));
  return tags;
}

export function WaitingQueuePage() {
  const { profile, status: authStatus } = useAuth();
  const tenantState = useTenant();
  const tenant = tenantState.tenant;
  const { locale } = useI18n();
  const wq = useMemo(() => waitingQueueTranslator(locale), [locale]);
  const stylesReady = useParityPage({
    title: wq("meta.title"),
    bodyClass: "order-delivery-workspace waiting-queue-workspace",
    styles: ["app.css", "icons.css", "retail-pos.css", "sweet-dialog.css", "order-delivery-workspace-theme.css", "waiting-queue.css", "i18n.css", "waiting-queue-footer.css"],
    attributes: { "data-module": "waiting-queue" },
  });
  const [queues, setQueues] = useState([]);
  const [tables, setTables] = useState([]);
  const [publicRows, setPublicRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [partyFilter, setPartyFilter] = useState("all");
  const [clock, setClock] = useState(Date.now());
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState("");
  const [form, setForm] = useState({ customerName: "", phone: "", partySize: 2, priority: "normal", specialNote: "", highChair: false, wheelchair: false, quietArea: false, strollerSpace: false });
  const [ticket, setTicket] = useState(null);
  const [ticketQr, setTicketQr] = useState("");
  const [seat, setSeat] = useState(null);
  const [seatTableId, setSeatTableId] = useState("");
  const [seatReason, setSeatReason] = useState("");
  const [seatError, setSeatError] = useState("");
  const [seatBusy, setSeatBusy] = useState(false);
  const responseInFlight = useRef(new Set());
  const repairInFlight = useRef(new Set());
  const addDialogRef = useRef(null);
  const addFormRef = useRef(null);
  const ticketDialogRef = useRef(null);
  const seatDialogRef = useRef(null);

  const refreshTables = useCallback(async () => {
    if (!tenant?.id) return [];
    const rows = await loadWaitingQueueTables(tenant.id);
    setTables(rows);
    return rows;
  }, [tenant?.id]);

  const syncNow = useCallback(async () => {
    if (!tenant?.id || syncing) return;
    setSyncing(true);
    try {
      const result = await syncWaitingQueueOutbox(tenant.id, { maxOperations: 100 });
      if (result.processed > 0 && isOnline()) ensureWaitingNumberLease(tenant.id).catch(() => {});
      if (result.errors?.length) {
        await sweetAlert(result.errors[0].error?.message || wq("runtime.sync_error"), { title: wq("runtime.sync_incomplete"), type: "warning" });
      } else {
        toast(wq("runtime.sync_success", { count: result.processed }));
      }
    } catch (error) {
      console.error("WAITING_QUEUE_SYNC_FAILED", error);
      await sweetAlert(error?.message || wq("runtime.operation_failed"), { title: wq("runtime.operation_failed"), type: "error" });
    } finally { setSyncing(false); }
  }, [tenant?.id, syncing, wq]);

  useEffect(() => {
    if (!tenant?.id || !ROLES.has(profile?.role)) return;
    let alive = true;
    let stopQueues = () => {}, stopPublic = () => {};
    setLoading(true);
    refreshTables().catch(error => console.error("WAITING_TABLES_LOAD_FAILED", error));
    stopQueues = watchWaitingQueues(tenant.id, rows => {
      if (!alive) return;
      setQueues(rows);
      setLoading(false);
    }, error => {
      console.error("WAITING_QUEUE_WATCH_FAILED", error);
      if (alive) { setLoading(false); toast(wq("runtime.load_failed"), "error"); }
    });
    stopPublic = watchWaitingQueuePublicResponses(tenant.id, rows => { if (alive) setPublicRows(rows); }, console.warn);
    ensureWaitingNumberLease(tenant.id).catch(() => {});
    const tableTimer = setInterval(() => refreshTables().catch(() => {}), 15000);
    const clockTimer = setInterval(() => setClock(Date.now()), 15000);
    const onlineHandler = () => { setOnline(true); syncNow(); refreshTables().catch(() => {}); };
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    if (navigator.onLine) syncNow();
    return () => {
      alive = false; stopQueues(); stopPublic(); clearInterval(tableTimer); clearInterval(clockTimer);
      window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", offlineHandler);
    };
  }, [tenant?.id, profile?.role]);

  useEffect(() => {
    if (!tenant?.id || !queues.length) return;
    schedulePublicSnapshotRefresh(tenant.id, queues, tables);
  }, [tenant?.id, queues, tables]);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      for (const row of publicRows) {
        if (!row.customerResponse || responseInFlight.current.has(row.waitingQueueId)) continue;
        const queue = queues.find(item => item.id === row.waitingQueueId);
        if (!queue) continue;
        const shouldApply = (row.customerResponse === "on_the_way" && queue.status === "called")
          || (row.customerResponse === "cancel_requested" && WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status));
        if (!shouldApply) continue;
        responseInFlight.current.add(queue.id);
        try {
          await acknowledgeCustomerResponse(queue, row);
          toast(row.customerResponse === "on_the_way"
            ? wq("runtime.customer_confirmed", { queue: queue.queueNumber })
            : wq("runtime.customer_requested_cancel", { queue: queue.queueNumber }));
        } catch (error) { console.warn("WAITING_CUSTOMER_RESPONSE_FAILED", error); }
        finally { responseInFlight.current.delete(queue.id); }
      }
    })();
  }, [tenant?.id, publicRows, queues, wq]);

  useEffect(() => {
    if (!tenant?.id || !tables.length) return;
    queues.forEach(queue => {
      if (queue.status !== WAITING_QUEUE_STATUS.SEATED || queue.tableToken || !queue.tableId || repairInFlight.current.has(queue.id)) return;
      const table = tables.find(item => String(item.id) === String(queue.tableId));
      if (!table) return;
      repairInFlight.current.add(queue.id);
      seatWaitingQueue(queue.id, table, {
        tenantId: tenant.id,
        allowSeatRepair: true,
        reason: "ซ่อม session โต๊ะที่เปิดจากคิวรอโต๊ะรุ่นก่อนหน้า",
      }).then(result => {
        if (result?.repaired) refreshTables();
      }).catch(error => console.warn("WAITING_SEAT_REPAIR_FAILED", error))
        .finally(() => repairInFlight.current.delete(queue.id));
    });
  }, [tenant?.id, queues, tables, refreshTables, wq]);

  const active = useMemo(() => queues.filter(queue => WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status)), [queues]);
  const stats = useMemo(() => ({
    waiting: queues.filter(q => q.status === "waiting").length,
    called: queues.filter(q => ["called", "acknowledged", "preparing_table", "deferred"].includes(q.status)).length,
    overdue: queues.filter(q => q.status === "called" && (callCountdownSeconds(q, clock) ?? 1) <= 0).length,
    seated: queues.filter(q => q.status === "seated").length,
  }), [queues, clock]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return queues.filter(queue => {
      if (statusFilter === "active" && !WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status)) return false;
      if (statusFilter !== "active" && statusFilter !== "all" && queue.status !== statusFilter) return false;
      const size = Number(queue.partySize || 1);
      if (partyFilter === "1-2" && !(size <= 2)) return false;
      if (partyFilter === "3-4" && !(size >= 3 && size <= 4)) return false;
      if (partyFilter === "5+" && size < 5) return false;
      if (keyword) {
        const haystack = [queue.queueNumber, queue.customerName, queue.phone, queue.phoneMasked, queue.specialNote].join(" ").toLocaleLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    }).sort((a, b) => Number(a.effectiveQueuedAtMs || a.queuedAtMs || 0) - Number(b.effectiveQueuedAtMs || b.queuedAtMs || 0));
  }, [queues, search, statusFilter, partyFilter]);

  const availableTables = useMemo(() => tables.filter(table => table.available), [tables]);
  const recommendation = useMemo(() => {
    for (const table of availableTables) {
      const result = recommendQueueForTable(table, queues);
      if (result.recommendation) return { table, queue: result.recommendation };
    }
    return null;
  }, [availableTables, queues]);

  const intakeEstimate = useMemo(() => {
    const draft = {
      id: "waiting-intake-preview", partySize: Math.max(1, Number(form.partySize || 1)),
      needs: { highChair: form.highChair, wheelchair: form.wheelchair, quietArea: form.quietArea, strollerSpace: form.strollerSpace },
      queuedAtMs: Date.now(), effectiveQueuedAtMs: Date.now(), status: WAITING_QUEUE_STATUS.WAITING,
    };
    return estimateWaitRange(draft, [...queues, draft], tables);
  }, [form.partySize, form.highChair, form.wheelchair, form.quietArea, form.strollerSpace, queues, tables, clock]);

  const openAdd = () => {
    setForm({ customerName: "", phone: "", partySize: 2, priority: "normal", specialNote: "", highChair: false, wheelchair: false, quietArea: false, strollerSpace: false });
    setAddError(""); setAddOpen(true);
  };
  const submitAdd = async event => {
    event.preventDefault();
    if (!tenant?.id || addBusy) return;
    setAddBusy(true); setAddError("");
    try {
      const row = await createWaitingQueue({
        tenantId: tenant.id, customerName: form.customerName, phone: form.phone,
        partySize: Number(form.partySize), priority: form.priority,
        needs: { highChair: form.highChair, wheelchair: form.wheelchair, quietArea: form.quietArea, strollerSpace: form.strollerSpace },
        specialNote: form.specialNote, groupsAhead: intakeEstimate.groupsAhead,
        estimatedWaitMin: intakeEstimate.estimatedWaitMin, estimatedWaitMax: intakeEstimate.estimatedWaitMax, source: "staff",
      });
      // Close the intake dialog from the browser top layer first.
      // Opening the ticket dialog in the same commit can throw InvalidStateError
      // on Chromium and leave the React page blank.
      const intakeDialog = addDialogRef.current;
      setAddOpen(false);
      if (intakeDialog?.open) intakeDialog.close();
      await new Promise(resolve => requestAnimationFrame(resolve));

      toast(row.syncStatus === "synced" ? wq("runtime.added", { queue: row.queueNumber }) : wq("runtime.saved_offline", { queue: row.queueNumber }));
      setTicket(row);
    } catch (error) {
      console.error("WAITING_CREATE_FAILED", error);
      setAddError(error?.message || wq("runtime.add_failed"));
    } finally { setAddBusy(false); }
  };

  useEffect(() => {
    const dialog = addDialogRef.current;
    if (!dialog) return;
    try {
      if (addOpen) {
        resetFormValidationUi(addFormRef.current);
        if (!dialog.open) dialog.showModal();
        window.setTimeout(() => addFormRef.current?.querySelector("#waitingCustomerName")?.focus?.(), 50);
      } else if (dialog.open) {
        dialog.close();
      }
    } catch (error) {
      console.error("WAITING_ADD_DIALOG_FAILED", error);
    }
  }, [addOpen]);

  useEffect(() => {
    const dialog = ticketDialogRef.current;
    if (!dialog) return undefined;
    let frame = 0;

    if (ticket) {
      frame = requestAnimationFrame(() => {
        try {
          if (!dialog.open) dialog.showModal();
        } catch (error) {
          console.error("WAITING_TICKET_DIALOG_FAILED", error);
        }
      });
    } else {
      try {
        if (dialog.open) dialog.close();
      } catch (error) {
        console.error("WAITING_TICKET_DIALOG_FAILED", error);
      }
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ticket]);

  useEffect(() => {
    const dialog = seatDialogRef.current;
    if (!dialog) return;
    try {
      if (seat) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    } catch (error) {
      console.error("WAITING_SEAT_DIALOG_FAILED", error);
    }
  }, [seat]);

  useEffect(() => {
    if (!ticket) {
      setTicketQr("");
      return;
    }

    try {
      const url = customerTrackingUrl(ticket);
      setTicketQr(qrDataUrl(url, { size: 220, margin: 4 }));
    } catch (error) {
      console.error("WAITING_TICKET_QR_FAILED", error);
      setTicketQr("");
    }
  }, [ticket]);

  const transition = async (queue, toStatus, options = {}) => {
    try {
      const result = await transitionWaitingQueue(queue.id, toStatus, { tenantId: tenant.id, ...options });
      if (result?._operationResolution && result._operationResolution !== "already_applied") {
        await sweetAlert(result._operationResolutionReason || wq("runtime.queue_conflict"), { title: wq("runtime.update_latest"), type: "warning" });
      } else toast(options.successMessage || `${queue.queueNumber} • ${wq("runtime.update_latest")}`);
      return result;
    } catch (error) {
      console.error("WAITING_TRANSITION_FAILED", error);
      await sweetAlert(error?.message || wq("runtime.update_failed"), { title: wq("runtime.operation_failed"), type: "error" });
      return null;
    }
  };

  const handleAction = async (action, queue) => {
    if (!queue) return;
    if (action === "copy") { setTicket(queue); return; }
    if (action === "seat") { setSeat(queue); setSeatTableId(""); setSeatReason(""); setSeatError(""); return; }
    if (action === "recall") {
      try { await recallWaitingQueue(queue.id, { tenantId: tenant.id }); toast(wq("runtime.recalled", { queue: queue.queueNumber })); }
      catch (error) { await sweetAlert(error?.message || wq("runtime.recall_failed"), { title: wq("runtime.recall_failed"), type: "error" }); }
      return;
    }
    if (action === "call") {
      await transition(queue, WAITING_QUEUE_STATUS.CALLED, {
        action: "queue_called", reason: "พนักงานเรียกคิว", callTimeoutMinutes: 5,
        successMessage: wq("runtime.called", { queue: queue.queueNumber }),
      }); return;
    }
    if (action === "ack") {
      await transition(queue, WAITING_QUEUE_STATUS.ACKNOWLEDGED, { action: "staff_acknowledged", reason: "พนักงานยืนยันว่าลูกค้าตอบรับแล้ว" }); return;
    }
    if (action === "prepare") {
      await transition(queue, WAITING_QUEUE_STATUS.PREPARING_TABLE, { action: "table_preparing", reason: "เริ่มจัดโต๊ะให้ลูกค้า" }); return;
    }
    if (action === "defer") {
      const reason = await sweetPrompt(wq("runtime.defer_prompt"), "", {
        title: wq("runtime.defer_title", { queue: queue.queueNumber }),
        placeholder: wq("runtime.defer_reason_placeholder"), confirmText: wq("actions.defer"),
      });
      if (reason === null) return;
      if (!String(reason).trim()) { await sweetAlert(wq("runtime.reason_required"), { title: wq("runtime.reason_title"), type: "warning" }); return; }
      await transition(queue, WAITING_QUEUE_STATUS.DEFERRED, { action: "queue_deferred", reason, requireReason: true }); return;
    }
    if (["cancel", "no-show"].includes(action)) {
      const noShow = action === "no-show";
      const reason = await sweetPrompt(
        noShow
          ? (locale === "en" ? "Enter a reason or details for the no-show." : "ระบุเหตุผลหรือรายละเอียดการไม่มา")
          : (locale === "en" ? "Enter a reason for cancelling this queue." : "ระบุเหตุผลการยกเลิกคิว"),
        "",
        {
          title: noShow
            ? (locale === "en" ? `Record no-show ${queue.queueNumber}` : `บันทึกไม่มา ${queue.queueNumber}`)
            : (locale === "en" ? `Cancel queue ${queue.queueNumber}` : `ยกเลิกคิว ${queue.queueNumber}`),
          placeholder: locale === "en" ? "Reason" : "เหตุผล",
          confirmText: noShow ? wq("actions.no_show") : wq("customer.cancel_queue"),
          confirmIcon: noShow ? "person-x" : "check-circle",
        },
      );
      if (reason === null) return;
      if (!String(reason).trim()) { await sweetAlert(wq("runtime.reason_required"), { title: wq("runtime.reason_title"), type: "warning" }); return; }
      await transition(queue, noShow ? WAITING_QUEUE_STATUS.NO_SHOW : WAITING_QUEUE_STATUS.CANCELLED, {
        action: noShow ? "queue_no_show" : "queue_cancelled", reason, requireReason: true,
      });
    }
  };

  const seatAvailable = useMemo(() => {
    if (!seat) return [];
    const suitable = availableTables.filter(table => compatibleQueuesForTable(table, [seat]).length > 0);
    return [...suitable, ...availableTables.filter(table => !suitable.includes(table))];
  }, [seat, availableTables]);

  const selectedSeatTable = seatAvailable.find(table => String(table.id) === String(seatTableId)) || null;
  const seatReasonRequired = useMemo(() => {
    if (!seat || !selectedSeatTable) return false;
    const fits = compatibleQueuesForTable(selectedSeatTable, [seat]).length > 0;
    const recommended = recommendQueueForTable(selectedSeatTable, queues).recommendation;
    return !fits || Boolean(recommended && recommended.id !== seat.id);
  }, [seat, selectedSeatTable, queues]);

  const confirmSeat = async () => {
    if (!seat || !selectedSeatTable || seatBusy) return;
    if (seatReasonRequired && !seatReason.trim()) { setSeatError(wq("seat.reason_required")); return; }
    setSeatBusy(true); setSeatError("");
    try {
      const fairness = recommendQueueForTable(selectedSeatTable, queues);
      const result = await seatWaitingQueue(seat.id, selectedSeatTable, {
        tenantId: tenant.id, overrideReason: seatReason.trim(),
        fairnessContext: {
          recommendedQueueId: fairness.recommendation?.id || "",
          recommendedQueueNumber: fairness.recommendation?.queueNumber || "",
          skippedQueues: fairness.skipped.map(item => ({
            waitingQueueId: item.queue.id, queueNumber: item.queue.queueNumber,
            partySize: Number(item.queue.partySize || 1), reason: item.reason,
          })),
        },
      });
      toast(wq("runtime.seat_success", { table: selectedSeatTable.label, queue: seat.queueNumber }));
      setSeat(null); await refreshTables();
      const go = await sweetConfirm(wq("runtime.seat_confirm_question"), {
        title: wq("runtime.seat_confirm_title"), confirmText: wq("runtime.go_order"),
        cancelText: wq("runtime.stay_here"), type: "success",
      });
      if (go && result?.orderUrl) location.href = result.orderUrl;
    } catch (error) {
      console.error("WAITING_SEAT_FAILED", error);
      setSeatError(error?.message || wq("runtime.seat_failed"));
    } finally { setSeatBusy(false); }
  };

  const copyTicket = async () => {
    if (!ticket) return;
    const url = customerTrackingUrl(ticket);
    try {
      await navigator.clipboard.writeText(url);
      toast(wq("runtime.copied", { queue: ticket.queueNumber }));
    } catch {
      await sweetPrompt(wq("ticket.copy"), url, {
        title: wq("ticket.title"), confirmText: wq("ticket.close"), readOnly: true, selectValue: true,
      });
    }
  };
  const printTicket = () => {
    if (!ticket) return;
    const url = customerTrackingUrl(ticket);
    const popup = window.open("", "_blank", "width=480,height=760");
    if (!popup) { toast(wq("runtime.operation_failed"), "error"); return; }
    const estimate = estimateWaitRange(ticket, queues, tables);
    popup.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${wq("ticket.title")} ${ticket.queueNumber}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:28px}h1{font-size:52px;margin:12px}.qr{margin:18px auto;width:220px;height:220px}.meta{font-size:18px;line-height:1.8}</style></head><body>
      <h2>${wq("ticket.brand")}</h2><div>${wq("ticket.number")}</div><h1>${ticket.queueNumber}</h1>
      ${ticketQr ? `<img class="qr" src="${ticketQr}" alt="QR">` : ""}
      <div class="meta">${wq("ticket.party_size")}: ${ticket.partySize}<br>${wq("ticket.estimate")}: ${estimate.estimatedWaitMin}–${estimate.estimatedWaitMax} นาที<br>${wq("ticket.ahead")}: ${estimate.groupsAhead}</div>
      <p>${wq("ticket.instruction")}</p><small>${url}</small><script>window.onload=()=>window.print();<\/script></body></html>`);
    popup.document.close();
  };

  if (authStatus === "loading" || tenantState.status === "loading" || !stylesReady || (tenant && loading)) {
    return <PageReadyOverlay context="PENGUIN" title={wq("hero.loading_actor")} message={wq("controls.syncing")} progress={82} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fwaiting-queue" replace />;
  if (!ROLES.has(profile.role) || tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const publicFor = queue => publicRows.find(row => row.waitingQueueId === queue.id || row.token === queue.publicToken);
  const statusText = status => wq(`queue.status.${status}`);
  const formatTime = ms => Number(ms) ? new Date(Number(ms)).toLocaleTimeString(locale === "en" ? "en-US" : "th-TH", { hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <>
      <header className="app-header waiting-app-header">
        <div className="waiting-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><i className="bi bi-person-standing app-icon" aria-hidden="true"></i><span>{wq("header.title")}</span></div>
          <a className="btn btn-dark btn-sm waiting-home-link" href="/?from=waiting-queue" aria-label={wq("header.back")} title={wq("header.back")}><i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>{wq("header.back")}</span></a>
        </div>
        <LocaleSwitcher />
      </header>

      <main className="waiting-page">
        <section className="waiting-page-header" aria-labelledby="waitingPageTitle">
          <div className="waiting-page-heading">
            <h1 id="waitingPageTitle">{wq("hero.title")}</h1>
            <p id="waitingTenantName">{tenant.name || tenant.id} • {profile.displayName || profile.email || profile.role}</p>
            <div className="waiting-flow" aria-label={wq("hero.flow_aria")}>
              <span>{wq("hero.step_receive")}</span><i className="bi bi-chevron-right"></i>
              <span>{wq("hero.step_call")}</span><i className="bi bi-chevron-right"></i>
              <span>{wq("hero.step_table")}</span><i className="bi bi-chevron-right"></i>
              <span>{wq("hero.step_open")}</span>
            </div>
          </div>
        </section>

        <section className="waiting-control-card" aria-label={wq("controls.aria")}>
          <div className="waiting-control-title"><i className="bi bi-sliders"></i><div><strong>{wq("controls.title")}</strong><span>{wq("controls.description")}</span></div></div>
          <div className="waiting-header-actions">
            <div className="waiting-connection-group">
              <span id="waitingOnlineState" className={"waiting-connectivity" + (online ? "" : " offline")}><i className={online ? "bi bi-wifi" : "bi bi-wifi-off"}></i><span>{wq(online ? "controls.online" : "controls.offline")}</span></span>
              <span id="waitingSyncState" className="waiting-sync-text">{getWaitingQueueOutbox(tenant.id).length ? wq("runtime.pending_sync") : wq("controls.synced")}</span>
            </div>
            <button id="waitingSyncBtn" className="btn btn-secondary" type="button" disabled={syncing} onClick={syncNow}><i className="bi bi-arrow-repeat"></i><span>{wq(syncing ? "controls.syncing" : "controls.sync")}</span></button>
            <button id="openWaitingDisplayBtn" className="btn btn-secondary" type="button" onClick={() => window.open(queueDisplayUrl(tenant.id), "waiting-queue-display", "noopener")}><i className="bi bi-display"></i><span>{wq("controls.display")}</span></button>
            <button id="addWaitingQueueBtn" className="btn btn-pay" type="button" onClick={openAdd}><i className="bi bi-plus-lg"></i><span>{wq("controls.add")}</span></button>
          </div>
        </section>
        <section className="waiting-stats" aria-label={wq("stats.aria")}>
          <article className="waiting-stat"><span>{wq("stats.waiting")}</span><strong id="waitingStatWaiting">{stats.waiting}</strong><small>{wq("stats.waiting_unit")}</small></article>
          <article className="waiting-stat called"><span>{wq("stats.in_progress")}</span><strong id="waitingStatCalled">{stats.called}</strong><small>{wq("stats.in_progress_note")}</small></article>
          <article className="waiting-stat overdue"><span>{wq("stats.follow_up")}</span><strong id="waitingStatOverdue">{stats.overdue}</strong><small>{wq("stats.overdue")}</small></article>
          <article className="waiting-stat seated"><span>{wq("stats.seated_today")}</span><strong id="waitingStatSeated">{stats.seated}</strong><small>{wq("stats.waiting_unit")}</small></article>
        </section>

        <div className="waiting-layout">
          <section className="panel waiting-panel waiting-main-panel">
            <div className="section-heading waiting-section-heading"><div><h2><i className="bi bi-list-ol"></i> {wq("queue.title")}</h2><p>{wq("queue.description")}</p></div></div>
            <div className="waiting-toolbar" aria-label={wq("queue.filter_aria")}>
              <label className="waiting-filter-field waiting-search"><span>{wq("queue.search_label")}</span><div className="waiting-control-wrap"><i className="bi bi-search"></i><input id="waitingSearch" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={wq("queue.search_placeholder")} /></div></label>
              <label className="waiting-filter-field"><span>{wq("queue.status_label")}</span><select id="waitingStatusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {["active","all","waiting","called","acknowledged","preparing_table","deferred","seated","no_show","cancelled"].map(value => <option value={value} key={value}>{wq(`queue.status.${value}`)}</option>)}
              </select></label>
              <label className="waiting-filter-field"><span>{wq("queue.party_label")}</span><select id="waitingPartyFilter" value={partyFilter} onChange={e => setPartyFilter(e.target.value)}>
                <option value="all">{wq("queue.party.all")}</option><option value="1-2">{wq("queue.party.one_two")}</option><option value="3-4">{wq("queue.party.three_four")}</option><option value="5+">{wq("queue.party.five_plus")}</option>
              </select></label>
            </div>
            <div id="waitingRecommendation" className="waiting-recommendation" role="status" aria-live="polite">
              {recommendation ? <><strong>{wq("tables.recommended_latest")}</strong> {recommendation.table.label} → {recommendation.queue.queueNumber}</> : null}
            </div>
            <div id="waitingQueueList" className="waiting-queue-list">
              {filtered.map(queue => {
                const estimate = estimateWaitRange(queue, queues, tables);
                const countdown = callCountdownSeconds(queue, clock);
                const publicRow = publicFor(queue);
                const longWait = WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status) && waitDurationMinutes(queue) >= LONG_WAIT_MINUTES;
                const overdue = queue.status === "called" && countdown !== null && countdown <= 0;
                const tags = needLabels(queue, wq);
                return <article className={`waiting-queue-card ${statusClass(queue.status)}${overdue ? " is-overdue" : ""}${longWait ? " is-long-wait" : ""}`} data-queue-id={queue.id} key={queue.id}>
                  <div className="waiting-queue-number-wrap">
                    <strong className="waiting-queue-number">{queue.queueNumber || "W---"}</strong>
                    {queue.queueNumberProvisional ? <span className="waiting-provisional">{wq("runtime.provisional")}</span> : null}
                    <span className="waiting-queued-time">{wq("runtime.received_at", { time: formatTime(queue.queuedAtMs) })}</span>
                  </div>
                  <div className="waiting-queue-customer">
                    <div className="waiting-customer-title"><strong>{queue.customerName || wq("common.unknown_name")}</strong><span>{wq("common.people", { count: queue.partySize || 1 })}</span></div>
                    <div className="waiting-customer-meta">{queue.phoneMasked || queue.phone || wq("common.no_phone")} • {wq("runtime.actual_wait", { duration: waitText(queue, locale) })}</div>
                    <div className="waiting-tags">
                      {tags.map(tag => <span key={tag}>{tag}</span>)}
                      {queue.specialNote ? <span title={queue.specialNote}>{wq("common.note_prefix")}: {queue.specialNote}</span> : null}
                    </div>
                    {publicRow?.customerResponse === "on_the_way" ? <span className="waiting-response yes">{wq("runtime.customer_on_way")}</span> : publicRow?.customerResponse === "cancel_requested" ? <span className="waiting-response cancel">{wq("runtime.customer_cancel")}</span> : null}
                  </div>
                  <div className="waiting-queue-estimate">
                    <span>{wq("runtime.estimate")}</span>
                    <strong>{wq("common.minute_range", { from: estimate.estimatedWaitMin, to: estimate.estimatedWaitMax })}</strong>
                    <small>{wq("runtime.ahead_count", { count: estimate.groupsAhead })}</small>
                  </div>
                  <div className="waiting-queue-status-wrap">
                    <span className={`waiting-status ${statusClass(queue.status)}`}>{statusText(queue.status)}</span>
                    {queue.status === "called" && countdown !== null ? <span className={"waiting-countdown" + (overdue ? " overdue" : "")}>{overdue ? wq("runtime.response_overdue") : wq("common.remaining_minutes", { count: Math.max(0, Math.ceil(countdown / 60)) })}</span> : null}
                    {longWait ? <span className="waiting-long-wait">{wq("runtime.long_wait", { count: LONG_WAIT_MINUTES })}</span> : null}
                    {queue.syncStatus && queue.syncStatus !== "synced" ? <span className={`waiting-sync-badge ${queue.syncStatus}`}>{wq(queue.syncStatus === "conflict" ? "runtime.data_conflict" : "runtime.pending_sync")}</span> : null}
                  </div>
                  <div className="waiting-queue-actions">{queueActionList(queue, wq).map(([action,label,icon]) => <button type="button" data-queue-action={action} data-queue-id={queue.id} className={`waiting-action ${action}`} key={action} onClick={() => handleAction(action, queue)}><i className={`bi bi-${icon}`} aria-hidden="true"></i><span>{label}</span></button>)}</div>
                </article>;
              })}
            </div>
            <div id="waitingQueueEmpty" className="waiting-empty" hidden={filtered.length > 0}><i className="bi bi-inbox"></i><strong>{wq("queue.empty_title")}</strong><span>{wq("queue.empty_description")}</span></div>
          </section>
          <aside className="waiting-side">
            <section className="panel waiting-panel waiting-table-panel">
              <div className="section-heading waiting-table-heading"><div><h2><i className="bi bi-grid-3x3-gap"></i> {wq("tables.title")}</h2><p>{wq("tables.description")}</p></div></div>
              <div id="waitingTableList" className="waiting-table-list">
                {availableTables.map(table => {
                  const match = recommendQueueForTable(table, queues);
                  const rec = match.recommendation;
                  return <article className="waiting-table-card" data-table-id={table.id} key={table.id}>
                    <div><strong>{table.label}</strong><span>{wq("common.seats", { count: table.capacity })}{table.accessible ? ` • ${wq("tables.wheelchair")}` : ""}</span></div>
                    {rec ? <>
                      <div className="waiting-table-match">
                        <span>{wq("tables.recommended")}</span>
                        <strong>{rec.queueNumber} • {wq("common.people", { count: rec.partySize })}</strong>
                        {match.skipped?.length ? <small>{wq("runtime.skipped_unsuitable", { count: match.skipped.length })}</small> : null}
                      </div>
                      <button type="button" data-table-seat={table.id} data-queue-id={rec.id} onClick={() => { setSeat(rec); setSeatTableId(table.id); setSeatReason(""); setSeatError(""); }}>{wq("tables.seat")}</button>
                    </> : <div className="waiting-table-match empty">{wq("tables.no_match")}</div>}
                  </article>;
                })}
              </div>
              <div id="waitingTableEmpty" className="waiting-empty" hidden={availableTables.length > 0}><i className="bi bi-door-closed"></i><strong>{wq("tables.empty_title")}</strong><span>{wq("tables.empty_description")}</span></div>
            </section>
            <details className="panel waiting-policy"><summary><i className="bi bi-shield-check"></i> {wq("policy.title")}</summary><p>{wq("policy.description")}</p></details>
          </aside>
        </div>
      </main>
      <dialog ref={addDialogRef} id="waitingQueueDialog" className="waiting-dialog" onCancel={e => { e.preventDefault(); if (!addBusy) setAddOpen(false); }} onClose={() => setAddOpen(false)}>
        <form ref={addFormRef} id="waitingQueueForm" className="payment-form waiting-dialog-form" noValidate onSubmitCapture={event => event.preventDefault()} onSubmit={submitAdd}>
          <div className="dialog-head waiting-dialog-head"><div><span className="waiting-dialog-eyebrow">{wq("add.eyebrow")}</span><h2>{wq("add.title")}</h2><p>{wq("add.description")}</p></div><button id="closeWaitingQueueDialog" type="button" className="icon-btn" aria-label={wq("common.close")} onClick={() => !addBusy && setAddOpen(false)}><i className="bi bi-x-lg"></i></button></div>
          <div className="waiting-form-grid">
            <label><span>{wq("add.customer_name")}</span><input id="waitingCustomerName" required maxLength="80" value={form.customerName} onChange={e => setForm(v => ({...v, customerName:e.target.value}))} placeholder={wq("add.customer_placeholder")} /></label>
            <label><span>{wq("add.phone")}</span><input id="waitingCustomerPhone" required maxLength="20" inputMode="tel" value={form.phone} onChange={e => setForm(v => ({...v, phone:e.target.value}))} placeholder={wq("add.phone_placeholder")} /></label>
            <label><span>{wq("add.party_size")}</span><input id="waitingPartySize" required type="number" min="1" max="99" step="1" value={form.partySize} onChange={e => setForm(v => ({...v, partySize:e.target.value}))} /></label>
            <label><span>{wq("add.priority")}</span><select id="waitingPriority" value={form.priority} onChange={e => setForm(v => ({...v, priority:e.target.value}))}><option value="normal">{wq("priority.normal")}</option><option value="elderly">{wq("priority.elderly")}</option><option value="disabled">{wq("priority.disabled")}</option><option value="young_child">{wq("priority.young_child")}</option></select></label>
            <label className="full"><span>{wq("add.note")}</span><textarea id="waitingSpecialNote" maxLength="240" value={form.specialNote} onChange={e => setForm(v => ({...v, specialNote:e.target.value}))} placeholder={wq("add.note_placeholder")} /></label>
          </div>
          <fieldset className="waiting-needs"><legend>{wq("add.needs")}</legend>
            <label><input id="waitingNeedHighChair" type="checkbox" checked={form.highChair} onChange={e => setForm(v => ({...v, highChair:e.target.checked}))} /> {wq("needs.high_chair")}</label>
            <label><input id="waitingNeedWheelchair" type="checkbox" checked={form.wheelchair} onChange={e => setForm(v => ({...v, wheelchair:e.target.checked}))} /> {wq("needs.wheelchair")}</label>
            <label><input id="waitingNeedQuietArea" type="checkbox" checked={form.quietArea} onChange={e => setForm(v => ({...v, quietArea:e.target.checked}))} /> {wq("needs.quiet")}</label>
            <label><input id="waitingNeedStroller" type="checkbox" checked={form.strollerSpace} onChange={e => setForm(v => ({...v, strollerSpace:e.target.checked}))} /> {wq("needs.stroller")}</label>
          </fieldset>
          <div id="waitingQueuePreview" className="waiting-intake-preview" role="status" aria-live="polite"><div><span>{wq("add.ahead")}</span><strong id="waitingQueuePreviewAhead">{intakeEstimate.groupsAhead}</strong></div><div><span>{wq("add.estimate")}</span><strong id="waitingQueuePreviewEstimate">{intakeEstimate.estimatedWaitMin}–{intakeEstimate.estimatedWaitMax} นาที</strong></div></div>
          <p id="waitingQueueFormError" className="error-text" role="alert">{addError}</p>
          <div className="dialog-actions waiting-dialog-actions"><button id="cancelWaitingQueueDialog" type="button" className="btn btn-secondary" disabled={addBusy} onClick={() => setAddOpen(false)}><i className="bi bi-x-lg"></i><span>{wq("add.cancel")}</span></button><button id="saveWaitingQueueBtn" type="submit" className="btn btn-pay" disabled={addBusy}>{addBusy ? <span>{wq("add.saving")}</span> : <><i className="bi bi-floppy"></i><span>{wq("add.save")}</span></>}</button></div>
        </form>
      </dialog>
      <dialog ref={ticketDialogRef} id="waitingTicketDialog" className="waiting-dialog waiting-ticket-dialog" onCancel={e => { e.preventDefault(); setTicket(null); }} onClose={() => setTicket(null)}>
        <div className="waiting-dialog-form waiting-ticket-dialog-form">
          <div className="dialog-head waiting-dialog-head"><div><span className="waiting-dialog-eyebrow">{wq("ticket.eyebrow")}</span><h2 id="waitingTicketDialogTitle">{wq("ticket.title")}</h2><p>{wq("ticket.description")}</p></div><button id="closeWaitingTicketDialog" type="button" className="icon-btn" aria-label={wq("common.close")} onClick={() => setTicket(null)}><i className="bi bi-x-lg"></i></button></div>
          <section className="waiting-ticket-card" aria-label={wq("ticket.preview_aria")}>
            <span className="waiting-ticket-brand">{wq("ticket.brand")}</span><span className="waiting-ticket-label">{wq("ticket.number")}</span><strong id="waitingTicketQueueNumber" className="waiting-ticket-number">{ticket?.queueNumber || "W---"}</strong>
            <div id="waitingTicketQr" className="waiting-ticket-qr" aria-label={wq("ticket.qr_aria")}>{ticketQr ? <img className="waiting-ticket-qr-react-image" src={ticketQr} alt={wq("ticket.qr_aria")} /> : null}</div>
            <p className="waiting-ticket-instruction">{wq("ticket.instruction")}</p>
            <div className="waiting-ticket-meta"><div><span>{wq("ticket.party_size")}</span><strong id="waitingTicketPartySize">{ticket?.partySize || "-"}</strong></div><div><span>{wq("ticket.estimate")}</span><strong id="waitingTicketEstimate">{ticket ? `${ticket.estimatedWaitMin ?? 0}–${ticket.estimatedWaitMax ?? 5} นาที` : "-"}</strong></div></div>
            <div className="waiting-ticket-ahead"><span>{wq("ticket.ahead")}</span><strong id="waitingTicketGroupsAhead">{ticket?.groupsAhead ?? "-"}</strong></div>
            <div className="waiting-ticket-issued"><span>{wq("ticket.issued_at")}</span><strong id="waitingTicketIssuedAt">{ticket ? formatTime(ticket.queuedAtMs) : "-"}</strong></div>
            <div className="waiting-ticket-url-status"><i className="bi bi-link-45deg"></i><span>{wq("ticket.link_ready")}</span></div>
            <code id="waitingTicketUrl" className="waiting-ticket-url" hidden>{ticket ? customerTrackingUrl(ticket) : ""}</code>
            <small><i className="bi bi-shield-check"></i> {wq("ticket.privacy")}</small>
          </section>
          <p id="waitingTicketError" className="error-text waiting-ticket-error" role="alert">{!ticketQr && ticket ? wq("runtime.qr_failed") : ""}</p>
          <div className="dialog-actions waiting-dialog-actions waiting-ticket-actions"><button id="cancelWaitingTicketDialog" type="button" className="btn btn-secondary" onClick={() => setTicket(null)}><i className="bi bi-x-lg"></i><span>{wq("ticket.close")}</span></button><button id="copyWaitingTicketLinkBtn" type="button" className="btn btn-secondary" onClick={copyTicket}><i className="bi bi-clipboard"></i><span>{wq("ticket.copy")}</span></button><button id="printWaitingTicketBtn" type="button" className="btn btn-pay" onClick={printTicket}><i className="bi bi-printer"></i><span>{wq("ticket.print")}</span></button></div>
        </div>
      </dialog>
      <dialog ref={seatDialogRef} id="waitingSeatDialog" className="waiting-dialog waiting-seat-dialog" onCancel={e => { e.preventDefault(); if (!seatBusy) setSeat(null); }} onClose={() => setSeat(null)}>
        <form className="payment-form waiting-dialog-form" onSubmit={e => e.preventDefault()}>
          <div className="dialog-head waiting-dialog-head"><div><span className="waiting-dialog-eyebrow">{wq("seat.eyebrow")}</span><h2 id="waitingSeatDialogTitle">{seat ? wq("runtime.seat_title", { queue: seat.queueNumber }) : wq("seat.title")}</h2><p>{wq("seat.description")}</p></div><button id="closeWaitingSeatDialog" type="button" className="icon-btn" aria-label={wq("common.close")} disabled={seatBusy} onClick={() => setSeat(null)}><i className="bi bi-x-lg"></i></button></div>
          <div id="waitingSeatQueueSummary" className="waiting-seat-summary">{seat ? <><strong>{seat.customerName || wq("common.unknown_name")}</strong><span>{wq("common.people", { count: seat.partySize })} • {waitText(seat, locale)}</span></> : null}</div>
          <div className="waiting-seat-section-title"><strong>{wq("seat.choose")}</strong><span>{wq("seat.suitable_first")}</span></div>
          <div id="waitingSeatTableList" className="waiting-seat-table-list">
            {seatAvailable.length ? seatAvailable.map(table => {
              const fits = seat ? compatibleQueuesForTable(table, [seat]).length > 0 : false;
              const rec = seat ? recommendQueueForTable(table, queues).recommendation : null;
              const recommended = rec?.id === seat?.id;
              return <label className={`waiting-seat-table ${fits ? "fits" : "not-fit"}${recommended ? " recommended" : ""}`} key={table.id}><input type="radio" name="waitingSeatTable" value={table.id} checked={String(seatTableId) === String(table.id)} onChange={() => { setSeatTableId(String(table.id)); setSeatReason(""); setSeatError(""); }} /><span><strong>{table.label}</strong><small>{wq("common.seats", { count: table.capacity })}{recommended ? ` • ${wq("seat.recommended")}` : fits ? ` • ${wq("seat.suitable")}` : ` • ${wq("seat.reason_required")}`}</small></span></label>;
            }) : <div className="waiting-seat-empty">{wq("tables.empty_title")}</div>}
          </div>
          <label id="waitingSeatReasonWrap" className="waiting-seat-reason" hidden={!seatReasonRequired}><span>{wq("seat.override_reason")}</span><textarea id="waitingSeatReason" maxLength="240" value={seatReason} onChange={e => setSeatReason(e.target.value)} placeholder={wq("seat.override_placeholder")} /></label>
          <p id="waitingSeatError" className="error-text" role="alert">{seatError}</p>
          <div className="dialog-actions waiting-dialog-actions"><button id="cancelWaitingSeatDialog" type="button" className="btn btn-secondary" disabled={seatBusy} onClick={() => setSeat(null)}><i className="bi bi-x-lg"></i><span>{wq("seat.cancel")}</span></button><button id="confirmWaitingSeatBtn" type="button" className="btn btn-pay" disabled={!selectedSeatTable || seatBusy} onClick={confirmSeat}>{seatBusy ? <span>{wq("seat.opening")}</span> : <><i className="bi bi-door-open"></i><span>{wq("seat.open")}</span></>}</button></div>
        </form>
      </dialog>

      <ParityFooter className="waiting-shared-footer" />
      <div id="toast" className="toast" role="status"></div>
    </>
  );
}
