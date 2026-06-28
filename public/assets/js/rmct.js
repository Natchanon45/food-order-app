const SOURCE_NOTE = 'ราคาเป็นราคาแนะนำ ต้องยืนยันกับร้านหรือผู้ผลิตก่อนใช้งานจริง บาร์โค้ดต้องเป็นเลขบนสินค้าจริงเท่านั้น รูปสินค้าสามารถใช้ได้เมื่อเป็นรูปแพ็กสินค้าจริงและไม่มีลายน้ำร้านค้าปลีก';

const PRODUCT_VERIFICATIONS = new Map([
  ['Crystal|น้ำดื่ม 600 มล.', {
    barcode: '8851952350161',
    catalogStatus: 'published',
    verifiedAt: '2026-06-28',
    verificationSources: [{
      name: 'สำนักงานคณะกรรมการกลางอิสลามแห่งประเทศไทย',
      url: 'https://www.halalthai.or.th/th/product/detail/724880',
      supports: ['brand', 'name', 'size', 'barcode']
    }]
  }],
  ['Nestle Pure Life|น้ำดื่ม 600 มล.', {
    barcode: '8850124003850',
    catalogStatus: 'published',
    verifiedAt: '2026-06-28',
    verificationSources: [
      {
        name: 'Nestlé Pure Life Thailand',
        url: 'https://www.nestlepurelife.com/th/th-th/nestle-purelife-06l',
        supports: ['brand', 'name', 'size']
      },
      {
        name: 'Toys R Us Thailand',
        url: 'https://www.toysrus.co.th/th-th/nestle-pure-life-drinking-water-600ml-1087948.html',
        supports: ['brand', 'name', 'size', 'barcode']
      }
    ]
  }],
  ['Chang|น้ำดื่ม 600 มล.', {
    barcode: '8851993338012',
    catalogStatus: 'published',
    verifiedAt: '2026-06-28',
    verificationSources: [{
      name: 'Priceza product index',
      url: 'https://www.priceza.com/p/%E0%B8%8A%E0%B9%89%E0%B8%B2%E0%B8%87-%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%94%E0%B8%B7%E0%B9%88%E0%B8%A1-600-%E0%B8%A1%E0%B8%A5-chang-drinking-water-600ml-533324688',
      supports: ['brand', 'name', 'size', 'barcode']
    }]
  }]
]);

const VERIFIED_IMAGES = new Map([
  // รูปสินค้าจริงแบบ packshot ไม่มีลายน้ำร้านค้าปลีกเท่านั้น
  // ตัวอย่างรูปแบบข้อมูล:
  // ['Chang|น้ำดื่ม 600 มล.', { imageUrl: 'https://...', thumbnailUrl: 'https://...', imageSource: 'brand_or_distributor' }]
]);

const MAKRO_POS_SAMPLE = 'https://www.xn--b3cvg2bid4a5a0fygm8ej.com/img_article/article/article-12/%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B8%AD%E0%B8%A2%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B9%83%E0%B8%9A%E0%B8%81%E0%B8%B3%E0%B8%81%E0%B8%B1%E0%B8%9A%E0%B8%A0%E0%B8%B2%E0%B8%A9%E0%B8%B5%E0%B8%AD%E0%B8%A2%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%A2%E0%B9%88%E0%B8%AD%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B8%AD%E0%B8%A2%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%A2%E0%B8%AD%E0%B8%94%E0%B8%82%E0%B8%B2%E0%B8%A2%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%AD%E0%B8%AD%E0%B8%81%E0%B8%88%E0%B8%B2%E0%B8%81%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B9%80%E0%B8%84%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87%20MakroPOS.pdf';

