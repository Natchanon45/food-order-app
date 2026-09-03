export default {
    "th": {
        "admin_tenants": {
            "meta": {
                "title": "จัดการร้านค้า"
            },
            "header": {
                "title": "จัดการร้านค้า",
                "back": "กลับระบบกลาง"
            },
            "hero": {
                "eyebrow": "Super Admin",
                "title": "Tenant / ร้านค้า",
                "description": "จัดการร้าน Owner สถานะสมาชิก ยอดขายรวม และส่วนแบ่งแพลตฟอร์มในหน้าจอเดียว",
                "create": "สร้างร้านใหม่"
            },
            "filter": {
                "label": "ร้านค้า",
                "all": "ทุกร้าน",
                "help": "เลือกเพื่อกรองยอดขาย ส่วนแบ่ง สลิป และรายการร้านค้าทั้งหน้านี้",
                "aria": "กรองข้อมูลตามร้านค้า"
            },
            "report": {
                "title": "ยอดขายและส่วนแบ่ง",
                "description": "รวมยอดออเดอร์ร้านอาหารและ Retail POS แยกตามช่วงเวลา",
                "refresh": "รีเฟรช",
                "loading": "กำลังโหลด",
                "load_failed": "โหลดข้อมูลยอดขายไม่สำเร็จ",
                "period_aria": "ช่วงเวลายอดขาย",
                "periods": {
                    "daily": "รายวัน",
                    "monthly": "รายเดือน",
                    "yearly": "รายปี",
                    "custom": "กำหนดเอง"
                },
                "controls": {
                    "date": "วันที่",
                    "month": "เดือน",
                    "year": "ปี",
                    "start_date": "วันที่เริ่มต้น",
                    "end_date": "วันที่สิ้นสุด",
                    "loading_period": "กำลังโหลดช่วงเวลา..."
                },
                "labels": {
                    "daily": ":date",
                    "monthly": ":month",
                    "yearly": "ปี :year",
                    "custom": ":start - :end"
                },
                "summary": {
                    "order_sales": "ออเดอร์ร้านอาหาร",
                    "pos_sales": "Retail POS",
                    "combined_sales": "ยอดขายรวม",
                    "revenue_share": "ส่วนแบ่งรวม"
                }
            },
            "list": {
                "title": "รายการร้านค้า",
                "description": "ดูสถานะ ยอดขาย และจัดการร้านแต่ละแห่ง",
                "count": ":count ร้าน",
                "loading": "กำลังโหลดรายการร้านค้า...",
                "load_failed": "โหลดรายการร้านค้าไม่สำเร็จ",
                "empty_title": "ยังไม่มีร้านค้า",
                "empty_help": "กด “สร้างร้านใหม่” เพื่อเริ่มต้น"
            },
            "tenant": {
                "new_eyebrow": "Tenant ใหม่",
                "edit_eyebrow": "แก้ไข Tenant",
                "create_title": "สร้างร้านใหม่",
                "create_description": "กรอกข้อมูลพื้นฐานสำหรับเปิดร้านในระบบ",
                "edit_title": "แก้ไขข้อมูลร้านค้า",
                "fallback_name": "ไม่ระบุชื่อร้าน",
                "fallback_mark": "ร",
                "owner_exists": "มี Owner แล้ว",
                "owner_missing": "ยังไม่มี Owner",
                "active": "ใช้งาน",
                "inactive": "ปิดใช้งาน",
                "expires": "หมดอายุ :date",
                "revenue_share_mode": "คิดส่วนแบ่ง · :cycle",
                "revenue_share_suspended": "ระงับจากส่วนแบ่ง",
                "unlock_revenue_share": "ปลดระงับ",
                "unlock_revenue_share_title": "ปลดระงับร้านจากส่วนแบ่ง",
                "unlock_revenue_share_confirm": "ปลดระงับร้าน :name สำหรับงวดค้าง :period ใช่หรือไม่? ระบบจะถือว่างวดนี้ได้รับการยกเว้นโดย Super Admin และจะไม่ระงับซ้ำจากงวดเดิม",
                "unlock_revenue_share_success": "ปลดระงับร้านเรียบร้อยแล้ว",
                "unlock_revenue_share_failed": "ปลดระงับร้านไม่สำเร็จ",
                "id": "รหัส Tenant",
                "phone": "โทร",
                "address": "ที่อยู่",
                "open_store": "เปิดหน้าร้าน",
                "edit": "แก้ไข",
                "share": "ส่วนแบ่ง",
                "delete": "ลบ",
                "saving": "กำลังบันทึก...",
                "save_edit": "บันทึกการแก้ไข",
                "create": "สร้างร้าน",
                "created": "สร้างร้านใหม่เรียบร้อยแล้ว",
                "updated": "บันทึกการแก้ไขร้านเรียบร้อยแล้ว",
                "create_failed": "สร้างร้านไม่สำเร็จ",
                "update_failed": "แก้ไขร้านไม่สำเร็จ",
                "slug_exists": "Slug นี้ถูกใช้งานแล้ว",
                "invalid": "ข้อมูลร้านไม่ถูกต้อง",
                "delete_title": "ลบร้านค้า",
                "delete_confirm": "ยืนยันลบร้าน :name ใช่หรือไม่?\\n\\nลบได้เฉพาะร้านที่ยังไม่มีเมนู โต๊ะ ออเดอร์ หรือพนักงาน",
                "delete_confirm_button": "ลบร้าน",
                "deleted": "ลบร้านเรียบร้อยแล้ว",
                "delete_has_data": "ร้านนี้มีข้อมูลใช้งานแล้ว จึงไม่อนุญาตให้ลบ",
                "delete_failed": "ลบร้านไม่สำเร็จ",
                "fields": {
                    "name": "ชื่อร้าน",
                    "name_placeholder": "เช่น ร้านอาหารบ้านสวน",
                    "slug": "Slug สำหรับ URL",
                    "slug_placeholder": "เช่น baan-suan",
                    "slug_help": "ใช้ตัวอักษรอังกฤษเล็ก ตัวเลข และขีดกลางเท่านั้น",
                    "phone": "เบอร์โทรร้าน",
                    "phone_placeholder": "เช่น 0812345678",
                    "address": "ที่อยู่ร้าน",
                    "address_placeholder": "ที่อยู่สำหรับแสดงบนเอกสาร"
                }
            },
            "subscription": {
                "title": "สมาชิกและวันหมดอายุ",
                "not_set": "ยังไม่กำหนด",
                "package": "แพ็กเกจ",
                "status": "สถานะ",
                "remaining": "คงเหลือ",
                "expiry": "วันหมดอายุ",
                "grace_days": "ผ่อนผัน (วัน)",
                "plan": "แพ็กเกจ",
                "plans": {
                    "monthly": "รายเดือน",
                    "yearly": "รายปี"
                },
                "statuses": {
                    "active": "ใช้งาน",
                    "trialing": "ทดลอง",
                    "grace": "ช่วงผ่อนผัน",
                    "expired": "หมดอายุ",
                    "suspended": "ระงับ",
                    "inactive": "ปิดใช้งาน",
                    "revenue_share_suspended": "ระงับเนื่องจากค้างส่วนแบ่ง"
                },
                "member_statuses": {
                    "active": "สมาชิกใช้งาน",
                    "trialing": "ช่วงทดลอง",
                    "grace": "ช่วงผ่อนผัน",
                    "expired": "หมดอายุ",
                    "suspended": "ระงับ",
                    "inactive": "ปิดใช้งาน",
                    "revenue_share_suspended": "ระงับเนื่องจากค้างส่วนแบ่ง"
                },
                "days": ":count วัน",
                "days_over": "เกิน :count วัน",
                "extend_30": "ต่อ 30 วัน",
                "extend_year": "ต่อ 1 ปี",
                "save_expiry": "บันทึกวันหมดอายุ",
                "activate": "เปิดใช้งาน",
                "suspend": "ระงับ",
                "suspend_title": "ระงับบัญชีร้าน",
                "suspend_confirm": "ยืนยันระงับบัญชีร้านนี้ใช่หรือไม่? QR และระบบร้านจะหยุดใช้งานทันที",
                "updated": "อัปเดตอายุสมาชิกเรียบร้อยแล้ว",
                "update_failed": "อัปเดตอายุสมาชิกไม่สำเร็จ",
                "backfilled": "กำหนดอายุเริ่มต้นให้ :count ร้านแล้ว"
            },
            "sales": {
                "order": "ออเดอร์",
                "pos": "Retail POS",
                "combined": "ยอดขายรวม",
                "share_rate": "ส่วนแบ่ง :rate",
                "share_disabled": "ส่วนแบ่ง ยังไม่เปิด"
            },
            "share": {
                "eyebrow": "การคิดส่วนแบ่ง",
                "title": "กำหนดส่วนแบ่งยอดขาย",
                "enabled": "เปิดใช้งานการคิดส่วนแบ่ง",
                "help": "คำนวณจากยอดขายรวมของออเดอร์และ POS ตามช่วงเวลาที่เลือก",
                "rate": "อัตราส่วนแบ่ง (%)",
                "billing_cycle": "รอบการชำระและตรวจสอบ",
                "billing_cycle_help": "ใช้รอบนี้สำหรับการแนบสลิปและระงับการใช้งานเมื่อค้างชำระ",
                "billing_cycles": {
                    "daily": "รายวัน",
                    "monthly": "รายเดือน"
                },
                "current_sales": "ยอดขายช่วงปัจจุบัน",
                "estimated": "ส่วนแบ่งโดยประมาณ",
                "save": "บันทึกส่วนแบ่ง",
                "saving": "กำลังบันทึก...",
                "saved": "บันทึกอัตราส่วนแบ่งเรียบร้อยแล้ว",
                "table_missing": "ยังไม่ได้สร้างตารางส่วนแบ่งในฐานข้อมูล",
                "save_failed": "บันทึกส่วนแบ่งไม่สำเร็จ"
            },
            "review": {
                "title": "ตรวจสอบสลิปส่วนแบ่ง",
                "description": "ตรวจสอบยอดโอนจาก Tenant และยืนยันหรือปฏิเสธรายการ หากปฏิเสธระบบจะระงับร้านจนกว่าจะมีรายการที่ได้รับการยืนยัน",
                "refresh": "รีเฟรชและตรวจรอบค้าง",
                "loading": "กำลังโหลดรายการตรวจสอบ...",
                "loading_short": "กำลังโหลด",
                "load_failed": "โหลดรายการตรวจสอบสลิปไม่สำเร็จ",
                "filter_aria": "สถานะการตรวจสอบสลิป",
                "statuses": {
                    "pending": "รอตรวจสอบ",
                    "approved": "ยืนยันแล้ว",
                    "rejected": "ไม่ผ่าน",
                    "all": "ทั้งหมด"
                },
                "empty_title": "ไม่มีรายการในสถานะนี้",
                "empty_help": "เมื่อ Tenant ส่งสลิป รายการจะปรากฏที่นี่",
                "period": "งวดชำระ",
                "amount": "ยอดที่ต้องโอน",
                "rate": "อัตรา :rate%",
                "submitted": "ส่งเมื่อ",
                "view_slip": "ดู",
                "slip_title": "สลิปการโอนส่วนแบ่ง",
                "approve": "ยืนยัน",
                "reject": "ปฏิเสธ",
                "approve_title": "ยืนยันการรับเงิน",
                "approve_confirm": "ยืนยันว่าได้รับยอด :amount บาท จากร้าน :store แล้วใช่หรือไม่?",
                "approved": "ยืนยันยอดโอนเรียบร้อยแล้ว",
                "rejected": "ปฏิเสธรายการและอัปเดตสถานะร้านแล้ว",
                "review_failed": "บันทึกผลตรวจสอบไม่สำเร็จ",
                "dialog_eyebrow": "ตรวจสอบการชำระ",
                "reject_title": "ปฏิเสธสลิปการโอน",
                "note": "เหตุผล / หมายเหตุ",
                "note_placeholder": "เช่น ไม่พบยอดเงินเข้าบัญชี กรุณาตรวจสอบและแนบสลิปใหม่",
                "note_help": "Tenant จะเห็นหมายเหตุนี้ในประวัติการส่งสลิป"
            },
            "common": {
                "close": "ปิด",
                "cancel": "ยกเลิก",
                "baht": "บาท",
                "orders": ":count ออเดอร์",
                "receipts": ":count ใบเสร็จ",
                "items": ":count รายการ"
            }
        }
    },
    "en": {
        "admin_tenants": {
            "meta": {
                "title": "Tenant management"
            },
            "header": {
                "title": "Tenant management",
                "back": "Back to platform"
            },
            "hero": {
                "eyebrow": "Super Admin",
                "title": "Tenants / Stores",
                "description": "Manage stores, owners, subscriptions, total sales, and platform revenue share in one workspace.",
                "create": "Create store"
            },
            "filter": {
                "label": "Store",
                "all": "All stores",
                "help": "Filter sales, revenue share, slips, and the store list across this entire page.",
                "aria": "Filter data by store"
            },
            "report": {
                "title": "Sales and revenue share",
                "description": "Combine restaurant order and Retail POS sales by reporting period.",
                "refresh": "Refresh",
                "loading": "Loading",
                "load_failed": "Could not load sales data",
                "period_aria": "Sales reporting period",
                "periods": {
                    "daily": "Daily",
                    "monthly": "Monthly",
                    "yearly": "Yearly",
                    "custom": "Custom"
                },
                "controls": {
                    "date": "Date",
                    "month": "Month",
                    "year": "Year",
                    "start_date": "Start date",
                    "end_date": "End date",
                    "loading_period": "Loading reporting period..."
                },
                "labels": {
                    "daily": ":date",
                    "monthly": ":month",
                    "yearly": "Year :year",
                    "custom": ":start - :end"
                },
                "summary": {
                    "order_sales": "Restaurant orders",
                    "pos_sales": "Retail POS",
                    "combined_sales": "Total sales",
                    "revenue_share": "Total revenue share"
                }
            },
            "list": {
                "title": "Stores",
                "description": "Review status and sales, and manage each store.",
                "count": ":count stores",
                "loading": "Loading stores...",
                "load_failed": "Could not load stores",
                "empty_title": "No stores yet",
                "empty_help": "Select “Create store” to get started."
            },
            "tenant": {
                "new_eyebrow": "New tenant",
                "edit_eyebrow": "Edit tenant",
                "create_title": "Create store",
                "create_description": "Enter the basic details needed to open a store in the system.",
                "edit_title": "Edit store details",
                "fallback_name": "Unnamed store",
                "fallback_mark": "S",
                "owner_exists": "Owner assigned",
                "owner_missing": "No owner assigned",
                "active": "Active",
                "inactive": "Inactive",
                "expires": "Expires :date",
                "revenue_share_mode": "Revenue share · :cycle",
                "revenue_share_suspended": "Revenue-share suspended",
                "unlock_revenue_share": "Unlock",
                "unlock_revenue_share_title": "Unlock revenue-share suspension",
                "unlock_revenue_share_confirm": "Unlock :name for overdue period :period? This period will be recorded as a Super Admin override and will not suspend the store again for the same period.",
                "unlock_revenue_share_success": "Store unlocked successfully",
                "unlock_revenue_share_failed": "Could not unlock the store",
                "id": "Tenant ID",
                "phone": "Phone",
                "address": "Address",
                "open_store": "Open storefront",
                "edit": "Edit",
                "share": "Revenue share",
                "delete": "Delete",
                "saving": "Saving...",
                "save_edit": "Save changes",
                "create": "Create store",
                "created": "Store created",
                "updated": "Store changes saved",
                "create_failed": "Could not create the store",
                "update_failed": "Could not update the store",
                "slug_exists": "This slug is already in use",
                "invalid": "The store details are invalid",
                "delete_title": "Delete store",
                "delete_confirm": "Delete :name?\\n\\nOnly stores without menus, tables, orders, or staff can be deleted.",
                "delete_confirm_button": "Delete store",
                "deleted": "Store deleted",
                "delete_has_data": "This store already has operational data and cannot be deleted",
                "delete_failed": "Could not delete the store",
                "fields": {
                    "name": "Store name",
                    "name_placeholder": "For example: Garden Kitchen",
                    "slug": "URL slug",
                    "slug_placeholder": "For example: garden-kitchen",
                    "slug_help": "Use lowercase English letters, numbers, and hyphens only.",
                    "phone": "Store phone",
                    "phone_placeholder": "For example: 0812345678",
                    "address": "Store address",
                    "address_placeholder": "Address shown on documents"
                }
            },
            "subscription": {
                "title": "Subscription and expiry",
                "not_set": "Not set",
                "package": "Plan",
                "status": "Status",
                "remaining": "Remaining",
                "expiry": "Expiry date",
                "grace_days": "Grace period (days)",
                "plan": "Plan",
                "plans": {
                    "monthly": "Monthly",
                    "yearly": "Yearly"
                },
                "statuses": {
                    "active": "Active",
                    "trialing": "Trial",
                    "grace": "Grace period",
                    "expired": "Expired",
                    "suspended": "Suspended",
                    "inactive": "Inactive",
                    "revenue_share_suspended": "Suspended for revenue share"
                },
                "member_statuses": {
                    "active": "Active subscription",
                    "trialing": "Trial period",
                    "grace": "Grace period",
                    "expired": "Expired",
                    "suspended": "Suspended",
                    "inactive": "Inactive",
                    "revenue_share_suspended": "Suspended for revenue share"
                },
                "days": ":count days",
                "days_over": ":count days overdue",
                "extend_30": "Extend 30 days",
                "extend_year": "Extend 1 year",
                "save_expiry": "Save expiry date",
                "activate": "Activate",
                "suspend": "Suspend",
                "suspend_title": "Suspend store account",
                "suspend_confirm": "Suspend this store account? Its QR and store system will stop working immediately.",
                "updated": "Subscription updated",
                "update_failed": "Could not update the subscription",
                "backfilled": "Initial subscription expiry set for :count stores"
            },
            "sales": {
                "order": "Orders",
                "pos": "Retail POS",
                "combined": "Total sales",
                "share_rate": "Revenue share :rate",
                "share_disabled": "Revenue share off"
            },
            "share": {
                "eyebrow": "Revenue share",
                "title": "Configure sales revenue share",
                "enabled": "Enable revenue share",
                "help": "Calculate revenue share from combined order and POS sales for the selected period.",
                "rate": "Revenue share rate (%)",
                "billing_cycle": "Payment and review cycle",
                "billing_cycle_help": "This cycle controls slip submission and suspension when payment is overdue.",
                "billing_cycles": {
                    "daily": "Daily",
                    "monthly": "Monthly"
                },
                "current_sales": "Current-period sales",
                "estimated": "Estimated revenue share",
                "save": "Save revenue share",
                "saving": "Saving...",
                "saved": "Revenue share rate saved",
                "table_missing": "The revenue-share database table has not been created yet",
                "save_failed": "Could not save revenue share"
            },
            "review": {
                "title": "Revenue-share slip review",
                "description": "Verify tenant transfers and approve or reject each submission. A rejected transfer suspends the store until a payment for that period is approved.",
                "refresh": "Refresh and check overdue",
                "loading": "Loading review items...",
                "loading_short": "Loading",
                "load_failed": "Could not load revenue-share payment reviews",
                "filter_aria": "Revenue-share payment review status",
                "statuses": {
                    "pending": "Pending",
                    "approved": "Approved",
                    "rejected": "Rejected",
                    "all": "All"
                },
                "empty_title": "No items in this status",
                "empty_help": "Tenant submissions will appear here when a slip is uploaded.",
                "period": "Payment period",
                "amount": "Amount due",
                "rate": "Rate :rate%",
                "submitted": "Submitted",
                "view_slip": "View",
                "slip_title": "Revenue-share transfer slip",
                "approve": "Approve",
                "reject": "Reject",
                "approve_title": "Confirm payment received",
                "approve_confirm": "Confirm that THB :amount has been received from :store?",
                "approved": "Transfer approved",
                "rejected": "Submission rejected and store access updated",
                "review_failed": "Could not save the review result",
                "dialog_eyebrow": "Payment review",
                "reject_title": "Reject transfer slip",
                "note": "Reason / note",
                "note_placeholder": "For example: The transfer was not found. Please verify and upload a new slip.",
                "note_help": "The tenant can see this note in the slip submission history."
            },
            "common": {
                "close": "Close",
                "cancel": "Cancel",
                "baht": "THB",
                "orders": ":count orders",
                "receipts": ":count receipts",
                "items": ":count items"
            }
        }
    }
};
