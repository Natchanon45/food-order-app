package com.lukkaja.companion;

import android.app.Notification;
import android.os.Bundle;
import android.os.Build;
import android.os.Parcelable;
import android.os.Handler;
import android.os.Looper;
import java.util.List;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.LinkedHashSet;

/** One explicitly selected notification source and bank, never LINE chats
 *  and bank apps at the same time. Owner retains Android permission control. */
public final class IncomingNotificationService extends NotificationListenerService {
    private final Handler recoveryHandler=new Handler(Looper.getMainLooper());
    private static String charString(CharSequence value) {
        return value==null?"":value.toString();
    }
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if(sbn==null)return;
        SecureSettings settings=new SecureSettings(this);
        if(!settings.enabled()||settings.token().isEmpty())return;
        String mode=settings.sourceMode(), bank=settings.bank(), pkg=sbn.getPackageName();
        String customPackage=settings.customBankPackage();
        if(!CompanionParser.validSelection(mode,bank))return;
        // Count only whitelisted FINANCIAL apps; never store or inspect
        // unrelated apps/LINE chats for diagnostics.
        boolean selected="line".equals(mode)
            ? CompanionParser.LINE_PACKAGE.equals(pkg)
            : CompanionParser.bankPackage(bank,customPackage).equals(pkg);
        if(!selected) {
            for(String bankPackage:CompanionParser.BANK_PACKAGES) {
                if(bankPackage.equals(pkg)) {
                    CompanionDiagnostics.record(this,"otherBankSource",
                        "แจ้งเตือนจากแอปธนาคารที่ไม่ได้เลือก");
                    break;
                }
            }
            return;
        }
        Notification notification=sbn.getNotification();
        if(notification==null||notification.extras==null)return;
        Bundle extras=notification.extras;
        CharSequence title=extras.getCharSequence(Notification.EXTRA_TITLE);
        String sourceTitle=title==null?"":title.toString();
        // Android groups LINE conversations and may replace EXTRA_TITLE with
        // an age/group label. Never parse a mixed LINE group summary as though
        // it were a single bank message; it might include private chats or a
        // notification from another banking LINE account.
        if("line".equals(mode)){
            if((notification.flags & Notification.FLAG_GROUP_SUMMARY)!=0){
                // Only extract a message when Android provides an exact bank
                // sender for that specific message. Never upload the merged
                // summary that may contain unrelated chats or another bank.
                if(!handleExactLineMessages(sbn,notification,extras,bank,pkg,customPackage)){
                    CompanionDiagnostics.record(this,"groupSummarySkipped",
                        "LINE รวมหลายแชต: กำลังตรวจ Notification รายแชตในกลุ่มเดียวกัน");
                    // Android can deliver the summary before the individual
                    // records are visible to the notification listener.
                    String group=sbn.getGroupKey();
                    recoverLineChildren(group,bank);
                    recoveryHandler.postDelayed(()->recoverLineChildren(group,bank),900L);
                }
                return;
            }
            // Prefer structured messages when available. Each message must
            // independently identify the selected bank; do not merge chats.
            if(handleExactLineMessages(sbn,notification,extras,bank,pkg,customPackage))return;
            sourceTitle=CompanionParser.matchingLineSender(bank,sourceTitle,
                charString(extras.getCharSequence(Notification.EXTRA_TITLE_BIG)),
                charString(extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)),
                charString(extras.getCharSequence(Notification.EXTRA_SUB_TEXT)));
            if(sourceTitle.isEmpty()){
                CompanionDiagnostics.record(this,"lineSenderUnmatched",
                    "พบ LINE แต่ชื่อบริการไม่ตรง: ตรวจรูปแบบ LINE ที่จัดกลุ่ม");
                return;
            }
        }
        CompanionDiagnostics.record(this,"selectedSource",
            "Android ส่ง Notification จากแหล่งที่เลือกแล้ว");
        // Multiple visible notification text fields are preserved as supplied;
        // duplicate text copies are omitted, not mixed with other notifications.
        LinkedHashSet<String> fragments=new LinkedHashSet<>();
        CharSequence big=extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence main=extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence sub=extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
        if(big!=null)fragments.add(big.toString());
        if(main!=null)fragments.add(main.toString());
        if(sub!=null)fragments.add(sub.toString());
        CharSequence[] lines=extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if(lines!=null)for(CharSequence line:lines)if(line!=null)fragments.add(line.toString());
        if(fragments.isEmpty()) {
            CompanionDiagnostics.record(this,"incomplete","Notification ไม่มีข้อความให้อ่าน");
            return;
        }
        processSelectedContent(sbn,notification,mode,bank,pkg,customPackage,sourceTitle,
            fragments,sbn.getPostTime(),sbn.getKey());
    }
    private void recoverLineChildren(String group,String bank){
        SecureSettings settings=new SecureSettings(this);
        if(!settings.enabled()||settings.token().isEmpty()||
            !"line".equals(settings.sourceMode())||!bank.equals(settings.bank())||
            group==null||group.isEmpty())return;
        try{
            StatusBarNotification[] active=getActiveNotifications();
            if(active==null)return;
            long now=System.currentTimeMillis();
            for(StatusBarNotification child:active){
                if(child==null||!CompanionParser.LINE_PACKAGE.equals(child.getPackageName()))continue;
                Notification n=child.getNotification();
                if(n==null||!CompanionLineRecovery.eligible(group,child.getGroupKey(),
                    child.getPackageName(),(n.flags & Notification.FLAG_GROUP_SUMMARY)!=0,
                    now,child.getPostTime()))continue;
                // Normal path still enforces exact selected sender and incoming
                // amount/account/time. Existing queue deduplicates observations.
                onNotificationPosted(child);
            }
        }catch(RuntimeException ignored){
            // Listener may disconnect between callback and recovery.
        }
    }
    private boolean handleExactLineMessages(StatusBarNotification sbn,
            Notification notification,Bundle extras,String bank,String pkg,String customPackage){
        // getMessagesFromBundleArray is public only on API 30+; on older
        // devices preserve the strict title / conversation / subText path.
        if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R)return false;
        Parcelable[] bundles=extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if(bundles==null||bundles.length==0)return false;
        List<Notification.MessagingStyle.Message> messages;
        try {
            messages=Notification.MessagingStyle.Message.getMessagesFromBundleArray(bundles);
        }catch(RuntimeException ex){return false;}
        boolean matched=false;
        for(Notification.MessagingStyle.Message message:messages){
            if(message==null||message.getText()==null)continue;
            String sender=CompanionParser.matchingLineSender(bank,
                charString(message.getSender()));
            if(sender.isEmpty())continue;
            String body=message.getText().toString();
            if(body.isEmpty())continue;
            long when=message.getTimestamp()>0?message.getTimestamp():sbn.getPostTime();
            // MessagingStyle can contain old conversation history. Do not
            // replay old transactions as new observations.
            if(!CompanionLineRecovery.recent(System.currentTimeMillis(),when))continue;
            LinkedHashSet<String> selectedText=new LinkedHashSet<>();
            selectedText.add(body);
            CompanionDiagnostics.record(this,"selectedSource",
                "พบข้อความ LINE รายแชตจากบริการที่เลือก");
            processSelectedContent(sbn,notification,"line",bank,pkg,customPackage,sender,
                selectedText,when,sbn.getKey()+"|"+when);
            matched=true;
        }
        return matched;
    }
    private void processSelectedContent(StatusBarNotification sbn,Notification notification,
            String mode,String bank,String pkg,String customPackage,String sourceTitle,
            LinkedHashSet<String> fragments,long postedAt,String identity){
        String group=notification.getGroup();
        String groupKey=pkg+"|"+("line".equals(mode)?sourceTitle:bank)
                +"|"+(group!=null&&!group.isEmpty()?group:identity);
        // Send every explicitly incoming selected-source observation to both
        // opt-in Telegram channels, even when financial matching is incomplete.
        // The raw notification is encrypted at rest in the local retry queue.
        String raw=String.join("\n",fragments);
        if(CompanionParser.rawIncoming(pkg,sourceTitle,raw,mode,bank,customPackage)){
            String rawIdentity="raw|"+pkg+"|"+sourceTitle+"|"+raw+"|"+postedAt+"|"+identity;
            if(!CompanionQueue.enqueueRaw(this,rawIdentity,CompanionParser.source(mode,bank),
                                          pkg,sourceTitle,raw,postedAt)){
                CompanionDiagnostics.record(this,"sendError","ไม่สามารถเข้ารหัสหรือเข้าคิวข้อความดิบได้");
            }
        }
        // Parsed payment candidates remain a separate strict and advisory path.
        // Count only independently complete fragments, not mixtures from
        // multiple notifications in LINE's grouped UI.
        CompanionParser.Parsed observedOnly=null;
        boolean ambiguousObservedOnly=false;
        for(String body:fragments){
            if("line".equals(mode)){
                CompanionParser.Parsed candidate=CompanionParser.parseObservedOnlyForSelection(
                        pkg,sourceTitle,body,postedAt,mode,bank,customPackage);
                if(candidate!=null){
                    if(observedOnly!=null &&
                       (!observedOnly.amount.equals(candidate.amount) ||
                        !observedOnly.receiverSuffix.equals(candidate.receiverSuffix))){
                        ambiguousObservedOnly=true;
                    } else observedOnly=candidate;
                }
            }
            CompanionParser.Partial partial=CompanionParser.fragment(pkg,sourceTitle,body,postedAt,mode,bank,customPackage);
            if(partial==null)continue;
            CompanionParser.Parsed parsed=CompanionGroupBuffer.accept(groupKey,partial,System.currentTimeMillis());
            if(parsed==null)continue;
            String stable=parsed.source+"|"+parsed.amount+"|"+parsed.receiverSuffix
                +"|"+parsed.bankTime+"|"+postedAt+"|"+groupKey;
            if(CompanionQueue.enqueue(this,stable,parsed,pkg)){
                CompanionDiagnostics.record(this,"queued","อ่านข้อมูลครบและส่งเข้าคิวแล้ว");
            } else {
                CompanionDiagnostics.record(this,"sendError","ไม่สามารถบันทึกข้อมูลลงคิวส่งได้");
            }
            return;
        }
        // Do not interpret an old/background LINE notification as a fresh QR
        // transaction. Notification post time is advisory, not bank proof.
        long age=System.currentTimeMillis()-postedAt;
        if(!ambiguousObservedOnly && observedOnly!=null && age>=0 && age<=60000L){
            String stable=observedOnly.source+"|"+observedOnly.amount+"|"+
                observedOnly.receiverSuffix+"|observed_only|"+(postedAt/60000L);
            if(CompanionQueue.enqueue(this,stable,observedOnly,pkg)){
                CompanionDiagnostics.record(this,"queued","เข้าคิว Notification ไม่มีเวลาธนาคาร (รอตรวจสอบ)");
            }else CompanionDiagnostics.record(this,"sendError","เข้าคิวข้อมูลบางส่วนไม่สำเร็จ");
            return;
        }
        CompanionDiagnostics.record(this,"incomplete",
            "ข้อมูลจากแหล่งที่เลือกยังไม่ครบหรือไม่ตรงรูปแบบ รองรับเฉพาะเงินเข้า");
    }
    @Override public void onListenerConnected(){
        CompanionDiagnostics.record(this,"listenerConnected",
            "Android เปิดการเชื่อมต่อ Notification Listener แล้ว");
        super.onListenerConnected();
    }
    @Override public void onDestroy(){
        recoveryHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
    @Override public void onListenerDisconnected(){
        CompanionDiagnostics.record(this,"listenerDisconnected",
            "Android ตัดการเชื่อมต่อ Notification Listener ชั่วคราว");
        recoveryHandler.removeCallbacksAndMessages(null);
        CompanionGroupBuffer.clear();
        super.onListenerDisconnected();
    }
}
