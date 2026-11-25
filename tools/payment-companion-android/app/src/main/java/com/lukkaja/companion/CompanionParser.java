package com.lukkaja.companion;

import java.text.*;
import java.util.*;
import java.util.regex.*;

/** Strictly opt-in, app-origin-bound incoming-only parsed observations.
 *  The phone cannot authenticate the bank; everything remains unverified.
 *  Partial fragments are kept in RAM only, never raw text on disk.
 */
final class CompanionParser {
 static final String LINE_PACKAGE = "jp.naver.line.android";
 static final String[] BANK_CODES = {
  "scb","kbank","ktb","bbl",
  "krungsri","ttb","cimb","uob",
  "kkp","tisco","lhbank","thaicredit",
  "standard","icbc","boc","mega",
  "clix","rhb","jdb","smtrust",
  "gsb","baac","ghb","ibank",
  "smed","exim","hsbc","mufg",
  "mizuho","smbc","jpmorgan","boa",
  "db","bnp","ca","ocbc",
  "anz","indian_overseas","state_street","other"
 };
 static final String[] BANK_LABELS = {
  "ไทยพาณิชย์ (SCB EASY)","กสิกรไทย (K PLUS)","กรุงไทย (Krungthai NEXT)","กรุงเทพ (Bangkok Bank Mobile Banking)",
  "กรุงศรีอยุธยา (krungsri app)","ทหารไทยธนชาต (ttb touch)","ซีไอเอ็มบี ไทย (CIMB THAI)","ยูโอบี (UOB TMRW Thailand)",
  "เกียรตินาคินภัทร (KKP Better)","ทิสโก้ (TISCO My Wealth)","แลนด์ แอนด์ เฮ้าส์ (LHB You)","ไทยเครดิต (alpha by Thai Credit)",
  "สแตนดาร์ดชาร์เตอร์ด (ไทย)","ไอซีบีซี (ไทย) (ICBC Mobile Banking)","แห่งประเทศจีน (ไทย) (Bank of China)","เมกะ สากลพาณิชย์ (Mega International)",
  "คลิกซ์ (CLIX / Virtual Bank)","อาร์ เอช บี (RHB)","ร่วมพัฒนา (Joint Development Bank)","ซูมิโตโม มิตซุย ทรัสต์ (ไทย)",
  "ออมสิน (MyMo)","เพื่อการเกษตรและสหกรณ์การเกษตร (BAAC Mobile)","อาคารสงเคราะห์ (GHB ALL GEN)","อิสลามแห่งประเทศไทย (ibank)",
  "พัฒนาวิสาหกิจขนาดกลางฯ (SME D Bank)","เพื่อการส่งออกและนำเข้าแห่งประเทศไทย (MY EXIM)","เอชเอสบีซี (HSBC)","มิตซูบิชิ ยูเอฟเจ (MUFG)",
  "มิซูโฮ (Mizuho)","ซูมิโตโม มิตซุย แบงกิ้ง (SMBC)","เจพีมอร์แกน เชส (JPMorgan Chase)","แบงก์ ออฟ อเมริกา (Bank of America)",
  "ดอยซ์แบงก์ (Deutsche Bank)","บีเอ็นพี พารีบาส์ (BNP Paribas)","เครดิต อะกริกอล (Crédit Agricole CIB)","โอเวอร์ซี-ไชนีส แบงกิ้ง (OCBC)",
  "ออสเตรเลีย แอนด์ นิวซีแลนด์ แบงกิ้ง (ANZ)","อินเดียน โอเวอร์ซีส์ (Indian Overseas Bank)","สเตท สตรีท แบงก์ (State Street)","ธนาคารอื่น / แอปธนาคารที่ไม่มีในรายการ"
 };
 static final String[] BANK_PACKAGES = {
  "com.scb.phone","com.kasikorn.retail.mbanking.wap","ktbcs.netbank","com.bbl.mobilebanking",
  "com.krungsri.kma","com.TMBTOUCH.PRODUCTION","com.cimbthai.digital.mycimb","com.uob.mightyth2",
  "com.kkp.kkpmobile","com.tisconet.mba","com.lh.lhbu","com.tcrbank.retail.mobilebanking",
  "","com.icbc.mobile.abroadbank","","",
  "","","","",
  "com.mobilife.gsb.mymo","com.baac.amobileplus","th.co.ghbank.allgen","",
  "com.smebank.smedbank","th.go.myexim.myexim","","",
  "","","","",
  "","","","",
  "","","",""
 };
 // LINE bank notification services are deliberately distinct from native
 // banking apps. A LINE sender title is not cryptographic sender identity.
 static final String[] LINE_BANK_CODES = {"kbank","scb","krungsri","ktb","gsb","cimb","baac","linebk"};
 static final String[] LINE_BANK_LABELS = {
   "กสิกรไทย • KBank LIVE",
   "ไทยพาณิชย์ • SCB Connect",
   "กรุงศรีอยุธยา • Krungsri Simple",
   "กรุงไทย • Krungthai Connext",
   "ออมสิน • GSB NOW",
   "ซีไอเอ็มบี ไทย • CIMB THAI Connect",
   "ธ.ก.ส. • BAAC Family",
   "LINE BK • LINE BK Alerts"
 };
 static final String[] LINE_TITLES = {
   "KBank LIVE","SCB Connect","Krungsri Simple","Krungthai Connext",
   "GSB NOW","CIMB THAI Connect","BAAC Family","LINE BK Alerts"
 };
 static final String[] LINE_SOURCES = {
   "line_kbank_live","line_scb_connect","line_krungsri_simple",
   "line_krungthai_connext","line_gsb_now","line_cimb_thai_connect",
   "line_baac_family","line_linebk_alerts"
 };
 static String[] codesFor(String mode) {
    return "line".equals(mode)?LINE_BANK_CODES:BANK_CODES;
 }
 static String[] labelsFor(String mode) {
    return "line".equals(mode)?LINE_BANK_LABELS:BANK_LABELS;
 }
 static boolean lineTitleMatches(String bank, String title) {
    if(title==null || title.length()>100)return false;
    String sender=title.trim().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);
    for(int i=0;i<LINE_BANK_CODES.length;i++){
      if(!LINE_BANK_CODES[i].equals(bank))continue;
      String expected=LINE_TITLES[i].toLowerCase(Locale.ROOT);
      if(sender.equals(expected))return true;
      // Official full service names on some Android LINE versions.
      if("kbank".equals(bank) && sender.equals("line kbank live"))return true;
      if("krungsri".equals(bank) && sender.equals("line krungsri simple"))return true;
      // The LINE BK notification sender may omit the suffix.
      if("linebk".equals(bank) && sender.equals("line bk"))return true;
      // BAAC Connect alerts originate in the BAAC Family service.
      if("baac".equals(bank) && sender.equals("baac connect"))return true;
      return false;
    }
    return false;
 }

 // LINE's grouped notifications may place the exact verified-by-selection
 // OA display name in conversationTitle or subText rather than EXTRA_TITLE.
 // Matching stays exact: never accept a sender merely contained in arbitrary
 // text, because that could forward private or unrelated LINE messages.
 static String matchingLineSender(String bank,String... candidates) {
   if(candidates==null)return "";
   for(String candidate:candidates)
     if(lineTitleMatches(bank,candidate))return candidate.trim().replaceAll("\\s+"," ");
   return "";
 }
 static final Pattern AMOUNT = Pattern.compile("(?:รายการเงินเข้า|เงินเข้า|รับเงิน|ยอดเงินเข้า|ได้รับเงิน|รับโอน|โอนเข้า)\\s*[:：]?\\s*\\+?\\s*([0-9,]+\\.[0-9]{2})\\s*(?:บาท|THB)?", Pattern.CASE_INSENSITIVE);
 static final Pattern AMOUNT_BEFORE = Pattern.compile("([0-9,]+\\.[0-9]{2})\\s*(?:บาท|THB)\\s*(?:เงินเข้า|รับโอน|โอนเข้า)", Pattern.CASE_INSENSITIVE);
 static final Pattern ACCOUNT = Pattern.compile("(?:เข้าบัญชี|บัญชีรับ|บัญชี)\\s*[:：]?\\s*(?:[Xx*•-]+\\s*)?([0-9]{4})\\b");
 static final Pattern ACCOUNT_LEGACY = Pattern.compile("เข้าบัญชี\\s+(X-[0-9]{4})");
 static final Pattern DATE = Pattern.compile("(?:วันที่(?:/เวลา)?|วันเวลา|เวลาโอน)\\s*[:：]?\\s*(\\d{1,2}/\\d{1,2}/\\d{4}\\s*@?\\s*\\d{2}:\\d{2})");
 static final Pattern YEAR_FIRST = Pattern.compile("(?:วันที่(?:/เวลา)?|วันเวลา|เวลาโอน)\\s*[:：]?\\s*(\\d{4}-\\d{1,2}-\\d{1,2}\\s+\\d{2}:\\d{2})");
 static final Pattern EXPLICIT_IN = Pattern.compile("รายการเงินเข้า|เงินเข้า|รับเงิน|ยอดเงินเข้า|ได้รับเงิน|รับโอน|โอนเข้า|received|credited|incoming transfer",Pattern.CASE_INSENSITIVE);
 static final Pattern OUTGOING = Pattern.compile("รายการเงินออก|เงินออก|โอนออก|จ่ายเงิน|ถอนเงิน|หักบัญชี|debited|withdrawal|outgoing transfer",Pattern.CASE_INSENSITIVE);
 static final Pattern OTP = Pattern.compile("(?:\\bOTP\\b|one.time.password|verification code|รหัสยืนยัน|รหัสผ่าน|\\bPIN\\b)",Pattern.CASE_INSENSITIVE);
 static final Pattern PACKAGE_ID = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]*(?:\\.[a-zA-Z][a-zA-Z0-9_]*)+$");
 // Fingerprint notification *content*, never Android's delivery/posting key.
 // LINE can repost the same financial message with different StatusBar keys
 // within seconds. Include source, package, account/amount/time in text so
 // distinct transfers are not merged merely because their amounts match.
 static String rawDeduplicationText(String source,String pkg,String title,String raw) {
   return source+"|"+pkg+"|"+title.trim().replaceAll("\\s+"," ")+
          "|"+raw.trim().replaceAll("\\s+"," ");
 }

 static boolean validBankApp(String pkg) {
   if(pkg==null || pkg.length()>150 || !PACKAGE_ID.matcher(pkg).matches())return false;
   return !pkg.equals(LINE_PACKAGE) && !pkg.equals("org.telegram.messenger")
       && !pkg.equals("com.whatsapp") && !pkg.equals("com.google.android.apps.messaging")
       && !pkg.equals("com.lukkaja.companion") && !pkg.startsWith("com.lukkaja.companion.");
 }
 static boolean rawIncoming(String pkg,String title,String body,String mode,String bank,String customPackage) {
   if(body==null||body.isEmpty()||body.length()>4000||title==null||title.length()>150)return false;
   if(!validSelection(mode,bank))return false;
   if("line".equals(mode)){
     if(!LINE_PACKAGE.equals(pkg)||!lineTitleMatches(bank,title))return false;
   }else if(!bankPackage(bank,customPackage).equals(pkg)||pkg.isEmpty())return false;
   String combined=title+"\n"+body;
   // A generic bank-app title such as "เงินเข้า" alone is insufficient:
   // the body must independently indicate incoming money, or contain a sum.
   boolean incoming=EXPLICIT_IN.matcher(body).find() ||
       (EXPLICIT_IN.matcher(title).find() && Pattern.compile("[0-9][0-9,.]*").matcher(body).find());
   return incoming && !OUTGOING.matcher(combined).find()
       && !OTP.matcher(combined).find();
 }

 static boolean validSelection(String mode, String bank) {
    if (!"line".equals(mode) && !"bank".equals(mode))return false;
    for (String code:codesFor(mode))if(code.equals(bank))return true;
    return false;
 }
 static String bankPackage(String bank) {
    for(int i=0;i<BANK_CODES.length;i++)if(BANK_CODES[i].equals(bank))return BANK_PACKAGES[i];
    return "";
 }
 static String bankPackage(String bank,String customPackage) {
   // A known package is the preferred default. A manually chosen installed
   // package can override only this one bank, never read all installed apps.
   return validBankApp(customPackage) ? customPackage : bankPackage(bank);
 }
 static boolean sourceNeedsAppSelection(String bank) {
   return validSelection("bank",bank) && bankPackage(bank).isEmpty();
 }
 static String source(String mode,String bank){
    if("line".equals(mode)) {
      for(int i=0;i<LINE_BANK_CODES.length;i++)
        if(LINE_BANK_CODES[i].equals(bank))return LINE_SOURCES[i];
      return "";
    }
    if("bank".equals(mode)&&"scb".equals(bank))return "bank_scb_easy";
    if("bank".equals(mode)&&"kbank".equals(bank))return "bank_kplus";
    if("bank".equals(mode)&&"ktb".equals(bank))return "bank_ktb_next";
    if("bank".equals(mode)&&"bbl".equals(bank))return "bank_bbl_mobile";
    if("bank".equals(mode)&&validSelection("bank",bank))return "bank_other_installed";
    return "";
 }
 static final class Partial {
    final String source,amount,account,time,observedAt;
    final boolean incoming;
    Partial(String s,String a,String r,String t,String o,boolean in){
      source=s;amount=a;account=r;time=t;observedAt=o;incoming=in;
    }
    boolean complete(){return incoming&&!amount.isEmpty()&&!account.isEmpty()&&!time.isEmpty();}
    // An Android-observed notification is NOT a bank timestamp. This remains
    // unverified and must be treated as a separate, lower-trust time basis.
    boolean observedOnly(){return incoming&&!amount.isEmpty()&&!account.isEmpty()
            &&time.isEmpty()&&!observedAt.isEmpty();}
    Parsed finish(){return complete()?new Parsed(amount,account,time,observedAt,source):null;}
    Parsed finishObservedOnly(){return observedOnly()
            ?new Parsed(amount,account,"",observedAt,source):null;}
 }
 static String iso(Date value,String tz){
    SimpleDateFormat iso=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.US);
    iso.setTimeZone(TimeZone.getTimeZone(tz));
    return iso.format(value);
 }
 static String normalizedDate(String raw){
    try{
      String dateString=raw.replace("@"," ").replaceAll("\\s+"," ").trim();
      String[] parts=dateString.split(" ");
      if(parts.length!=2)return "";
      Date date;
      SimpleDateFormat format;
      if(parts[0].contains("/")){
        String[] fields=parts[0].split("/");
        if(fields.length!=3)return "";
        int year=Integer.parseInt(fields[2]);
        if(year>=2400)year-=543;
        if(year<2020||year>2100)return "";
        dateString=fields[0]+"/"+fields[1]+"/"+year+" "+parts[1];
        format=new SimpleDateFormat("dd/MM/yyyy HH:mm",Locale.US);
      }else{
        format=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.US);
      }
      format.setTimeZone(TimeZone.getTimeZone("Asia/Bangkok"));format.setLenient(false);
      date=format.parse(dateString);
      if(date==null||date.getTime()>System.currentTimeMillis()+600000L
         ||date.getTime()<System.currentTimeMillis()-86400000L*45)return "";
      return iso(date,"Asia/Bangkok");
    }catch(Exception ignored){return "";}
 }
 static Partial fragment(String pkg,String title,String body,long postedAt,String mode,String bank){
   return fragment(pkg,title,body,postedAt,mode,bank,"");
 }
 static Partial fragment(String pkg,String title,String body,long postedAt,String mode,String bank,String customPackage){
    if(!validSelection(mode,bank)||title==null||body==null||postedAt<=0||body.length()>2000)return null;
    if("line".equals(mode)){
      if(!LINE_PACKAGE.equals(pkg)||!lineTitleMatches(bank,title))return null;
    }else if(!bankPackage(bank,customPackage).equals(pkg)||pkg.isEmpty())return null;
    if(OUTGOING.matcher(body).find()||OTP.matcher(body).find())return null;
    boolean explicitlyIncoming=EXPLICIT_IN.matcher(body).find();
    Matcher a=AMOUNT.matcher(body);
    Matcher a2=AMOUNT_BEFORE.matcher(body);
    Matcher c=ACCOUNT_LEGACY.matcher(body);
    Matcher c2=ACCOUNT.matcher(body);
    Matcher dt=DATE.matcher(body);
    Matcher dt2=YEAR_FIRST.matcher(body);
    String amount=a.find()?a.group(1):a2.find()?a2.group(1):"";
    String account=c.find()?c.group(1):c2.find()?"X-"+c2.group(1):"";
    String raw=dt.find()?dt.group(1):dt2.find()?dt2.group(1):"";
    String time=raw.isEmpty()?"":normalizedDate(raw);
    if(!amount.isEmpty()){
      amount=amount.replace(",","");
      if(amount.startsWith("-")||amount.startsWith("0.00"))return null;
    }
    if(amount.isEmpty()&&account.isEmpty()&&time.isEmpty())return null;
    // A partial bank timestamp or account without explicit incoming text
    // cannot become a complete event on its own; it may join ONLY a matching
    // same-group fragment carrying explicit incoming evidence.
    return new Partial(source(mode,bank),amount,account,time,iso(new Date(postedAt),"UTC"),explicitlyIncoming);
 }
 // Used only for an exact, owner-selected LINE bank sender with a fresh
 // individual notification containing BOTH amount and destination account.
 // Never reconstruct a truncated bank date or take data from other chats.
 static Parsed parseObservedOnlyForSelection(String pkg,String title,String body,long postedAt,
                                               String mode,String bank,String customPackage){
    if(!"line".equals(mode))return null;
    Partial piece=fragment(pkg,title,body,postedAt,mode,bank,customPackage);
    return piece==null?null:piece.finishObservedOnly();
 }
 static Parsed parseForSelection(String pkg,String title,String body,long postedAt,String mode,String bank){
    return parseForSelection(pkg,title,body,postedAt,mode,bank,"");
 }
 static Parsed parseForSelection(String pkg,String title,String body,long postedAt,String mode,String bank,String customPackage){
    Partial p=fragment(pkg,title,body,postedAt,mode,bank,customPackage);
    return p==null?null:p.finish();
 }
 static Parsed parse(String pkg,String title,String body,long postedAt){
    return parseForSelection(pkg,title,body,postedAt,"line","scb");
 }
 static final class Parsed {
    final String amount,receiverSuffix,bankTime,observedAt,source;
    Parsed(String a,String r,String t,String o){this(a,r,t,o,"line_scb_connect");}
    Parsed(String a,String r,String t,String o,String s){amount=a;receiverSuffix=r;bankTime=t;observedAt=o;source=s;}
 }
}
