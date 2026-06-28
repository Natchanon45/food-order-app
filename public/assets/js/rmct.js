const SOURCE_NOTE = 'ราคาเป็นราคาแนะนำ ต้องยืนยันกับร้านหรือผู้ผลิตก่อนใช้งานจริง บาร์โค้ดต้องเป็นเลขบนสินค้าจริงเท่านั้น รูปสินค้ายังไม่ถูกนำเข้าอัตโนมัติ';

const VERIFIED_BARCODES = new Map([
  ['Chang|น้ำดื่ม 600 มล.', '8851993338012']
]);

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
function verifiedBarcode(brand, variant) { return VERIFIED_BARCODES.get(`${brand}|${variant}`) || ''; }

export function buildRetailMasterCatalogThailand() {
  const products = [];
  let sku = 1;
  for (const group of GROUPS) {
    for (let i = 0; i < group.count; i += 1) {
      const [brand, brandTh] = group.brands[i % group.brands.length];
      const variantIndex = Math.floor(i / group.brands.length) % group.variants.length;
      const variant = group.variants[variantIndex];
      const price = Number(group.prices[variantIndex] + (i % 3));
      const id = `P${String(sku).padStart(9, '0')}`;
      const masterProductId = `RMCT${String(sku).padStart(6, '0')}`;
      const name = `${brandTh} ${variant}`;
      const barcode = verifiedBarcode(brand, variant);
      products.push({
        id, sku: id, masterProductId, barcode,
        barcodeStatus: barcode ? 'verified_real_product' : 'missing_real_barcode', barcodeType: barcode ? 'ean13_real' : '',
        name, nameTh: name, nameEn: `${brand} ${variant}`,
        brand, brandTh, categoryId: group.categoryId, category: group.category, unit: group.unit,
        cost: Number((price * 0.72).toFixed(2)), price, suggestedPrice: price,
        priceType: 'suggested_market_price_thb', vatType: 'VAT', stock: 0,
        minStock: price < 30 ? 10 : 5, imageUrl: '', thumbnailUrl: '',
        keywords: uniq([brandTh, brand, group.category, variant, name, barcode]),
        status: 'active', showOnPos: true,
        sourceStatus: barcode ? 'verified_barcode_catalog' : 'catalog_needs_real_barcode', sourceNote: SOURCE_NOTE
      });
      sku += 1;
    }
  }
  return {
    version: 'RMCT-TH-1.0-A', country: 'TH', currency: 'THB', productCount: products.length,
    dataPolicy: 'บาร์โค้ดต้องเป็นเลขจริงบนสินค้าเท่านั้น รายการที่ยังไม่ได้ตรวจสอบจะเว้น barcode ว่างไว้ รูปสินค้ายังไม่ถูกนำเข้าอัตโนมัติ',
    products
  };
}
