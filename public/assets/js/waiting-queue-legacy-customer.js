(function () {
  if (!/^\/queue\/?$/.test(location.pathname)) return;
  if (document.querySelector("[data-wq-legacy-shell]")) return;

  document.documentElement.classList.add("wq-legacy-customer");
  const source = document.createElement("div");
  source.className = "wq-legacy-source";
  source.setAttribute("aria-hidden", "true");
  while (document.body.firstChild) source.appendChild(document.body.firstChild);
  document.body.appendChild(source);

  const shell = document.createElement("main");
  shell.className = "wq-legacy-shell";
  shell.dataset.wqLegacyShell = "1";
  shell.innerHTML = `
    <header class="wq-legacy-brand">
      <span class="wq-legacy-logo" aria-hidden="true">W</span>
      <div class="wq-legacy-brand-text"><strong>คิวรอโต๊ะ</strong><span>ติดตามสถานะคิวของคุณ</span></div>
    </header>
    <section class="wq-legacy-card">
      <div class="wq-legacy-hero">
        <span class="wq-legacy-label">หมายเลขคิวของคุณ</span>
        <strong class="wq-legacy-number" data-wq-number>W---</strong>
        <div class="wq-legacy-meta"><span class="wq-legacy-party" data-wq-party>— คน</span><span class="wq-legacy-status" data-wq-status>กำลังโหลด</span></div>
      </div>
      <div class="wq-legacy-message"><strong data-wq-message-title>กำลังตรวจสอบสถานะ</strong><span data-wq-message>กรุณารอสักครู่</span></div>
      <footer class="wq-legacy-note">หน้านี้เป็นลิงก์คิวเดิม ข้อมูลส่วนบุคคลของลูกค้ารายอื่นจะไม่ถูกแสดง</footer>
    </section>`;
  document.body.appendChild(shell);

  function readSourceText() {
    return String(source.innerText || source.textContent || "").replace(/\s+/g, " ").trim();
  }

  function stateFromText(text) {
    const statuses = [
      [/(ถึงคิว|เข้านั่ง|ได้รับโต๊ะ)/, "ถึงคิวแล้ว", "seated", "กรุณาติดต่อพนักงานเพื่อรับโต๊ะ"],
      [/(กำลังเรียก|เรียกแล้ว)/, "กำลังเรียก", "called", "กรุณามาที่จุดรับโต๊ะภายในเวลาที่กำหนด"],
      [/(ยกเลิก|ไม่มา|พ้นเวลา)/, "คิวสิ้นสุด", "cancelled", "กรุณาติดต่อพนักงานหากต้องการรับคิวใหม่"],
      [/(รอเรียก|กำลังรอ|รอคิว)/, "รอเรียก", "waiting", "กรุณาเปิดหน้านี้ไว้และติดตามจอเรียกคิวของร้าน"],
    ];
    return statuses.find(([pattern]) => pattern.test(text)) || [null, "กำลังตรวจสอบ", "waiting", "กรุณาเปิดหน้านี้ไว้เพื่อติดตามสถานะ"];
  }

  function render() {
    const text = readSourceText();
    const queueNumber = text.match(/\bW\d+\b/i)?.[0]?.toUpperCase() || "W---";
    const party = text.match(/(?:^|\s)(\d{1,2})\s*คน/)?.[1] || "—";
    const [, label, className, message] = stateFromText(text);
    shell.querySelector("[data-wq-number]").textContent = queueNumber;
    shell.querySelector("[data-wq-party]").textContent = `${party} คน`;
    const status = shell.querySelector("[data-wq-status]");
    status.textContent = label;
    status.className = `wq-legacy-status ${className}`;
    shell.querySelector("[data-wq-message-title]").textContent = label === "ถึงคิวแล้ว" ? "ถึงคิวของคุณแล้ว" : label;
    shell.querySelector("[data-wq-message]").textContent = message;
  }

  new MutationObserver(render).observe(source, { childList: true, subtree: true, characterData: true, attributes: true });
  render();
})();
