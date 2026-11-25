// G2-03 fail-closed read error. Outside the PENGUIN success JSX so the
// 287 rendered SOURCE opening tags and their attributes remain unchanged.
// Do not show stale sales totals, receipts, charts or a fabricated zero.
export function SalesReportReadFailure({ title, error }) {
  return (
    <main className="container sales-report-page" data-sales-report-read-state="failed" role="alert">
      <section className="card empty">
        <h1>{title}</h1>
        <p>ไม่สามารถยืนยันข้อมูลยอดขายให้ครบถ้วนได้ จึงยังไม่แสดงยอดรวม กรุณาตรวจสอบข้อมูลหรือโหลดหน้าใหม่</p>
        <small>{error}</small>
      </section>
    </main>
  );
}
