import { Link } from "react-router-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useParityPage } from "@/hooks/useParityPage";

const CONTENT = {
  privacy: {
    title: "นโยบายความเป็นส่วนตัว",
    icon: "shield-lock",
    intro: "PENGUIN เป็นระบบสั่งอาหารและจัดส่งออนไลน์ เราให้ความสำคัญกับข้อมูลส่วนบุคคลของลูกค้าและพนักงานร้านค้า",
    sections: [
      ["database-lock", "ข้อมูลที่เราเก็บ", "เมื่อคุณเข้าสู่ระบบด้วย Google เราอาจได้รับชื่อ อีเมล รูปโปรไฟล์ และรหัสบัญชีจาก Google นอกจากนี้ ระบบอาจเก็บเบอร์โทรศัพท์ ที่อยู่จัดส่ง รายการสั่งซื้อ และข้อมูลการชำระเงินที่จำเป็นต่อการให้บริการ โดยระบบไม่รับรหัสผ่าน Google ของคุณ"],
      ["clipboard-check", "วัตถุประสงค์การใช้ข้อมูล", "เราใช้ข้อมูลเพื่อยืนยันตัวตน บันทึกโปรไฟล์และที่อยู่ตามที่คุณร้องขอ ดำเนินคำสั่งซื้อ จัดส่งอาหาร ให้บริการลูกค้า ป้องกันการทุจริต และรักษาความปลอดภัยของระบบ"],
      ["safe", "การเปิดเผยและการเก็บรักษา", "ข้อมูลคำสั่งซื้อจะเปิดเผยแก่ร้านค้าและผู้ให้บริการที่จำเป็นต่อการดำเนินงานเท่านั้น เราไม่ขายข้อมูลส่วนบุคคล และเก็บข้อมูลเท่าที่จำเป็นต่อบริการ หน้าที่ตามกฎหมาย และการรักษาความปลอดภัย"],
      ["envelope-check", "สิทธิ์และการติดต่อ", "คุณสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลของคุณ รวมถึงยกเลิกการเชื่อมต่อบัญชี Google ได้โดยติดต่อฝ่ายสนับสนุน"],
    ],
    related: ["/terms", "ข้อกำหนดการใช้งาน", "file-earmark-text"],
  },
  terms: {
    title: "ข้อกำหนดการใช้งาน",
    icon: "file-earmark-text",
    intro: "การใช้ PENGUIN ถือว่าคุณยอมรับข้อกำหนดฉบับนี้ ระบบให้บริการสั่งอาหาร จัดส่ง และเครื่องมือจัดการร้านอาหารออนไลน์",
    sections: [
      ["person-check", "บัญชีผู้ใช้", "คุณต้องให้ข้อมูลที่ถูกต้อง ดูแลความปลอดภัยของบัญชี และแจ้งเราเมื่อพบความผิดปกติของบัญชี"],
      ["receipt", "คำสั่งซื้อและบริการร้านค้า", "ราคา เมนู ระยะเวลาจัดส่ง การคืนเงิน และคุณภาพสินค้าเป็นไปตามข้อมูลและนโยบายของร้านค้าที่รับคำสั่งซื้อ ผู้ใช้ควรตรวจสอบรายละเอียดก่อนยืนยันรายการ"],
      ["shield-check", "การใช้งานระบบ", "โปรดใช้งานระบบตามวัตถุประสงค์ของบริการ และไม่กระทำการที่รบกวนผู้ใช้ ร้านค้า หรือความปลอดภัยของระบบ"],
      ["envelope-check", "การเปลี่ยนแปลงและการติดต่อ", "เราอาจปรับปรุงบริการหรือข้อกำหนดเมื่อจำเป็น หากมีคำถาม โปรดติดต่อฝ่ายสนับสนุน"],
    ],
    related: ["/privacy", "นโยบายความเป็นส่วนตัว", "shield-lock"],
  },
};

export function LegalPage({ type = "privacy" }) {
  const content = CONTENT[type] || CONTENT.privacy;
  const stylesReady = useParityPage({
    title: content.title + " | PENGUIN",
    bodyClass: "legal-react-page",
    styles: ["app.css", "icons.css", "legal-react.css"],
  });
  if (!stylesReady) return <PageReadyOverlay />;
  return (
    <>
      <header className="app-header"><Link className="brand" to="/"><span className="brand-mark">PG</span><span>PENGUIN</span></Link></header>
      <main className="container">
        <article className="card legal-card">
          <h1 className="legal-title"><i className={"bi bi-" + content.icon} aria-hidden="true"></i><span>{content.title}</span></h1>
          <p className="legal-updated"><i className="bi bi-calendar-check" aria-hidden="true"></i><span>ปรับปรุงล่าสุด: 30 มิถุนายน 2026</span></p>
          <p>{content.intro}</p>
          {content.sections.map(([icon, title, body]) => (
            <section className="legal-section" key={title}>
              <h2><i className={"bi bi-" + icon} aria-hidden="true"></i><span>{title}</span></h2>
              <p>{body}</p>
            </section>
          ))}
          <nav className="legal-actions" aria-label="ลิงก์ที่เกี่ยวข้อง">
            <a href="mailto:sripleng.natchanon@gmail.com"><i className="bi bi-envelope" aria-hidden="true"></i><span>ติดต่อฝ่ายสนับสนุน</span></a>
            <Link to="/"><i className="bi bi-house-door" aria-hidden="true"></i><span>กลับหน้าแรก</span></Link>
            <Link to={content.related[0]}><i className={"bi bi-" + content.related[2]} aria-hidden="true"></i><span>{content.related[1]}</span></Link>
          </nav>
        </article>
      </main>
    </>
  );
}
