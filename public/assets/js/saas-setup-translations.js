export default {
    "th": {
        "saas_setup": {
            "meta": {
                "title": "เริ่มระบบ Tenant"
            },
            "header": {
                "brand": "Tenant Setup",
                "back": "กลับหน้าหลัก"
            },
            "hero": {
                "title": "ย้ายร้านแรกเข้าสู่ระบบ Tenant",
                "description": "คัดลอกข้อมูลจาก :source ไปยัง Tenant :tenant โดยไม่ลบข้อมูลต้นทาง"
            },
            "summary": {
                "title": "ข้อมูลที่จะย้าย",
                "checking": "กำลังตรวจสอบ",
                "menus": "เมนู",
                "tables": "โต๊ะ",
                "orders": "ออเดอร์",
                "settings": "การตั้งค่าร้าน"
            },
            "target": {
                "title": "Tenant ร้านแรก",
                "name": "ชื่อ",
                "slug": "Slug",
                "id": "ID"
            },
            "overwrite": "เขียนทับข้อมูลใน Tenant ที่มีอยู่แล้ว",
            "actions": {
                "refresh": "ตรวจสอบอีกครั้ง",
                "start": "เริ่มย้ายเข้า Tenant"
            },
            "runtime": {
                "count": {
                    "items": ":count รายการ",
                    "tables": ":count โต๊ะ",
                    "orders": ":count ออเดอร์"
                },
                "settings": {
                    "found": "พบข้อมูล",
                    "missing": "ไม่พบข้อมูล"
                },
                "state": {
                    "checking": "กำลังตรวจสอบ",
                    "tenant_exists": "พบ Tenant แล้ว",
                    "ready": "พร้อมเริ่ม",
                    "check_failed": "ตรวจสอบไม่สำเร็จ",
                    "migration_success": "ย้ายสำเร็จ",
                    "migration_failed": "ย้ายไม่สำเร็จ"
                },
                "toast": {
                    "check_failed": "ตรวจสอบข้อมูลต้นทางไม่สำเร็จ",
                    "migration_success": "ย้ายข้อมูลเข้า Tenant ร้านแรกแล้ว",
                    "migration_failed": "ย้ายข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และ Rules"
                },
                "confirm": {
                    "overwrite": "ยืนยันย้ายข้อมูลและเขียนทับข้อมูลใน Tenant ร้านแรก?",
                    "copy": "ยืนยันคัดลอกข้อมูลจาก :source เข้า Tenant ร้านแรก? ข้อมูลต้นทางจะไม่ถูกลบ",
                    "title": "ยืนยันย้ายข้อมูล",
                    "confirm": "ตกลง",
                    "cancel": "ยกเลิก"
                },
                "log": {
                    "start": "เริ่มกระบวนการย้ายข้อมูลเข้า Tenant...",
                    "result": ":source: คัดลอก :copied, ข้าม :skipped, ทั้งหมด :total",
                    "error": "เกิดข้อผิดพลาด: :message"
                },
                "progress": {
                    "tenant": "เตรียม Tenant ร้านแรกแล้ว",
                    "collection": "กำลังย้าย :name...",
                    "settings": "กำลังย้ายการตั้งค่าร้าน...",
                    "done": "ย้ายข้อมูลเข้า Tenant ร้านแรกสำเร็จ"
                }
            }
        }
    },
    "en": {
        "saas_setup": {
            "meta": {
                "title": "Tenant Setup"
            },
            "header": {
                "brand": "Tenant Setup",
                "back": "Back to home"
            },
            "hero": {
                "title": "Migrate the first store into Tenant mode",
                "description": "Copy data from :source into Tenant :tenant without deleting the source data."
            },
            "summary": {
                "title": "Data to migrate",
                "checking": "Checking",
                "menus": "Menus",
                "tables": "Tables",
                "orders": "Orders",
                "settings": "Store settings"
            },
            "target": {
                "title": "First Tenant",
                "name": "Name",
                "slug": "Slug",
                "id": "ID"
            },
            "overwrite": "Overwrite data that already exists in the Tenant",
            "actions": {
                "refresh": "Check again",
                "start": "Start Tenant migration"
            },
            "runtime": {
                "count": {
                    "items": ":count items",
                    "tables": ":count tables",
                    "orders": ":count orders"
                },
                "settings": {
                    "found": "Data found",
                    "missing": "No data found"
                },
                "state": {
                    "checking": "Checking",
                    "tenant_exists": "Tenant found",
                    "ready": "Ready",
                    "check_failed": "Check failed",
                    "migration_success": "Migration complete",
                    "migration_failed": "Migration failed"
                },
                "toast": {
                    "check_failed": "Unable to inspect the source data.",
                    "migration_success": "Data migrated into the first Tenant.",
                    "migration_failed": "Migration failed. Check permissions and Rules."
                },
                "confirm": {
                    "overwrite": "Migrate the data and overwrite existing data in the first Tenant?",
                    "copy": "Copy data from :source into the first Tenant? The source data will not be deleted.",
                    "title": "Confirm data migration",
                    "confirm": "Confirm",
                    "cancel": "Cancel"
                },
                "log": {
                    "start": "Starting the Tenant migration...",
                    "result": ":source: copied :copied, skipped :skipped, total :total",
                    "error": "Error: :message"
                },
                "progress": {
                    "tenant": "Prepared the first Tenant.",
                    "collection": "Migrating :name...",
                    "settings": "Migrating store settings...",
                    "done": "Successfully migrated data into the first Tenant."
                }
            }
        }
    }
};
