import { Link } from "react-router-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useParityPage } from "@/hooks/useParityPage";

export function PublicRouteMissingPage({ title = "ลิงก์ร้านค้าไม่สมบูรณ์", detail = "กรุณาเปิดร้านผ่านลิงก์หรือ QR ที่มีชื่อร้าน" }) {
  const stylesReady = useParityPage({
    title,
    bodyClass: "public-route-missing-page",
    styles: ["app.css", "icons.css", "shared-responsive.css"],
  });
  if (!stylesReady) return <PageReadyOverlay />;
  return (
    <main className="container" style={{ maxWidth: 620, paddingTop: 56 }}>
      <section className="card" style={{ padding: 30, textAlign: "center" }}>
        <span style={{ width: 64, height: 64, display: "grid", placeItems: "center", margin: "0 auto 18px", borderRadius: 20, background: "#eaf7ee", color: "#159447", fontSize: 30 }}>
          <i className="bi bi-shop" aria-hidden="true"></i>
        </span>
        <small style={{ color: "#0d6f34", fontWeight: 700 }}>PENGUIN • หน้าร้านออนไลน์</small>
        <h1 style={{ margin: "8px 0 10px" }}>{title}</h1>
        <p className="menu-category" style={{ fontSize: 15 }}>{detail}</p>
        <div className="dialog-actions" style={{ marginTop: 22, justifyContent: "center" }}>
          <button className="btn" type="button" hidden={history.length <= 1} onClick={() => history.back()}>
            <i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>ย้อนกลับ</span>
          </button>
          <Link className="btn btn-primary" to="/">
            <i className="bi bi-house-door app-icon" aria-hidden="true"></i><span>กลับหน้าแรก</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
