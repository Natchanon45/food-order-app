export default {
    "th": {
        "platform_contact": {
            "meta": {
                "title": "ช่องทางติดต่อหน้าแรก"
            },
            "header": {
                "title": "ช่องทางติดต่อหน้าแรก",
                "back": "กลับระบบกลาง"
            },
            "hero": {
                "eyebrow": "Super Admin",
                "title": "ตั้งค่า Contact หน้าแรก",
                "description": "กำหนดช่องทางให้ผู้เยี่ยมชมติดต่อผู้ดูแลระบบผ่านโทรศัพท์ LINE Facebook Messenger หรืออีเมล"
            },
            "contact": {
                "section": {
                    "title": "ข้อมูลที่แสดงต่อสาธารณะ",
                    "subtitle": "เปิดเฉพาะช่องทางที่พร้อมให้ผู้ใช้งานติดต่อจริง",
                    "master_toggle": "แสดง Contact หน้าแรก"
                },
                "fields": {
                    "heading": "หัวข้อ",
                    "heading_placeholder": "เช่น คุยกับเรา",
                    "description": "คำอธิบาย",
                    "description_placeholder": "เช่น สอบถามข้อมูลแพ็กเกจและการใช้งานระบบ",
                    "enabled": "เปิดใช้งาน",
                    "button_label": "ข้อความบนปุ่ม",
                    "phone_number": "เบอร์โทร",
                    "phone_placeholder": "เช่น 0812345678",
                    "line_url": "LINE URL",
                    "messenger_url": "Messenger URL หรือชื่อเพจ",
                    "messenger_placeholder": "https://m.me/your.page หรือ your.page",
                    "messenger_help": "กรอกชื่อเพจอย่างเดียว ระบบจะสร้างลิงก์ m.me ให้โดยอัตโนมัติ",
                    "email": "อีเมล"
                },
                "channels": {
                    "phone": "โทรศัพท์",
                    "line": "LINE",
                    "messenger": "Facebook Messenger",
                    "email": "อีเมล"
                },
                "actions": {
                    "reload": "โหลดข้อมูลล่าสุด",
                    "save": "บันทึกข้อมูลติดต่อ"
                },
                "preview": {
                    "title": "ตัวอย่างหน้าแรก",
                    "subtitle": "ตัวอย่างเปลี่ยนตามข้อมูลที่กรอกทันที",
                    "kicker": "ติดต่อเรา",
                    "aria_label": "ตัวอย่างช่องทางติดต่อ",
                    "note": "ข้อมูลส่วนนี้เป็นข้อมูลสาธารณะ ห้ามกรอกรหัสผ่าน Token หรือข้อมูลลับ"
                },
                "defaults": {
                    "heading": "คุยกับเรา",
                    "description": "ติดต่อสอบถามข้อมูลแพ็กเกจและการใช้งานระบบ",
                    "preview_description": "ติดต่อสอบถามข้อมูลและการใช้งานระบบ",
                    "phone_label": "โทรศัพท์",
                    "line_label": "LINE",
                    "messenger_label": "Messenger",
                    "email_label": "อีเมล"
                },
                "validation": {
                    "heading_required": "กรุณากรอกหัวข้อ",
                    "phone_required": "เปิดโทรศัพท์แล้ว กรุณากรอกเบอร์โทร",
                    "line_required": "เปิด LINE แล้ว กรุณากรอก LINE URL ที่ถูกต้อง",
                    "messenger_required": "เปิด Messenger แล้ว กรุณากรอก Messenger URL หรือชื่อเพจ",
                    "email_required": "เปิดอีเมลแล้ว กรุณากรอกอีเมลที่ถูกต้อง",
                    "channel_required": "เปิด Contact หน้าแรกแล้ว กรุณาเปิดอย่างน้อยหนึ่งช่องทาง"
                },
                "status": {
                    "loading": "กำลังโหลดข้อมูลล่าสุด...",
                    "loaded": "โหลดข้อมูลติดต่อแล้ว",
                    "empty": "ยังไม่มีข้อมูลเดิม กรุณากรอกและบันทึก",
                    "load_failed": "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Super Admin แล้วลองใหม่",
                    "saving": "กำลังบันทึกข้อมูลติดต่อ...",
                    "saved": "บันทึกข้อมูลติดต่อเรียบร้อยแล้ว"
                },
                "toast": {
                    "loaded": "โหลดข้อมูลติดต่อล่าสุดแล้ว",
                    "saved": "อัปเดต Contact หน้าแรกแล้ว"
                },
                "errors": {
                    "permission_denied": "บัญชีนี้ไม่มีสิทธิ์แก้ไข Contact หน้าแรก",
                    "save_failed": "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่"
                }
            },
            "google": {
                "title": "Google Login สำหรับลูกค้า Delivery",
                "subtitle": "กำหนด OAuth Web Client ID สำหรับให้ลูกค้า Guest บันทึกชื่อและที่อยู่ข้ามอุปกรณ์",
                "loading": "กำลังโหลด...",
                "toggle": {
                    "title": "เปิดใช้งาน Google Login",
                    "help": "เมื่อปิด ลูกค้ายังสั่งซื้อแบบ Guest และบันทึกข้อมูลเฉพาะ Browser ได้ตามปกติ"
                },
                "fields": {
                    "client_id": "Google OAuth Web Client ID",
                    "client_id_help": "ใช้ Client ID ชนิด Web application เท่านั้น — ไม่ต้องกรอก Client Secret",
                    "ttl": "อายุ Session",
                    "ttl_help": "1–90 วัน"
                },
                "privacy": {
                    "stored_title": "ข้อมูลที่ระบบจัดเก็บ",
                    "stored_description": "ชื่อผู้รับ และที่อยู่จัดส่งสูงสุด 5 รายการ",
                    "not_stored_title": "ข้อมูลที่ระบบไม่จัดเก็บ",
                    "not_stored_description": "อีเมล Google, รูปโปรไฟล์, Client Secret, Access Token และเบอร์โทร"
                },
                "origins": {
                    "label": "Authorized JavaScript origins ที่ต้องเพิ่มใน Google Cloud Console",
                    "help": "เพิ่มเฉพาะ Origin ไม่ต้องใส่ path เช่น /s/local-store/delivery",
                    "copy": "คัดลอก",
                    "copied": "คัดลอก Authorized JavaScript origin แล้ว",
                    "copy_failed": "คัดลอกอัตโนมัติไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอก"
                },
                "actions": {
                    "reload": "โหลดล่าสุด",
                    "validate": "ตรวจสอบรูปแบบ",
                    "save": "บันทึก Google Login"
                },
                "preview": {
                    "title": "ตัวอย่างหน้า Delivery",
                    "subtitle": "ตัวอย่างส่วนบัญชีและที่อยู่จัดส่ง",
                    "account_title": "บัญชีและที่อยู่จัดส่ง",
                    "guest_description": "โหมด Guest: ชื่อและที่อยู่จะจำเฉพาะร้าน อุปกรณ์ และเบราว์เซอร์นี้",
                    "sign_in": "เข้าสู่ระบบด้วย Google",
                    "ready": "พร้อมแสดงปุ่ม Google Login บนหน้า Delivery",
                    "invalid": "ยังไม่พร้อม: กรุณาตรวจสอบ Client ID",
                    "disabled": "ปิดใช้งาน Google Login — ลูกค้ายังใช้โหมด Guest ได้",
                    "warning": "หน้านี้ตั้งค่า Client ID และสถานะเปิดใช้งานเท่านั้น การเพิ่ม Authorized JavaScript origins ยังต้องทำใน Google Cloud Console"
                },
                "source": {
                    "database": "ค่าจากฐานข้อมูล",
                    "environment": "ค่าเริ่มต้นจาก .env"
                },
                "validation": {
                    "client_required": "เปิด Google Login แล้ว กรุณากรอก OAuth Web Client ID",
                    "client_invalid": "รูปแบบ OAuth Web Client ID ไม่ถูกต้อง ต้องลงท้ายด้วย .apps.googleusercontent.com",
                    "ttl_invalid": "อายุ Session ต้องอยู่ระหว่าง 1–90 วัน"
                },
                "status": {
                    "loading": "กำลังโหลดการตั้งค่า Google Login...",
                    "loaded_database": "โหลดการตั้งค่า Google Login จากฐานข้อมูลแล้ว",
                    "loaded_environment": "กำลังใช้ค่าเริ่มต้นจาก .env — บันทึกหน้านี้เพื่อย้ายมาใช้ฐานข้อมูล",
                    "load_failed": "โหลดการตั้งค่า Google Login ไม่สำเร็จ กรุณาตรวจสอบ Migration และสิทธิ์ Super Admin",
                    "valid": "รูปแบบ Client ID และอายุ Session ถูกต้อง",
                    "saving": "กำลังบันทึกการตั้งค่า Google Login...",
                    "saved": "บันทึก Google Login Settings เรียบร้อยแล้ว"
                },
                "toast": {
                    "loaded": "โหลดการตั้งค่า Google Login ล่าสุดแล้ว",
                    "validated": "ตรวจสอบรูปแบบ Google Login แล้ว",
                    "saved": "อัปเดต Google Login สำหรับลูกค้า Delivery แล้ว"
                },
                "errors": {
                    "save_failed": "บันทึก Google Login Settings ไม่สำเร็จ กรุณาลองใหม่"
                }
            }
        }
    },
    "en": {
        "platform_contact": {
            "meta": {
                "title": "Homepage contact settings"
            },
            "header": {
                "title": "Homepage contact settings",
                "back": "Back to Platform"
            },
            "hero": {
                "eyebrow": "Super Admin",
                "title": "Homepage contact settings",
                "description": "Configure how visitors can contact the platform administrator by phone, LINE, Facebook Messenger, or email."
            },
            "contact": {
                "section": {
                    "title": "Public contact information",
                    "subtitle": "Enable only channels that are ready for customers to use.",
                    "master_toggle": "Show contact section on homepage"
                },
                "fields": {
                    "heading": "Heading",
                    "heading_placeholder": "e.g. Talk to us",
                    "description": "Description",
                    "description_placeholder": "e.g. Ask about plans and how to use the system",
                    "enabled": "Enabled",
                    "button_label": "Button label",
                    "phone_number": "Phone number",
                    "phone_placeholder": "e.g. 0812345678",
                    "line_url": "LINE URL",
                    "messenger_url": "Messenger URL or page name",
                    "messenger_placeholder": "https://m.me/your.page or your.page",
                    "messenger_help": "Enter only the page name and the system will create the m.me link automatically.",
                    "email": "Email"
                },
                "channels": {
                    "phone": "Phone",
                    "line": "LINE",
                    "messenger": "Facebook Messenger",
                    "email": "Email"
                },
                "actions": {
                    "reload": "Reload latest data",
                    "save": "Save contact settings"
                },
                "preview": {
                    "title": "Homepage preview",
                    "subtitle": "The preview updates immediately as you edit the form.",
                    "kicker": "Contact us",
                    "aria_label": "Contact channel preview",
                    "note": "This information is public. Do not enter passwords, tokens, or other secrets."
                },
                "defaults": {
                    "heading": "Talk to us",
                    "description": "Contact us about plans and how to use the system.",
                    "preview_description": "Contact us for information and help using the system.",
                    "phone_label": "Phone",
                    "line_label": "LINE",
                    "messenger_label": "Messenger",
                    "email_label": "Email"
                },
                "validation": {
                    "heading_required": "Please enter a heading.",
                    "phone_required": "Phone is enabled. Please enter a phone number.",
                    "line_required": "LINE is enabled. Please enter a valid LINE URL.",
                    "messenger_required": "Messenger is enabled. Please enter a Messenger URL or page name.",
                    "email_required": "Email is enabled. Please enter a valid email address.",
                    "channel_required": "The homepage contact section is enabled. Please enable at least one contact channel."
                },
                "status": {
                    "loading": "Loading the latest contact settings...",
                    "loaded": "Contact settings loaded.",
                    "empty": "No saved settings yet. Enter the contact information and save it.",
                    "load_failed": "Unable to load contact settings. Check Super Admin permissions and try again.",
                    "saving": "Saving contact settings...",
                    "saved": "Contact settings saved."
                },
                "toast": {
                    "loaded": "Latest contact settings loaded.",
                    "saved": "Homepage contact settings updated."
                },
                "errors": {
                    "permission_denied": "This account cannot edit homepage contact settings.",
                    "save_failed": "Unable to save contact settings. Please try again."
                }
            },
            "google": {
                "title": "Google Login for Delivery customers",
                "subtitle": "Configure the OAuth Web Client ID so Guest customers can keep recipient names and delivery addresses across devices.",
                "loading": "Loading...",
                "toggle": {
                    "title": "Enable Google Login",
                    "help": "When disabled, customers can still order as Guests and save information in this browser as usual."
                },
                "fields": {
                    "client_id": "Google OAuth Web Client ID",
                    "client_id_help": "Use a Web application Client ID only — do not enter a Client Secret.",
                    "ttl": "Session lifetime",
                    "ttl_help": "1–90 days"
                },
                "privacy": {
                    "stored_title": "Data stored by the system",
                    "stored_description": "Recipient name and up to 5 delivery addresses",
                    "not_stored_title": "Data not stored by the system",
                    "not_stored_description": "Google email, profile image, Client Secret, Access Token, and phone number"
                },
                "origins": {
                    "label": "Authorized JavaScript origins to add in Google Cloud Console",
                    "help": "Add only the Origin without a path such as /s/local-store/delivery.",
                    "copy": "Copy",
                    "copied": "Authorized JavaScript origin copied.",
                    "copy_failed": "Automatic copy failed. Select the text and copy it manually."
                },
                "actions": {
                    "reload": "Reload",
                    "validate": "Validate format",
                    "save": "Save Google Login"
                },
                "preview": {
                    "title": "Delivery page preview",
                    "subtitle": "Preview of the account and delivery-address section.",
                    "account_title": "Account and delivery addresses",
                    "guest_description": "Guest mode: names and addresses are remembered only for this store, device, and browser.",
                    "sign_in": "Sign in with Google",
                    "ready": "Ready to show the Google Login button on the Delivery page.",
                    "invalid": "Not ready: check the Client ID.",
                    "disabled": "Google Login is disabled — customers can still use Guest mode.",
                    "warning": "This page configures only the Client ID and enabled state. Authorized JavaScript origins must still be added in Google Cloud Console."
                },
                "source": {
                    "database": "Database setting",
                    "environment": "Default from .env"
                },
                "validation": {
                    "client_required": "Google Login is enabled. Please enter an OAuth Web Client ID.",
                    "client_invalid": "Invalid OAuth Web Client ID. It must end with .apps.googleusercontent.com.",
                    "ttl_invalid": "Session lifetime must be between 1 and 90 days."
                },
                "status": {
                    "loading": "Loading Google Login settings...",
                    "loaded_database": "Google Login settings loaded from the database.",
                    "loaded_environment": "Using the default from .env — save this page to move the setting to the database.",
                    "load_failed": "Unable to load Google Login settings. Check the migration and Super Admin permissions.",
                    "valid": "Client ID format and session lifetime are valid.",
                    "saving": "Saving Google Login settings...",
                    "saved": "Google Login settings saved."
                },
                "toast": {
                    "loaded": "Latest Google Login settings loaded.",
                    "validated": "Google Login format validated.",
                    "saved": "Google Login for Delivery customers updated."
                },
                "errors": {
                    "save_failed": "Unable to save Google Login settings. Please try again."
                }
            }
        }
    }
};
