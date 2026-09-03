export default {
    "th": {
        "admin_users": {
            "meta": {
                "title": "จัดการพนักงาน"
            },
            "header": {
                "title": "จัดการพนักงาน",
                "back": "กลับหน้าจัดการร้าน"
            },
            "hero": {
                "kicker": "ทีมงานของร้าน",
                "title": "พนักงานของร้าน",
                "description": "เพิ่มพนักงาน กำหนดหน้าที่ และควบคุมการเข้าใช้งานเฉพาะร้านของคุณ",
                "add": "เพิ่มพนักงาน"
            },
            "list": {
                "title": "รายการพนักงาน",
                "description": "แก้ไขชื่อ สิทธิ์ ระบบที่เข้าใช้งาน และสถานะได้จากรายการด้านล่าง",
                "count": ":count คน",
                "empty": "ยังไม่มีพนักงานในร้าน",
                "load_failed": "โหลดรายการพนักงานไม่สำเร็จ",
                "columns": {
                    "name": "ชื่อ",
                    "email": "อีเมล",
                    "role": "สิทธิ์",
                    "scope": "ระบบ",
                    "active": "เปิดใช้งาน"
                }
            },
            "dialog": {
                "title": "เพิ่มพนักงานใหม่",
                "description": "สร้างบัญชีและกำหนดสิทธิ์เริ่มต้นให้พนักงาน",
                "close": "ปิด",
                "display_name": "ชื่อที่แสดง",
                "display_name_placeholder": "เช่น พนักงานแคชเชียร์",
                "email": "อีเมล",
                "password": "รหัสผ่านเริ่มต้น",
                "password_placeholder": "อย่างน้อย 8 ตัวอักษร",
                "confirm_password": "ยืนยันรหัสผ่าน",
                "confirm_password_placeholder": "กรอกรหัสผ่านอีกครั้ง",
                "role": "สิทธิ์พนักงาน",
                "scope": "ระบบที่เข้าใช้งาน",
                "active_title": "เปิดใช้งานทันที",
                "active_help": "พนักงานสามารถเข้าสู่ระบบได้หลังสร้างบัญชี",
                "cancel": "ยกเลิก",
                "create": "สร้างผู้ใช้งาน",
                "creating": "กำลังสร้าง..."
            },
            "roles": {
                "admin": "Admin",
                "cashier": "Cashier",
                "kitchen": "Kitchen"
            },
            "role_options": {
                "admin": "Admin — จัดการร้าน",
                "cashier": "Cashier — รับชำระเงิน",
                "kitchen": "Kitchen — จัดการครัว"
            },
            "scopes": {
                "order_delivery": "Order / Delivery",
                "retail_pos": "Retail POS",
                "both": "ทั้ง 2 ระบบ"
            },
            "scope_options": {
                "order_delivery": "Order / Delivery เท่านั้น",
                "retail_pos": "Retail POS เท่านั้น",
                "both": "ทั้ง 2 ระบบ"
            },
            "actions": {
                "save": "บันทึก",
                "saving": "กำลังบันทึก..."
            },
            "validation": {
                "password_min": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
                "password_mismatch": "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"
            },
            "messages": {
                "created": "สร้างพนักงานเรียบร้อยแล้ว",
                "create_failed": "สร้างพนักงานไม่สำเร็จ",
                "email_exists": "อีเมลนี้ถูกใช้งานแล้ว",
                "invalid_data": "กรุณาตรวจสอบข้อมูลพนักงาน",
                "forbidden": "บัญชีนี้ไม่มีสิทธิ์จัดการพนักงาน",
                "saved": "บันทึกข้อมูลพนักงานแล้ว",
                "save_failed": "บันทึกพนักงานไม่สำเร็จ"
            }
        }
    },
    "en": {
        "admin_users": {
            "meta": {
                "title": "Staff management"
            },
            "header": {
                "title": "Staff management",
                "back": "Back to store management"
            },
            "hero": {
                "kicker": "Store team",
                "title": "Store staff",
                "description": "Add staff, assign responsibilities, and control access for your store.",
                "add": "Add staff"
            },
            "list": {
                "title": "Staff list",
                "description": "Edit names, roles, system access, and account status from the list below.",
                "count": "Staff: :count",
                "empty": "No staff accounts yet",
                "load_failed": "Could not load staff accounts",
                "columns": {
                    "name": "Name",
                    "email": "Email",
                    "role": "Role",
                    "scope": "System",
                    "active": "Active"
                }
            },
            "dialog": {
                "title": "Add new staff",
                "description": "Create an account and assign the staff member’s initial access.",
                "close": "Close",
                "display_name": "Display name",
                "display_name_placeholder": "For example: Cashier staff",
                "email": "Email",
                "password": "Initial password",
                "password_placeholder": "At least 8 characters",
                "confirm_password": "Confirm password",
                "confirm_password_placeholder": "Enter the password again",
                "role": "Staff role",
                "scope": "System access",
                "active_title": "Enable immediately",
                "active_help": "The staff member can sign in immediately after the account is created.",
                "cancel": "Cancel",
                "create": "Create account",
                "creating": "Creating..."
            },
            "roles": {
                "admin": "Admin",
                "cashier": "Cashier",
                "kitchen": "Kitchen"
            },
            "role_options": {
                "admin": "Admin — Store management",
                "cashier": "Cashier — Payments",
                "kitchen": "Kitchen — Kitchen operations"
            },
            "scopes": {
                "order_delivery": "Order / Delivery",
                "retail_pos": "Retail POS",
                "both": "Both systems"
            },
            "scope_options": {
                "order_delivery": "Order / Delivery only",
                "retail_pos": "Retail POS only",
                "both": "Both systems"
            },
            "actions": {
                "save": "Save",
                "saving": "Saving..."
            },
            "validation": {
                "password_min": "The password must be at least 8 characters",
                "password_mismatch": "The password and confirmation do not match"
            },
            "messages": {
                "created": "Staff account created",
                "create_failed": "Could not create the staff account",
                "email_exists": "This email is already in use",
                "invalid_data": "Check the staff account details",
                "forbidden": "This account does not have permission to manage staff",
                "saved": "Staff account saved",
                "save_failed": "Could not save the staff account"
            }
        }
    }
};