const CURATED_PRODUCTS = [
  { barcode: '8851123212021', name: 'เอ็ม-150 เครื่องดื่มชูกำลัง 150 มล.', nameEn: 'M-150 Energy Drink 150 ml', brand: 'M-150', brandTh: 'เอ็ม-150', categoryId: 'CAT005', category: 'เครื่องดื่มชูกำลัง', unit: 'ขวด', price: 15, replacesKey: 'M-150|ขวด 150 มล.', verificationSources: [
    { name: 'GS1 Thailand eCatalog', url: 'https://ecatalogue.gs1thailand.org/shop/product/8851123212021-m-150-114048', supports: ['brand','name','size','barcode'] },
    { name: 'Halal Thailand', url: 'https://halalthai.or.th/en/product/detail/413167', supports: ['brand','name','barcode'] }
  ]},
  { barcode: '8855790000011', name: 'คาราบาวแดง เครื่องดื่มชูกำลัง 150 มล.', nameEn: 'Carabao Dang Energy Drink 150 ml', brand: 'Carabao Dang', brandTh: 'คาราบาวแดง', categoryId: 'CAT005', category: 'เครื่องดื่มชูกำลัง', unit: 'ขวด', price: 15, replacesKey: 'Carabao Dang|ขวด 150 มล.', verificationSources: [
    { name: 'Halal Thailand', url: 'https://www.halalthai.or.th/en/product/detail/289547', supports: ['brand','name','barcode'] },
    { name: 'Econ Thailand', url: 'https://www.econthailand.com/product/1084392', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850228003022', name: 'กระทิงแดง เอ็กซ์ตร้า 145 มล.', nameEn: 'Krating Daeng Extra 145 ml', brand: 'Red Bull', brandTh: 'กระทิงแดง', categoryId: 'CAT005', category: 'เครื่องดื่มชูกำลัง', unit: 'ขวด', price: 12, replacesKey: 'Red Bull|ขวด 150 มล.', verificationSources: [
    { name: 'Halal Thailand', url: 'https://www.halalthai.or.th/th/product/detail/287936', supports: ['brand','name','barcode'] },
    { name: 'Chatuchak Vietnam', url: 'https://chatuchak.vn/nuoc-tang-luc-red-bull-kratingdaeng-extra-145ml-thai-lan', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8858998581221', name: 'เป๊ปซี่ น้ำอัดลม 345 มล.', nameEn: 'Pepsi Cola 345 ml', brand: 'Pepsi', brandTh: 'เป๊ปซี่', categoryId: 'CAT002', category: 'น้ำอัดลม', unit: 'ขวด', price: 13, verificationSources: [
    { name: 'Thailand Halal Information Center', url: 'https://www.thic.or.th/th/product/detail/335751', supports: ['brand','name','barcode'] },
    { name: 'Maharaj Cooperative Shop', url: 'https://www.mnrhcoopshop.com/product-details.php?productcode=6776', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8858998585182', name: 'ลิปตัน ไอซ์ที เลมอน 320 มล.', nameEn: 'Lipton Ice Tea Lemon 320 ml', brand: 'Lipton', brandTh: 'ลิปตัน', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 15, replacesKey: 'Lipton|ชาเลมอน 320 มล.', verificationSources: [
    { name: 'Thailand Halal Information Center', url: 'https://www.thic.or.th/th/product/detail/335745', supports: ['brand','name','barcode'] },
    { name: 'Maedang Market', url: 'https://www.kapimaedang.com/product/912830', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850987101014', name: 'มาม่า รสหมูสับ 60 กรัม', nameEn: 'Mama Minced Pork 60 g', brand: 'Mama', brandTh: 'มาม่า', categoryId: 'CAT007', category: 'บะหมี่กึ่งสำเร็จรูป', unit: 'ซอง', price: 7, replacesKey: 'Mama|รสหมูสับ ซอง', verificationSources: [
    { name: 'คู่มือสินค้าค้าปลีก', url: 'https://anyflip.com/wdlzn/lzng/basic/101-150', supports: ['brand','name','size','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850987101021', name: 'มาม่า รสต้มยำกุ้ง 55 กรัม', nameEn: 'Mama Shrimp Tom Yum 55 g', brand: 'Mama', brandTh: 'มาม่า', categoryId: 'CAT007', category: 'บะหมี่กึ่งสำเร็จรูป', unit: 'ซอง', price: 7, replacesKey: 'Mama|รสต้มยำกุ้ง ซอง', verificationSources: [
    { name: 'EAT Thai Market', url: 'https://eatthaimarket.com/product/mama-instant-noodles-shrimp-tom-yum-flavour-55g/', supports: ['brand','name','size','barcode'] },
    { name: 'LINE Shopping', url: 'https://shop.line.me/%40gsuper/product/1000704938', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850987101175', name: 'มาม่า รสเย็นตาโฟต้มยำหม้อไฟ 60 กรัม', nameEn: 'Mama Yentafo 60 g', brand: 'Mama', brandTh: 'มาม่า', categoryId: 'CAT007', category: 'บะหมี่กึ่งสำเร็จรูป', unit: 'ซอง', price: 7, replacesKey: 'Mama|รสเย็นตาโฟ ซอง', verificationSources: [
    { name: 'LINE Shopping', url: 'https://shop.line.me/%40gsuper/product/1001149221', supports: ['brand','name','size','barcode'] },
    { name: 'Kaotaa Market', url: 'https://kaotaamarket.lnwshop.com/product/3416/', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850987101182', name: 'มาม่า รสเป็ดพะโล้ 55 กรัม', nameEn: 'Mama Duck Pa Lo 55 g', brand: 'Mama', brandTh: 'มาม่า', categoryId: 'CAT007', category: 'บะหมี่กึ่งสำเร็จรูป', unit: 'ซอง', price: 7, verificationSources: [
    { name: 'Nanan Online', url: 'https://nananonline.com/product.php?id=10010568-1366', supports: ['brand','name','size','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8854698013697', name: 'โออิชิ กรีนที รสแตงโม 500 มล.', nameEn: 'Oishi Green Tea Watermelon 500 ml', brand: 'Oishi', brandTh: 'โออิชิ', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 25, replacesKey: 'Oishi|ชาเขียว 500 มล.', verificationSources: [
    { name: 'Priceza product index', url: 'https://www.priceza.com/s/%E0%B8%A3%E0%B8%B2%E0%B8%84%E0%B8%B2/%E0%B9%82%E0%B8%AD%E0%B8%AD%E0%B8%B4%E0%B8%8A%E0%B8%B4-%E0%B8%81%E0%B8%A3%E0%B8%B5%E0%B8%99%E0%B8%97%E0%B8%B5-%E0%B8%A3%E0%B8%AA%E0%B9%81%E0%B8%95%E0%B8%87%E0%B9%82%E0%B8%A1-380-%E0%B8%A1%E0%B8%A5', supports: ['brand','name','size','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8858891300264', name: 'อิชิตัน กรีนที จมูกข้าวญี่ปุ่น 420 มล.', nameEn: 'Ichitan Green Tea Genmaicha 420 ml', brand: 'Ichitan', brandTh: 'อิชิตัน', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 20, verificationSources: [
    { name: 'Maharaj Cooperative Shop', url: 'https://mnrhcoopshop.com/product-details.php?productcode=6891', supports: ['brand','name','size','barcode'] },
    { name: 'Sangdamrong', url: 'https://www.sangdamrong.com/product/l05-103/', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8858891300110', name: 'อิชิตัน กรีนที รสต้นตำรับ 420 มล.', nameEn: 'Ichitan Green Tea Original 420 ml', brand: 'Ichitan', brandTh: 'อิชิตัน', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 20, verificationSources: [
    { name: 'ตัดสินใจ Product Data', url: 'https://www.tudsinjai.com/data/product/ichitan_green_tea_original/', supports: ['brand','name','size','barcode'] },
    { name: 'Priceza product index', url: 'https://www.priceza.com/s/%E0%B8%A3%E0%B8%B2%E0%B8%84%E0%B8%B2/%E0%B8%AD%E0%B8%B4%E0%B8%8A%E0%B8%B4%E0%B8%95%E0%B8%B1%E0%B8%99-%E0%B8%8A%E0%B8%B2%E0%B9%80%E0%B8%82%E0%B8%B5%E0%B8%A2%E0%B8%A7-%E0%B8%A3%E0%B8%AA%E0%B8%95%E0%B9%89%E0%B8%99%E0%B8%95%E0%B8%B3%E0%B8%A3%E0%B8%B1%E0%B8%9A-420-%E0%B8%A1%E0%B8%A5', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8851123237000', name: 'ซี-วิต วิตามิน เลมอน 140 มล.', nameEn: 'C-Vitt Vitamin Lemon 140 ml', brand: 'C-Vitt', brandTh: 'ซี-วิต', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 15, verificationSources: [
    { name: 'EAT Thai Market', url: 'https://eatthaimarket.com/product/c-vitt-vitamin-c-drink-lemon-flavor-140ml/', supports: ['brand','name','size','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','barcode'] }
  ]},
  { barcode: '8851123237062', name: 'ซี-วิต วิตามิน ทับทิม 140 มล.', nameEn: 'C-Vitt Vitamin Pomegranate 140 ml', brand: 'C-Vitt', brandTh: 'ซี-วิต', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 15, verificationSources: [
    { name: 'Halal Thailand', url: 'https://www.halal.co.th/en/product/detail/692417', supports: ['brand','name','barcode'] },
    { name: '7-Eleven Vietnam', url: 'https://7-eleven.vn/san-pham/nuoc-luu-vitamin-c-c-vitt-140ml', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8851123211178', name: 'ลิโพ-พลัส เครื่องดื่มชูกำลัง 150 มล.', nameEn: 'Lipo-Plus Energy Drink 150 ml', brand: 'Lipo-Plus', brandTh: 'ลิโพ-พลัส', categoryId: 'CAT005', category: 'เครื่องดื่มชูกำลัง', unit: 'ขวด', price: 15, verificationSources: [
    { name: 'Halal Thailand', url: 'https://halalthai.or.th/en/product/detail/404407', supports: ['brand','name','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','barcode'] }
  ]},
  { barcode: '8850228006979', name: 'สปอนเซอร์ ออริจินัล โก 420 มล.', nameEn: 'Sponsor Original Go 420 ml', brand: 'Sponsor', brandTh: 'สปอนเซอร์', categoryId: 'CAT005', category: 'เครื่องดื่มชูกำลัง', unit: 'ขวด', price: 20, verificationSources: [
    { name: 'Halal Thailand', url: 'https://www.halal.co.th/en/product/detail/552783', supports: ['brand','name','barcode'] },
    { name: 'Sangdamrong', url: 'https://www.sangdamrong.com/product/l05-096/', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850250000365', name: 'เบอร์ดี้ โรบัสต้า กาแฟพร้อมดื่ม 180 มล.', nameEn: 'Birdy Robusta Coffee 180 ml', brand: 'Birdy', brandTh: 'เบอร์ดี้', categoryId: 'CAT004', category: 'กาแฟพร้อมดื่ม', unit: 'กระป๋อง', price: 15, replacesKey: 'Birdy|กาแฟกระป๋อง 180 มล.', verificationSources: [
    { name: 'EAT Thai Market', url: 'https://eatthaimarket.com/product/birdy-robusta-coffee-180ml/', supports: ['brand','name','size','barcode'] },
    { name: 'Foodello', url: 'https://www.foodello.nl/product/3367/birdy-robusta-ijskoffie-180ml', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850425002910', name: 'ยูโร่ คัสตาร์ดเค้ก 17 กรัม', nameEn: 'Euro Custard Cake 17 g', brand: 'Euro', brandTh: 'ยูโร่', categoryId: 'CAT008', category: 'ขนมขบเคี้ยว', unit: 'ชิ้น', price: 6, verificationSources: [
    { name: 'Halal Thailand', url: 'https://halal.co.th/en/product/detail/186660', supports: ['brand','name','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850256100106', name: 'มิตรผล น้ำตาลทรายขาวบริสุทธิ์ 1 กก.', nameEn: 'Mitr Phol Refined White Sugar 1 kg', brand: 'Mitr Phol', brandTh: 'มิตรผล', categoryId: 'CAT012', category: 'เครื่องปรุงและทำอาหาร', unit: 'ถุง', price: 27, verificationSources: [
    { name: 'Thailand Halal Information Center', url: 'https://www.thic.or.th/en/product/detail/249604', supports: ['brand','name','barcode'] },
    { name: 'Tops Online', url: 'https://www.tops.co.th/th/mitrphol-refined-white-sugar-1kg-8850256100106', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8859368500040', name: 'ยาคูลท์ 80 มล. แพ็ก 5 ขวด', nameEn: 'Yakult 80 ml Pack 5', brand: 'Yakult', brandTh: 'ยาคูลท์', categoryId: 'CAT006', category: 'นมและนมถั่วเหลือง', unit: 'แพ็ก', price: 45, verificationSources: [
    { name: 'Tops Online', url: 'https://www.tops.co.th/th/yakult-80ml-pack-5-8859368500040', supports: ['brand','name','size','barcode'] },
    { name: 'Makro POS sample report', url: MAKRO_POS_SAMPLE, supports: ['brand','name','barcode'] }
  ]},
  { barcode: '8858891301872', name: 'อิชิตัน กรีนที รสน้ำผึ้งมะนาว 280 มล.', nameEn: 'Ichitan Green Tea Honey Lemon 280 ml', brand: 'Ichitan', brandTh: 'อิชิตัน', categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', price: 10, verificationSources: [
    { name: 'Halal Thailand', url: 'https://www.halal.co.th/en/product/detail/465837', supports: ['brand','name','barcode'] },
    { name: 'Nanan Online', url: 'https://nananonline.com/product.php?id=10010568-1078', supports: ['brand','name','size','barcode'] }
  ]},
  { barcode: '8850999016863', name: 'สิงห์ เลมอนโซดา ไม่มีน้ำตาล 330 มล.', nameEn: 'Singha Lemon Soda Zero Sugar 330 ml', brand: 'Singha', brandTh: 'สิงห์', categoryId: 'CAT002', category: 'น้ำอัดลม', unit: 'กระป๋อง', price: 17, verificationSources: [
    { name: 'Tops Online', url: 'https://www.tops.co.th/en/singha-lemon-soda-330ml-8850999016863', supports: ['brand','name','size','barcode'] },
    { name: 'Fiksuruoka', url: 'https://www.fiksuruoka.fi/product/29426', supports: ['brand','name','size','barcode'] }
  ]}
];

const CURATED_REPLACEMENT_KEYS = new Set(CURATED_PRODUCTS.map(item => item.replacesKey).filter(Boolean));

const GROUPS = [
  { categoryId: 'CAT001', category: 'น้ำดื่ม', unit: 'ขวด', variants: ['น้ำดื่ม 600 มล.', 'น้ำดื่ม 1.5 ลิตร', 'น้ำแร่ 500 มล.', 'น้ำดื่มแพ็ค 6 ขวด'], prices: [7, 14, 10, 42], brands: [['Singha','สิงห์'], ['Crystal','คริสตัล'], ['Nestle Pure Life','เนสท์เล่ เพียวไลฟ์'], ['Minere','มิเนเร่'], ['Chang','ช้าง'], ['Aura','ออร่า']], count: 36 },
  { categoryId: 'CAT002', category: 'น้ำอัดลม', unit: 'ขวด', variants: ['กระป๋อง 325 มล.', 'ขวด 450 มล.', 'ขวด 1 ลิตร', 'ขวด 1.25 ลิตร', 'ขวด 1.5 ลิตร'], prices: [17, 20, 30, 36, 40], brands: [['Coca-Cola','โค้ก'], ['Pepsi','เป๊ปซี่'], ['Est','เอส'], ['Sprite','สไปรท์'], ['Fanta','แฟนต้า'], ['Schweppes','ชเวปส์']], count: 42 },
  { categoryId: 'CAT003', category: 'ชาและเครื่องดื่มพร้อมดื่ม', unit: 'ขวด', variants: ['ชาเขียว 380 มล.', 'ชาเขียว 500 มล.', 'ชาดำเย็น 350 มล.', 'ชาเลมอน 320 มล.'], prices: [20, 25, 15, 18], brands: [['Oishi','โออิชิ'], ['Ichitan','อิชิตัน'], ['Pokka','ป๊อกก้า'], ['Lipton','ลิปตัน']], count: 32 },
  { categoryId: 'CAT004', category: 'กาแฟพร้อมดื่ม', unit: 'ชิ้น', variants: ['กาแฟกระป๋อง 180 มล.', 'กาแฟขวด 220 มล.', 'กาแฟกล่อง 180 มล.', 'กาแฟซอง 3in1'], prices: [15, 20, 15, 7], brands: [['Nescafe','เนสกาแฟ'], ['Birdy','เบอร์ดี้'], ['Boss','บอส'], ['UCC','ยูซีซี'], ['Kopiko','โคปิโก้']], count: 36 },
  { categoryId: 'CAT005', category: 'เครื่องดื่มชูกำลัง', unit: 'ขวด', variants: ['ขวด 150 มล.', 'ขวด 250 มล.', 'กระป๋อง 250 มล.', 'สปอร์ตดริ้งค์ 250 มล.'], prices: [12, 15, 20, 15], brands: [['M-150','เอ็ม-150'], ['Carabao Dang','คาราบาวแดง'], ['Red Bull','กระทิงแดง'], ['Sponsor','สปอนเซอร์']], count: 32 },
  { categoryId: 'CAT006', category: 'นมและนมถั่วเหลือง', unit: 'กล่อง', variants: ['นม UHT 180 มล.', 'นมเปรี้ยว 180 มล.', 'นมถั่วเหลือง 300 มล.', 'นมพาสเจอร์ไรส์ 200 มล.', 'โยเกิร์ตพร้อมดื่ม 180 มล.'], prices: [13, 10, 15, 16, 14], brands: [['Dutch Mill','ดัชมิลล์'], ['Foremost','โฟร์โมสต์'], ['Meiji','เมจิ'], ['Bear Brand','ตราหมี'], ['Lactasoy','แลคตาซอย'], ['Vitamilk','ไวตามิ้ลค์']], count: 40 },
  { categoryId: 'CAT007', category: 'บะหมี่กึ่งสำเร็จรูป', unit: 'ซอง', variants: ['รสหมูสับ ซอง', 'รสต้มยำกุ้ง ซอง', 'รสเย็นตาโฟ ซอง', 'รสต้มโคล้ง ซอง', 'คัพรสหมูสับ', 'คัพรสต้มยำ'], prices: [8, 8, 8, 8, 15, 15], brands: [['Mama','มาม่า'], ['Wai Wai','ไวไว'], ['YumYum','ยำยำ'], ['Nissin','นิสชิน']], count: 50 },
  { categoryId: 'CAT008', category: 'ขนมขบเคี้ยว', unit: 'ถุง', variants: ['รสดั้งเดิม 48 กรัม', 'รสบาร์บีคิว 48 กรัม', 'รสโนริสาหร่าย 48 กรัม', 'รสชีส 48 กรัม', 'รสเผ็ด 48 กรัม'], prices: [20, 20, 20, 20, 20], brands: [['Lays','เลย์'], ['Tasto','เทสโต'], ['Pringles','พริงเกิลส์'], ['Bento','เบนโตะ'], ['Koh-Kae','โก๋แก่'], ['Pretz','เพรทซ์'], ['Pocky','ป๊อกกี้'], ['Jack n Jill','แจ็คแอนด์จิล']], count: 50 },
  { categoryId: 'CAT009', category: 'ลูกอมและหมากฝรั่ง', unit: 'ชิ้น', variants: ['ลูกอมซองเล็ก', 'ลูกอมแท่ง', 'มินต์กล่อง', 'หมากฝรั่งแผง', 'ลูกอมสมุนไพร'], prices: [10, 15, 25, 20, 22], brands: [['Halls','ฮอลล์'], ['Mentos','เมนทอส'], ['Fishermans Friend','ฟิชเชอร์แมนส์ เฟรนด์'], ['Ricola','ริโคลา'], ['Kopiko','โคปิโก้'], ['Clorets','คลอเร็ท']], count: 25 },
  { categoryId: 'CAT010', category: 'ของใช้ส่วนตัว', unit: 'ชิ้น', variants: ['ยาสีฟัน 40 กรัม', 'ยาสีฟัน 100 กรัม', 'สบู่ก้อน 70 กรัม', 'แชมพูซอง', 'แชมพูขวด 160 มล.', 'ครีมนวดซอง'], prices: [18, 45, 18, 5, 69, 5], brands: [['Colgate','คอลเกต'], ['Closeup','โคลสอัพ'], ['Darlie','ดาร์ลี่'], ['Lux','ลักส์'], ['Dove','โดฟ'], ['Dettol','เดทตอล'], ['Sunsilk','ซันซิล'], ['Pantene','แพนทีน']], count: 45 },
  { categoryId: 'CAT011', category: 'ของใช้ในบ้าน', unit: 'ชิ้น', variants: ['น้ำยาล้างจาน 500 มล.', 'ผงซักฟอก 400 กรัม', 'น้ำยาปรับผ้านุ่ม 580 มล.', 'น้ำยาล้างห้องน้ำ 500 มล.', 'สเปรย์ทำความสะอาด 500 มล.'], prices: [39, 35, 45, 38, 59], brands: [['Sunlight','ซันไลต์'], ['Downy','ดาวน์นี่'], ['Comfort','คอมฟอร์ท'], ['Breeze','บรีส'], ['Attack','แอทแทค'], ['Fineline','ไฟน์ไลน์'], ['Vixol','วิกซอล'], ['Duck','เป็ด']], count: 45 },
  { categoryId: 'CAT012', category: 'เครื่องปรุงและทำอาหาร', unit: 'ชิ้น', variants: ['ผงปรุงรส 75 กรัม', 'ซีอิ๊วขาว 300 มล.', 'น้ำปลา 300 มล.', 'ซอสหอยนางรม 300 มล.', 'ผงทำอาหารซอง'], prices: [18, 25, 24, 35, 15], brands: [['Ros Dee','รสดี'], ['Knorr','คนอร์'], ['Tiparos','ทิพรส'], ['Healthy Boy','เด็กสมบูรณ์'], ['Mae Krua','แม่ครัว'], ['Lobo','โลโบ'], ['Ajinomoto','อายิโนะโมะโต๊ะ']], count: 44 }
];

function uniq(values) { return [...new Set(values.filter(Boolean))]; }
function productKey(brand, variant) { return `${brand}|${variant}`; }
function productVerification(brand, variant) { return PRODUCT_VERIFICATIONS.get(productKey(brand, variant)) || {}; }
function verifiedImage(brand, variant) { return VERIFIED_IMAGES.get(productKey(brand, variant)) || {}; }

function isValidEan13(value) {
  if (!/^\d{13}$/.test(String(value || ''))) return false;
  const digits = [...String(value)].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

function buildCuratedProduct(item) {
  const masterProductId = `RMCT-${item.barcode}`;
  return {
    ...item,
    id: masterProductId,
    sku: masterProductId,
    masterProductId,
    barcodeStatus: 'verified_real_product',
    barcodeType: 'ean13_real',
    nameTh: item.name,
    cost: Number((Number(item.price) * 0.72).toFixed(2)),
    suggestedPrice: Number(item.price),
    priceType: 'suggested_market_price_thb',
    vatType: 'VAT',
    stock: 0,
    minStock: Number(item.price) < 30 ? 10 : 5,
    imageUrl: '',
    thumbnailUrl: '',
    imageSource: '',
    imageStatus: 'missing_product_image',
    imagePolicy: 'packshot_only_no_retail_watermark',
    keywords: uniq([item.brandTh, item.brand, item.category, item.name, item.nameEn, item.barcode]),
    status: 'active',
    showOnPos: false,
    catalogStatus: 'published',
    verificationConfidence: 'cross_checked',
    sellReady: true,
    activationStatus: 'setup_required',
    catalogVersion: 'RMCT-TH-1.4-A',
    verifiedAt: '2026-06-28',
    sourceStatus: 'cross_checked_catalog',
    sourceNote: SOURCE_NOTE
  };
}

export function buildRetailMasterCatalogThailand() {
  const products = [];
  const seenProducts = new Set();
  let sku = 1;
  for (const group of GROUPS) {
    for (let i = 0; i < group.count; i += 1) {
      const [brand, brandTh] = group.brands[i % group.brands.length];
      const variantIndex = Math.floor(i / group.brands.length) % group.variants.length;
      const variant = group.variants[variantIndex];
      const logicalKey = productKey(brand, variant);
      if (CURATED_REPLACEMENT_KEYS.has(logicalKey)) continue;
      if (seenProducts.has(logicalKey)) continue;
      seenProducts.add(logicalKey);
      const price = Number(group.prices[variantIndex] + (i % 3));
      const masterProductId = `RMCT${String(sku).padStart(6, '0')}`;
      const name = `${brandTh} ${variant}`;
      const verification = productVerification(brand, variant);
      const barcode = verification.barcode || '';
      const image = verifiedImage(brand, variant);
      const published = verification.catalogStatus === 'published' && Boolean(barcode && isValidEan13(barcode));
      products.push({
        id: masterProductId, sku: masterProductId, masterProductId, barcode,
        barcodeStatus: barcode ? 'verified_real_product' : 'missing_real_barcode', barcodeType: barcode ? 'ean13_real' : '',
        name, nameTh: name, nameEn: `${brand} ${variant}`,
        brand, brandTh, categoryId: group.categoryId, category: group.category, unit: group.unit,
        cost: Number((price * 0.72).toFixed(2)), price, suggestedPrice: price,
        priceType: 'suggested_market_price_thb', vatType: 'VAT', stock: 0,
        minStock: price < 30 ? 10 : 5,
        imageUrl: image.imageUrl || '', thumbnailUrl: image.thumbnailUrl || image.imageUrl || '',
        imageSource: image.imageSource || '', imageStatus: image.imageUrl ? 'verified_product_packshot' : 'missing_product_image',
        imagePolicy: 'packshot_only_no_retail_watermark',
        keywords: uniq([brandTh, brand, group.category, variant, name, barcode]),
        status: 'active', showOnPos: false,
        catalogStatus: published ? 'published' : 'draft', sellReady: published,
        activationStatus: 'setup_required', catalogVersion: 'RMCT-TH-1.4-A',
        verificationSources: verification.verificationSources || [], verifiedAt: verification.verifiedAt || '',
        sourceStatus: published ? 'verified_barcode_catalog' : 'catalog_needs_review', sourceNote: SOURCE_NOTE
      });
      sku += 1;
    }
  }
  products.push(...CURATED_PRODUCTS.map(buildCuratedProduct));
  return {
    version: 'RMCT-TH-1.4-A', country: 'TH', currency: 'THB', productCount: products.length,
    publishedCount: products.filter(item => item.catalogStatus === 'published').length,
    draftCount: products.filter(item => item.catalogStatus === 'draft').length,
    dataPolicy: 'บาร์โค้ดต้องเป็นเลขจริงบนสินค้าเท่านั้น รูปสินค้าใช้ได้เมื่อเป็น packshot ไม่มีลายน้ำร้านค้าปลีก และสามารถ cache เข้า Storage ภายหลังได้',
    products
  };
}

export function validateRetailMasterCatalogThailand(catalog = buildRetailMasterCatalogThailand()) {
  const productIds = new Set();
  const logicalKeys = new Set();
  const barcodes = new Set();
  const errors = [];
  for (const item of catalog.products || []) {
    const logicalKey = productKey(item.brand, item.nameTh || item.name);
    if (productIds.has(item.masterProductId)) errors.push(`duplicate_master_id:${item.masterProductId}`);
    if (logicalKeys.has(logicalKey)) errors.push(`duplicate_product:${logicalKey}`);
    productIds.add(item.masterProductId);
    logicalKeys.add(logicalKey);
    if (item.barcode) {
      if (!isValidEan13(item.barcode)) errors.push(`invalid_ean13:${item.masterProductId}`);
      if (barcodes.has(item.barcode)) errors.push(`duplicate_barcode:${item.barcode}`);
      barcodes.add(item.barcode);
    }
    if (item.catalogStatus === 'published' && !item.barcode) errors.push(`published_without_barcode:${item.masterProductId}`);
    if (item.catalogStatus === 'published' && !(item.verificationSources || []).some(source => source.url && source.supports?.includes('barcode'))) {
      errors.push(`published_without_barcode_source:${item.masterProductId}`);
    }
  }
  return { valid: errors.length === 0, errors, productCount: productIds.size, barcodeCount: barcodes.size };
}
