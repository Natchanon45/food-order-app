package com.lukkaja.companion;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Privacy-minimal local counters: no notification contents, amounts, bank
 * accounts, usernames, tokens or QR payloads are written or transmitted. */
final class CompanionDiagnostics {
    private static final String PREF = "lukkaja_companion_diagnostics_v1";
    private static final String[] KEYS = {
         "listenerConnected", "listenerDisconnected",
        "selectedSource", "otherBankSource", "lineSenderUnmatched", "groupSummarySkipped",
        "incomplete", "queued", "sent", "sendError"
    };
    private CompanionDiagnostics() {}
    private static SharedPreferences pref(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
    static synchronized void record(Context c, String type, String status) {
        SharedPreferences p=pref(c);
        boolean allowed=false;
        for(String key:KEYS)if(key.equals(type)){allowed=true;break;}
        if(!allowed)return;
        int old=p.getInt(type,0);
        p.edit().putInt(type,Math.min(99999,old+1))
                .putString("lastStatus", status)
                .putLong("lastAt", System.currentTimeMillis()).apply();
    }
    static synchronized boolean clear(Context c) {
        return pref(c).edit().clear().commit();
    }

    static synchronized String summary(Context c) {
        SharedPreferences p=pref(c);
        String when="ยังไม่มี";
        long last=p.getLong("lastAt",0);
        if(last>0){
            SimpleDateFormat fmt=new SimpleDateFormat("dd/MM/yyyy HH:mm:ss",Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("Asia/Bangkok"));
            when=fmt.format(new Date(last));
        }
        return "Notification Listener เชื่อมต่อ: "+p.getInt("listenerConnected",0)+
          "  •  หลุดการเชื่อมต่อ: "+p.getInt("listenerDisconnected",0)+"\n"+
          "พบแจ้งเตือนจากแหล่งที่เลือก: "+p.getInt("selectedSource",0)+
          "  •  แอปธนาคารอื่นที่ไม่ได้เลือก: "+p.getInt("otherBankSource",0)+"\n"+
          "LINE ชื่อผู้ส่งไม่ตรง: "+p.getInt("lineSenderUnmatched",0)+
          "  •  ข้ามกลุ่มรวม LINE: "+p.getInt("groupSummarySkipped",0)+"\n"+
          "ข้อมูลไม่ครบ/อ่านไม่ตรงรูปแบบ: "+p.getInt("incomplete",0)+
          "  •  เข้าคิวส่ง: "+p.getInt("queued",0)+"\n"+
          "Webhook รับแล้ว: "+p.getInt("sent",0)+
          "  •  ส่งไม่สำเร็จ: "+p.getInt("sendError",0)+"\n"+
          "ล่าสุด: "+p.getString("lastStatus","ยังไม่มี Notification เงินเข้า")+
          " · "+when;
    }
}
