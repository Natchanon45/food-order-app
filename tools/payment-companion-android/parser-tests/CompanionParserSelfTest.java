package com.lukkaja.companion;

/** No Android or external test library required: verify real message text parsing. */
public final class CompanionParserSelfTest {
  public static void main(String[] args) {
    long posted=java.time.Instant.parse("2026-11-11T09:58:38Z").toEpochMilli();
    String real="รายการเงินเข้า\n+424.00 บาท\nจากบัญชี ตัวอย่างผู้โอน X-8142\nเข้าบัญชี X-1677\nวันที่/เวลา 11/11/2026 16:58\nยอดเงินที่ใช้ได้ 628.26 บาท";
    CompanionParser.Parsed match=CompanionParser.parse("jp.naver.line.android","SCB Connect",real,posted);
    if(match==null)throw new AssertionError("real SCB Connect sample failed");
    if(!"424.00".equals(match.amount)||!"X-1677".equals(match.receiverSuffix))throw new AssertionError("wrong amount/account");
    if(!"2026-11-11T16:58:00+07:00".equals(match.bankTime))throw new AssertionError("wrong bank time: "+match.bankTime);
    // Background/locked LINE previews truncate at the bank date label.
    // Preserve amount/account and Android posting time, never invent a bank time.
    for(String[] sample:new String[][]{
        {"202.00","รายการเงินเข้า 202.00 บาท เข้าบัญชี X-1677 วันที่"},
        {"162.00","รายการเงินเข้า 162.00 บาท เข้าบัญชี X-1677 วันที่ 2"},
        {"99.00","รายการเงินเข้า 99.00 บาท เข้าบัญชี X-1677 วันที่"}
    }){
        CompanionParser.Parsed partial=CompanionParser.parseObservedOnlyForSelection(
            CompanionParser.LINE_PACKAGE,"SCB Connect",sample[1],posted,"line","scb","");
        if(partial==null||!sample[0].equals(partial.amount)||!"X-1677".equals(partial.receiverSuffix)
            ||!partial.bankTime.isEmpty()||partial.observedAt.isEmpty())
            throw new AssertionError("truncated LINE preview lost its metadata: "+sample[0]);
        if(CompanionParser.parse(CompanionParser.LINE_PACKAGE,"SCB Connect",sample[1],posted)!=null)
            throw new AssertionError("truncated preview falsely identified as full bank evidence");
        if(CompanionParser.parseObservedOnlyForSelection(
            CompanionParser.LINE_PACKAGE,"Private Chat",sample[1],posted,"line","scb","")!=null)
            throw new AssertionError("unselected private LINE chat accepted");
        if(CompanionParser.parseObservedOnlyForSelection(
            CompanionParser.LINE_PACKAGE,"SCB Connect",sample[1].replace("รายการเงินเข้า","รายการเงินออก"),posted,"line","scb","")!=null)
            throw new AssertionError("outgoing transfer was accepted");
    }
    // All eight exact selected LINE-bank service senders support the same
    // truncated preview shape without expanding access to unrelated chats.
    for(int k=0;k<CompanionParser.LINE_BANK_CODES.length;k++){
        CompanionParser.Parsed x=CompanionParser.parseObservedOnlyForSelection(
            CompanionParser.LINE_PACKAGE,CompanionParser.LINE_TITLES[k],
            "รายการเงินเข้า 99.00 บาท เข้าบัญชี X-1677 วันที่ 2",
            posted,"line",CompanionParser.LINE_BANK_CODES[k],"");
        if(x==null||!"99.00".equals(x.amount)||!x.bankTime.isEmpty()||
            !CompanionParser.LINE_SOURCES[k].equals(x.source))
            throw new AssertionError("missing selected LINE preview fallback: "+CompanionParser.LINE_TITLES[k]);
    }
    if(CompanionParser.parseObservedOnlyForSelection(
        CompanionParser.LINE_PACKAGE,"SCB Connect","รายการเงินเข้า 99.00 บาท วันที่ 2",
        posted,"line","scb","")!=null)
        throw new AssertionError("partial preview without payee account admitted");
    if(CompanionParser.parseObservedOnlyForSelection(
        CompanionParser.LINE_PACKAGE,"SCB Connect","เข้าบัญชี X-1677 วันที่ 2",
        posted,"line","scb","")!=null)
        throw new AssertionError("partial preview without amount admitted");
    if(CompanionParser.parseObservedOnlyForSelection(
        CompanionParser.LINE_PACKAGE,"SCB Connect","รายการเงินเข้า 99.00 บาท OTP 123456 เข้าบัญชี X-1677",
        posted,"line","scb","")!=null)
        throw new AssertionError("OTP preview admitted");
    String thaiYear=real.replace("11/11/2026","11/11/2569");
    if(CompanionParser.parse("jp.naver.line.android","SCB Connect",thaiYear,posted)==null)throw new AssertionError("Thai BE year failed");
    if(CompanionParser.parse("jp.naver.line.android","SCB Connect",real.replace("+424.00","-424.00"),posted)!=null)throw new AssertionError("outgoing amount accepted");
    if(CompanionParser.parse("jp.naver.line.android","LINE",real,posted)!=null)throw new AssertionError("non SCB title accepted");
    if(CompanionParser.parse("other.app","SCB Connect",real,posted)!=null)throw new AssertionError("wrong app accepted");
    if(CompanionParser.parse("jp.naver.line.android","SCB Connect",real.replace("รายการเงินเข้า","รายการเงินออก"),posted)!=null)throw new AssertionError("outgoing accepted");
    String alt=real.replace("วันที่/เวลา 11/11/2026 16:58","วันที่ 11/11/2026 @16:58");
    if(CompanionParser.parse("jp.naver.line.android","SCB Connect",alt,posted)==null)throw new AssertionError("alternate timestamp format failed");
    if (!CompanionParser.validSelection("line","scb") || !CompanionParser.validSelection("bank","kbank")
        || CompanionParser.validSelection("line","unlisted"))throw new AssertionError("source selection invalid");
    if(CompanionParser.LINE_BANK_CODES.length!=8||
       CompanionParser.LINE_BANK_LABELS.length!=8||
       CompanionParser.LINE_SOURCES.length!=8)throw new AssertionError("8 LINE services required");
    for(int i=0;i<CompanionParser.LINE_BANK_CODES.length;i++){
      String bankCode=CompanionParser.LINE_BANK_CODES[i];
      String oaName=CompanionParser.LINE_TITLES[i];
      String expectedSource=CompanionParser.LINE_SOURCES[i];
      if(!CompanionParser.validSelection("line",bankCode)||
          !CompanionParser.lineTitleMatches(bankCode,oaName))
          throw new AssertionError("LINE service missing: "+bankCode);
      if(bankCode.equals("linebk") && CompanionParser.validSelection("bank",bankCode))
          throw new AssertionError("LINE BK is a LINE service, not a separate native banking app");
      String body="รายการเงินเข้า +424.00 บาท\nเข้าบัญชี X-1677\nวันที่/เวลา 11/11/2026 16:58";
      CompanionParser.Parsed parsed=CompanionParser.parseForSelection(
          CompanionParser.LINE_PACKAGE,oaName,body,posted,"line",bankCode);
      if(parsed==null || !expectedSource.equals(parsed.source))
          throw new AssertionError("Bank-specific LINE source failed: "+bankCode);
      if(CompanionParser.parseForSelection(CompanionParser.LINE_PACKAGE,"Unknown Family",body,
         posted,"line",bankCode)!=null)throw new AssertionError("other LINE chats admitted");
      if(CompanionParser.parseForSelection(CompanionParser.LINE_PACKAGE,oaName,body,
         posted,"line",CompanionParser.LINE_BANK_CODES[(i+1)%8])!=null)
         throw new AssertionError("wrong selected LINE bank admitted");
      if(CompanionParser.parseForSelection(CompanionParser.LINE_PACKAGE,oaName,
         "รายการเงินออก -424.00 บาท",posted,"line",bankCode)!=null)
         throw new AssertionError("outgoing LINE accepted");
    }
    if(!CompanionParser.validSelection("bank","gsb") ||
       !CompanionParser.validSelection("bank","krungsri") ||
       !CompanionParser.validSelection("bank","cimb") ||
       !CompanionParser.validSelection("bank","baac") ||
       CompanionParser.validSelection("line","bbl"))
       throw new AssertionError("bank list must include LINE partner banks separately");
    if(!CompanionParser.lineTitleMatches("linebk","LINE BK")||
       !CompanionParser.lineTitleMatches("baac","BAAC Connect")||
       !CompanionParser.lineTitleMatches("kbank","LINE KBank LIVE")||
       !CompanionParser.lineTitleMatches("krungsri","LINE Krungsri Simple"))
       throw new AssertionError("safe official title variants unavailable");
    if(!"SCB Connect".equals(CompanionParser.matchingLineSender("scb",
           "1 นาที","", "SCB Connect", "")) ||
       !"SCB Connect".equals(CompanionParser.matchingLineSender("scb",
           "การแจ้งเตือนใหม่","", "", "SCB Connect")) ||
       !"".equals(CompanionParser.matchingLineSender("scb",
           "การแจ้งเตือนใหม่","", "", "Krungthai Connext")) ||
       !"".equals(CompanionParser.matchingLineSender("scb",
           "LINE • 2 การแจ้งเตือน","", "", "แชตเพื่อน"))) {
        throw new AssertionError("LINE grouped sender exact match or cross-bank privacy guard failed");
    }
    if(CompanionParser.lineTitleMatches("scb","SCB Connect SCAM")||
       CompanionParser.lineTitleMatches("cimb","CIMB Thai")||
       CompanionParser.lineTitleMatches("kbank","Personal Friend"))
       throw new AssertionError("non-approved LINE titles accepted");
    String custom="com.example.thai.bankapp";
    if(!CompanionParser.validSelection("bank","other") ||
       !CompanionParser.validBankApp(custom) ||
       CompanionParser.validBankApp("jp.naver.line.android") ||
       CompanionParser.validBankApp("com.google.android.apps.messaging"))
        throw new AssertionError("custom app selection guard failed");
    String customIncoming="เงินเข้า +424.00 บาท\nเข้าบัญชี X-1677\nวันที่/เวลา 11/11/2026 16:58";
    if(CompanionParser.parseForSelection(custom,"รายการเงินเข้า",customIncoming,posted,"bank","other",custom)==null)
        throw new AssertionError("owner-selected installed bank app not accepted");
    if(CompanionParser.parseForSelection("com.unknown.other","รายการเงินเข้า",customIncoming,posted,"bank","other",custom)!=null)
        throw new AssertionError("unselected bank app admitted");
    if(!CompanionParser.rawIncoming(custom,"เงินเข้า","ได้รับเงินเข้าบัญชีแล้ว","bank","other",custom))
        throw new AssertionError("raw incoming with incomplete amount must be forwarded");
    if(CompanionParser.rawIncoming(custom,"เงินเข้า","OTP 123456 เงินเข้า","bank","other",custom) ||
       CompanionParser.rawIncoming(custom,"เงินออก","รายการเงินออก -424.00","bank","other",custom) ||
       CompanionParser.rawIncoming("com.unknown.other","เงินเข้า",customIncoming,"bank","other",custom))
        throw new AssertionError("OTP/outgoing/unselected raw notification leaked");
    if(!CompanionParser.rawIncoming("jp.naver.line.android","SCB Connect",real,"line","scb",""))
        throw new AssertionError("real LINE income source not forwarded");
    if(CompanionParser.rawIncoming("jp.naver.line.android","Personal Friend",real,"line","scb",""))
        throw new AssertionError("private LINE chat forwarded");
    // LINE may deliver/update one Notification twice with a new Android
    // notification key or posted time: raw text still describes one transfer.
    String contentA=CompanionParser.rawDeduplicationText("line_scb_connect",
        "jp.naver.line.android","SCB Connect",
        "รายการเงินเข้า 15.00 บาท เข้าบัญชี X-1677 วันที่ 20/11/2026 @09:55");
    String contentRepeat=CompanionParser.rawDeduplicationText("line_scb_connect",
        "jp.naver.line.android","SCB Connect",
        "  รายการเงินเข้า  15.00 บาท\nเข้าบัญชี X-1677 วันที่ 20/11/2026 @09:55  ");
    String contentOther=CompanionParser.rawDeduplicationText("line_scb_connect",
        "jp.naver.line.android","SCB Connect",
        "รายการเงินเข้า 11.00 บาท เข้าบัญชี X-1677 วันที่ 20/11/2026 @09:58");
    String contentSameAmountOtherTime=CompanionParser.rawDeduplicationText("line_scb_connect",
        "jp.naver.line.android","SCB Connect",
        "รายการเงินเข้า 15.00 บาท เข้าบัญชี X-1677 วันที่ 20/11/2026 @09:59");
    if(!contentA.equals(contentRepeat) || contentA.equals(contentOther) ||
       contentA.equals(contentSameAmountOtherTime))
        throw new AssertionError("raw content dedupe incorrectly merges real transfers");
    String[] packages=CompanionParser.BANK_PACKAGES;
    String[] names=CompanionParser.BANK_CODES;
    if(names.length!=40||packages.length!=names.length||CompanionParser.BANK_LABELS.length!=names.length)
        throw new AssertionError("39 named Thai banks plus manual fallback expected");
    java.util.HashSet<String> seen=new java.util.HashSet<>();
    int mapped=0;
    for(int i=0;i<packages.length;i++){
      if(!seen.add(names[i]))throw new AssertionError("duplicate bank: "+names[i]);
      if(packages[i].isEmpty()){
        if(!CompanionParser.sourceNeedsAppSelection(names[i]))
            throw new AssertionError("unverified bank must request installed app: "+names[i]);
        continue;
      }
      mapped++;
      if(!CompanionParser.validBankApp(packages[i]))
          throw new AssertionError("bad banking app package for "+names[i]);
      String body="เงินเข้า +424.00 บาท\nเข้าบัญชี X-1677\nวันที่/เวลา 11/11/2026 16:58";
      CompanionParser.Parsed parsed=CompanionParser.parseForSelection(
          packages[i],"รายการเงินเข้า",body,posted,"bank",names[i]);
      if(parsed==null||parsed.source.isEmpty())throw new AssertionError("bank incoming failed "+names[i]);
      if(CompanionParser.parseForSelection(packages[i],"",body,posted,"bank","scb".equals(names[i])?"kbank":"scb")!=null)
          throw new AssertionError("wrong bank package accepted");
      if(CompanionParser.parseForSelection(packages[i],"","เงินออก -424.00 บาท",posted,"bank",names[i])!=null)
          throw new AssertionError("outgoing accepted "+names[i]);
    }
    if(mapped<18)throw new AssertionError("major bank package coverage regressed: "+mapped);
    if(!"com.mobilife.gsb.mymo".equals(CompanionParser.bankPackage("gsb")) ||
       !"com.krungsri.kma".equals(CompanionParser.bankPackage("krungsri")) ||
       !"com.baac.amobileplus".equals(CompanionParser.bankPackage("baac")) ||
       !"com.TMBTOUCH.PRODUCTION".equals(CompanionParser.bankPackage("ttb")) ||
       !"com.example.override".equals(CompanionParser.bankPackage("krungsri","com.example.override")) ||
       !CompanionParser.bankPackage("boc").isEmpty())
        throw new AssertionError("app package mapping or manual bank fallback failed");
    if(!"bank_other_installed".equals(CompanionParser.source("bank","gsb")) ||
       !"bank_scb_easy".equals(CompanionParser.source("bank","scb")) ||
       !"line_gsb_now".equals(CompanionParser.source("line","gsb")))
        throw new AssertionError("source identity map regressed");
    String partA="รายการเงินเข้า +424.00 บาท";
    String partB="เข้าบัญชี X-1677";
    String partC="วันที่/เวลา 11/11/2026 16:58";
    CompanionParser.Partial first=CompanionParser.fragment("jp.naver.line.android","SCB Connect",partA,posted,"line","scb");
    CompanionParser.Partial second=CompanionParser.fragment("jp.naver.line.android","SCB Connect",partB,posted,"line","scb");
    CompanionParser.Partial third=CompanionParser.fragment("jp.naver.line.android","SCB Connect",partC,posted,"line","scb");
    if(first==null||second==null||third==null)throw new AssertionError("lost partial");
    if(CompanionGroupBuffer.accept("same-notification",first,posted)!=null)throw new AssertionError("premature partial");
    if(CompanionGroupBuffer.accept("same-notification",second,posted+1000)!=null)throw new AssertionError("premature account partial");
    CompanionParser.Parsed merged=CompanionGroupBuffer.accept("same-notification",third,posted+2000);
    if(merged==null || !"424.00".equals(merged.amount) || !"X-1677".equals(merged.receiverSuffix))
       throw new AssertionError("fragment group reconstruction failed");
    CompanionGroupBuffer.clear();
    if(CompanionGroupBuffer.accept("conflict",first,posted)!=null)throw new AssertionError("premature group");
    CompanionParser.Partial conflict=CompanionParser.fragment("jp.naver.line.android","SCB Connect","รายการเงินเข้า +999.00 บาท",posted,"line","scb");
    if(CompanionGroupBuffer.accept("conflict",conflict,posted+1000)!=null)
      throw new AssertionError("conflicting amounts joined");
    if(CompanionGroupBuffer.accept("time-only",third,posted)!=null)throw new AssertionError("time only confirmed payment");
    if(CompanionParser.parseForSelection("jp.naver.line.android","SCB Connect",partC,posted,"line","scb")!=null)
      throw new AssertionError("incomplete source marked paid");
    CompanionGroupBuffer.clear();
    long now=System.currentTimeMillis();
    java.text.SimpleDateFormat bangkok=new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm",java.util.Locale.US);
    bangkok.setTimeZone(java.util.TimeZone.getTimeZone("Asia/Bangkok"));
    String incoming499="รายการเงินเข้า 499.00 บาท เข้าบัญชี X-1677 วันที่ "+bangkok.format(new java.util.Date(now));
    CompanionParser.Parsed recovered=CompanionParser.parseForSelection(CompanionParser.LINE_PACKAGE,"SCB Connect",incoming499,now,"line","scb");
    if(recovered==null||!"499.00".equals(recovered.amount)||!"X-1677".equals(recovered.receiverSuffix))
        throw new AssertionError("SCB 499 format failed");
    if(CompanionParser.parseForSelection(CompanionParser.LINE_PACKAGE,"LINE BK Alerts",incoming499,now,"line","scb")!=null)
        throw new AssertionError("wrong bank admitted");
    if(!CompanionLineRecovery.eligible("line-group","line-group",CompanionParser.LINE_PACKAGE,false,now,now-1000)||
       CompanionLineRecovery.eligible("line-group","different",CompanionParser.LINE_PACKAGE,false,now,now)||
       CompanionLineRecovery.eligible("line-group","line-group",CompanionParser.LINE_PACKAGE,true,now,now)||
       CompanionLineRecovery.eligible("line-group","line-group","other.app",false,now,now)||
       CompanionLineRecovery.eligible("line-group","line-group",CompanionParser.LINE_PACKAGE,false,now,now-61000))
        throw new AssertionError("group recovery privacy/freshness guard failed");
    System.out.println("SCB 499 format + recent exact-group child recovery PASS");
    System.out.println("SCB parser + selected bank packages + partial groups + ambiguous amounts PASS");
  }
}
