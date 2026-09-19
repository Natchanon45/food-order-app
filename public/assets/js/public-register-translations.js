export default {
  th: {
    register: {
      meta: { title: "ลงทะเบียนเปิดร้าน" },
      header: { title: "ลงทะเบียนเปิดร้าน", home: "หน้าหลัก" },
      hero: {
        title: "เริ่มใช้งาน Premium ฟรี 1 เดือน",
        description: "สมัครร้านใหม่ ยืนยันอีเมล แล้วระบบจะเปิดสิทธิ์เจ้าของร้านให้อัตโนมัติ"
      },
      packages: {
        title: "แพ็กเกจ",
        free: { name: "ฟรี", price: "0฿ / เดือน", description: "สำหรับทดลองระบบพื้นฐาน เร็ว ๆ นี้" },
        pro: { name: "โปร", price: "390฿ / เดือน", description: "สำหรับร้านที่ต้องการเครื่องมือเพิ่ม เร็ว ๆ นี้" },
        premium: {
          name: "พรีเมียม",
          firstMonth: "0฿ / เดือนแรก",
          loading: "กำลังโหลดราคา Premium...",
          trial: "Premium Trial ฟรี 1 เดือน เปิดใช้งานอัตโนมัติหลังยืนยันอีเมล"
        }
      },
      form: {
        ownerName: "ชื่อ-นามสกุล",
        phone: "เบอร์โทรศัพท์",
        phonePlaceholder: "กรอกแค่ตัวเลข",
        email: "อีเมล",
        orderShop: "ชื่อร้านอาหาร",
        orderShopTag: "(Order/Delivery)",
        retailShop: "ชื่อร้านค้า",
        retailShopTag: "(Retail POS)",
        shopHelp: "ถ้าชื่อร้านค้าและชื่อร้านเป็นชื่อเดียวกัน ให้กรอกข้อมูลชื่อร้านอาหาร และชื่อร้านค้าเป็นชื่อเดียวกัน",
        slug: "Slug ของร้าน",
        slugHelp: "(ให้กรอกเป็นภาษาอังกฤษ ดูตัวอย่างลิงก์ของร้านเต็มได้ข้างล่าง)",
        slugPlaceholder: "saas-test-shop",
        password: "รหัสผ่าน",
        confirmPassword: "ยืนยันรหัสผ่าน",
        note: "หลังสมัคร ระบบจะส่งลิงก์ยืนยันไปที่อีเมล เมื่อยืนยันแล้วให้กลับมาหน้านี้เพื่อเปิดร้านและเริ่มนับ Premium Trial 1 เดือน",
        terms: "ข้าพเจ้าได้อ่านข้อตกลงและนโยบายการใช้งานจากระบบและมีความเข้าใจเป็นอย่างดีแล้ว",
        submit: "ยืนยันการสมัครใช้บริการ",
        login: "ลงชื่อเข้าใช้"
      },
      verify: {
        title: "ตรวจสอบอีเมลของคุณ",
        description: "กดลิงก์ยืนยันตัวตนในอีเมลแล้วกลับมาที่หน้านี้ จากนั้นกดปุ่มด้านล่างเพื่อเปิดร้าน",
        waiting: "รอการยืนยันอีเมล",
        activate: "ฉันยืนยันอีเมลแล้ว เปิดร้าน",
        resend: "ส่งอีเมลอีกครั้ง"
      },
      plan: {
        badge: "Premium Trial",
        title: "ใช้งาน Premium ฟรี 1 เดือน",
        firstMonth: "0฿",
        firstMonthSuffix: "/ เดือนแรก",
        loadingPrice: "กำลังโหลดราคา Premium...",
        loadingAnnual: "กำลังโหลดโปรโมชั่นรายปี...",
        features: {
          order: "Order / Delivery / Kitchen / Cashier",
          retail: "Retail POS พร้อม Online / Offline / Sync",
          owner: "สิทธิ์เจ้าของร้านหลังยืนยันอีเมล",
          trial: "เริ่มนับ trial หลังเปิดร้านสำเร็จ"
        }
      },
      validation: {
        fallbackLabel: "ข้อมูลนี้",
        acceptTerms: "กรุณายอมรับข้อตกลงและนโยบายการใช้งาน",
        required: "กรุณากรอก:label",
        phone: "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก",
        email: "กรุณากรอกอีเมลให้ถูกต้อง",
        passwordMin: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        passwordMismatch: "ยืนยันรหัสผ่านไม่ตรงกัน",
        checkRequired: "กรุณาตรวจสอบข้อมูลที่จำเป็นให้ครบถ้วน"
      },
      status: {
        unavailablePlan: "แพ็กเกจนี้ยังไม่เปิดสมัครในขณะนี้ กรุณาเลือกพรีเมียมเพื่อทดลองใช้งานฟรี 1 เดือน",
        accountNotFound: "ไม่พบบัญชีผู้สมัคร กรุณาสมัครใหม่อีกครั้ง",
        emailUsed: "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้รหัสเดิมให้ถูกต้อง หรือใช้อีเมลอื่น",
        signupFailed: "สมัครใช้งานไม่สำเร็จ",
        slugUsed: "Slug นี้ถูกใช้งานแล้ว กรุณาเปลี่ยน slug",
        verificationSent: "ส่งอีเมลยืนยันแล้ว กรุณาตรวจสอบกล่องจดหมาย รวมถึง Spam/Junk",
        loginFirst: "กรุณาสมัครหรือลงชื่อเข้าใช้ก่อน",
        emailUnverified: "ยังไม่พบสถานะยืนยันอีเมล กรุณากดลิงก์ในอีเมลก่อน",
        activated: "เปิดร้านสำเร็จแล้ว Premium Trial เริ่มใช้งานแล้ว",
        activateFailed: "เปิดร้านไม่สำเร็จ",
        verifiedReady: "อีเมลยืนยันแล้ว กดเปิดร้านได้เลย",
        resendSent: "ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบ Inbox และ Spam/Junk",
        resendFailed: "ส่งอีเมลยืนยันไม่สำเร็จ",
        clickVerify: "กรุณากดลิงก์ยืนยันในอีเมลก่อน"
      },
      pricing: {
        nextMonth: "และ :amount฿ สำหรับเดือนถัดไป",
        trialLine: "Premium Trial ฟรี 1 เดือน เปิดใช้งานอัตโนมัติหลังยืนยันอีเมล",
        discountPercent: "ลด :value%",
        discountAmount: "ลด :amount฿",
        special: "พิเศษ",
        months: ":months เดือน",
        excludedPayable: "ยังไม่รวม VAT :rate% • รวมชำระ :amount฿",
        includedVat: "รวม VAT :rate% • VAT :amount฿"
      }
    }
  },
  en: {
    register: {
      meta: { title: "Register a store" },
      header: { title: "Register a store", home: "Home" },
      hero: {
        title: "Start Premium free for 1 month",
        description: "Register your store, verify your email, and owner access will be activated automatically."
      },
      packages: {
        title: "Packages",
        free: { name: "Free", price: "THB 0 / month", description: "Basic trial plan — coming soon." },
        pro: { name: "Pro", price: "THB 390 / month", description: "Extra tools for growing stores — coming soon." },
        premium: {
          name: "Premium",
          firstMonth: "THB 0 / first month",
          loading: "Loading Premium pricing...",
          trial: "Premium Trial is free for 1 month and starts automatically after email verification."
        }
      },
      form: {
        ownerName: "Full name",
        phone: "Phone number",
        phonePlaceholder: "Numbers only",
        email: "Email",
        orderShop: "Restaurant name",
        orderShopTag: "(Order/Delivery)",
        retailShop: "Store name",
        retailShopTag: "(Retail POS)",
        shopHelp: "If both business names are the same, enter the same name in both Restaurant name and Store name.",
        slug: "Store slug",
        slugHelp: "(Use English letters only. A full example link is shown below.)",
        slugPlaceholder: "saas-test-shop",
        password: "Password",
        confirmPassword: "Confirm password",
        note: "After registration, we will email you a verification link. Return here after verification to activate the store and start the 1-month Premium Trial.",
        terms: "I have read and understood the service terms and usage policy.",
        submit: "Confirm registration",
        login: "Sign in"
      },
      verify: {
        title: "Check your email",
        description: "Open the verification link in your email, then return here and use the button below to activate your store.",
        waiting: "Waiting for email verification",
        activate: "I verified my email — activate store",
        resend: "Send email again"
      },
      plan: {
        badge: "Premium Trial",
        title: "Use Premium free for 1 month",
        firstMonth: "THB 0",
        firstMonthSuffix: "/ first month",
        loadingPrice: "Loading Premium pricing...",
        loadingAnnual: "Loading annual promotion...",
        features: {
          order: "Order / Delivery / Kitchen / Cashier",
          retail: "Retail POS with Online / Offline / Sync",
          owner: "Store owner access after email verification",
          trial: "Trial starts after successful store activation"
        }
      },
      validation: {
        fallbackLabel: "this field",
        acceptTerms: "Please accept the service terms and usage policy.",
        required: "Please enter :label",
        phone: "Please enter a 10-digit phone number.",
        email: "Please enter a valid email address.",
        passwordMin: "Password must contain at least 8 characters.",
        passwordMismatch: "Password confirmation does not match.",
        checkRequired: "Please review all required information."
      },
      status: {
        unavailablePlan: "This package is not available for registration yet. Please choose Premium for the free 1-month trial.",
        accountNotFound: "Applicant account not found. Please register again.",
        emailUsed: "This email is already in use. Use the existing password or choose another email.",
        signupFailed: "Registration failed.",
        slugUsed: "This slug is already in use. Please choose another slug.",
        verificationSent: "Verification email sent. Please check your inbox and Spam/Junk folders.",
        loginFirst: "Please register or sign in first.",
        emailUnverified: "Email verification has not been detected yet. Please open the verification link first.",
        activated: "Store activated successfully. Your Premium Trial has started.",
        activateFailed: "Could not activate the store.",
        verifiedReady: "Email verified. You can activate the store now.",
        resendSent: "Verification email sent again. Please check your Inbox and Spam/Junk folders.",
        resendFailed: "Could not resend the verification email.",
        clickVerify: "Please open the verification link in your email first."
      },
      pricing: {
        nextMonth: "Then THB :amount / month",
        trialLine: "Premium Trial is free for 1 month and starts automatically after email verification.",
        discountPercent: "Save :value%",
        discountAmount: "Save THB :amount",
        special: "Special",
        months: ":months months",
        excludedPayable: "VAT :rate% excluded • Payable THB :amount",
        includedVat: "VAT :rate% included • VAT amount THB :amount"
      }
    }
  }
};
