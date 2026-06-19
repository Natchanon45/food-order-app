# Food Order QR — Version 1

ระบบสั่งอาหารผ่าน QR Code สำหรับทานที่ร้าน พัฒนาแบบ Firebase + Git

## หน้าที่มีในเวอร์ชันนี้

- `/order/?table=A01` ลูกค้าดูเมนู เพิ่มตะกร้า และส่งออเดอร์
- `/kitchen` ครัวรับออเดอร์แบบ Real-time และเปลี่ยนสถานะ
- `/cashier` แคชเชียร์ดูยอดรวมตามโต๊ะและปิดบิล
- `/admin` เพิ่ม/แก้ไขสถานะเมนูและจัดการโต๊ะเบื้องต้น
- `/admin/qr` สร้าง QR Code แยกตามโต๊ะ

## เริ่มใช้งาน

1. สร้าง Firebase Project
2. เปิด Firestore Database
3. เปิด Storage
4. คัดลอก Firebase Web App config ไปใส่ใน:

   `public/assets/js/firebase-config.js`

5. ติดตั้ง Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy
```

## ทดสอบบนเครื่อง

```bash
firebase serve
```

หรือ:

```bash
python3 -m http.server 8080 --directory public
```

> หมายเหตุ: Firestore rules ในรุ่นเริ่มต้นเปิดสิทธิ์เพื่อทดสอบเท่านั้น ห้ามใช้กับร้านจริงจนกว่าจะเพิ่ม Firebase Authentication และกำหนดสิทธิ์พนักงาน
