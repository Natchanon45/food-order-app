package com.lukkaja.companion;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Private bounded queue; raw text is encrypted via Android Keystore, never stored in cleartext. */
final class CompanionQueue {
    private static final String PREF = "lukkaja_companion_events_v1";
    private static final String KEY = "pending";
    private static final int MAX_EVENTS = 100;
    static final int JOB_ID = 62014;
    private CompanionQueue() {}
    static synchronized int count(Context context) {
        return read(context).length();
    }
    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
    private static JSONArray read(Context context) {
        try { return new JSONArray(prefs(context).getString(KEY, "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
    static synchronized JSONObject first(Context context) {
        JSONArray events = read(context);
        JSONObject first=events.optJSONObject(0);
        if(first!=null&&first.has("encryptedRaw")) {
            try{return RawEventCrypto.decrypt(first);}
            catch(Exception e){return new JSONObject();} // Invalid ciphertext -> HTTP 422; remove poison item.
        }
        return first;
    }
    static synchronized void removeFirst(Context context) {
        JSONArray events = read(context), remaining = new JSONArray();
        for (int i = 1; i < events.length(); i++) remaining.put(events.opt(i));
        prefs(context).edit().putString(KEY, remaining.toString()).commit();
    }
    static synchronized void clear(Context context) {
        prefs(context).edit().remove(KEY).remove(HISTORY).commit();
    }
    static synchronized boolean factoryReset(Context context) {
        return prefs(context).edit().clear().commit();
    }
    private static final String HISTORY="recentFingerprints";
    private static final long DUPLICATE_WINDOW_MS=8500;
    private static final int MAX_RECENT=64;
    private static synchronized boolean alreadySeen(Context context,String fingerprint,long observedMillis,boolean record) {
        try {
            JSONArray recent=new JSONArray(prefs(context).getString(HISTORY,"[]"));
            JSONArray kept=new JSONArray();
            boolean duplicate=false;
            for(int i=0;i<recent.length();i++){
                JSONObject prev=recent.optJSONObject(i);
                if(prev==null)continue;
                long at=prev.optLong("observedAt",0);
                if(Math.abs(observedMillis-at)>60000)continue;
                if(fingerprint.equals(prev.optString("fingerprint")) &&
                    Math.abs(observedMillis-at)<DUPLICATE_WINDOW_MS)duplicate=true;
                if(kept.length()<MAX_RECENT-1)kept.put(prev);
            }
            if(!duplicate && record){
                JSONObject entry=new JSONObject();
                entry.put("fingerprint",fingerprint);
                entry.put("observedAt",observedMillis);
                kept.put(entry);
            }
            // The history contains only SHA-256 hashes and times.
            return duplicate || (record && !prefs(context).edit().putString(HISTORY,kept.toString()).commit());
        }catch(Exception ignored){return true;}
    }
    static long observedMillisMinute(String iso) {
        return java.time.Instant.parse(iso.replace("+00:00","Z")).toEpochMilli()/60000L;
    }
    static synchronized boolean enqueue(Context context, String stableIdentity, CompanionParser.Parsed parsed) {
        return enqueue(context,stableIdentity,parsed,"");
    }
    static synchronized boolean enqueue(Context context, String stableIdentity, CompanionParser.Parsed parsed,String pkg) {
        SecureSettings settings = new SecureSettings(context);
        if (!settings.enabled() || settings.token().isEmpty() || !CompanionClient.validServer(settings.server())) return false;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(stableIdentity.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte b : bytes) hex.append(String.format(java.util.Locale.US, "%02x", b & 255));
            String eventId = hex.toString();
            JSONArray current = read(context);
            MessageDigest fingerprintDigest=MessageDigest.getInstance("SHA-256");
            String canonical=parsed.source+"|"+parsed.amount+"|"+parsed.receiverSuffix+"|"+parsed.bankTime;
            if(parsed.bankTime.isEmpty()){
                // The same truncated LINE message may be re-posted with a
                // different Android key. Keep dedupe local to one minute,
                // rather than dropping future valid transfers of equal amount.
                canonical+="|observed_only|"+(observedMillisMinute(parsed.observedAt));
            }
            byte[] proof=fingerprintDigest.digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder fp=new StringBuilder(64);
            for(byte b:proof)fp.append(String.format(java.util.Locale.US,"%02x",b&255));
            long observedMillis=java.time.Instant.parse(parsed.observedAt.replace("+00:00","Z")).toEpochMilli();
            // Persisted dedupe history also catches a re-post after its
            // original event has already left the pending upload queue.
            if(alreadySeen(context,fp.toString(),observedMillis,false))return true;
            // Do not evict unacknowledged financial observations silently.
            if (current.length() >= MAX_EVENTS) return false;
            for (int i = 0; i < current.length(); i++) {
                JSONObject existing = current.optJSONObject(i);
                if (existing != null && eventId.equals(existing.optString("eventId"))) return true;
            }
            JSONObject event = new JSONObject();
            event.put("eventId", eventId);
            event.put("source", parsed.source);
            // The server-side Platform collection flow must distinguish a
            // notification observed from the actual LINE Android package
            // from a user-selected source label alone.
            if(parsed.source.startsWith("line_")){
                if(!"jp.naver.line.android".equals(pkg))return false;
                event.put("appPackage",pkg);
            }else if("bank_other_installed".equals(parsed.source)){
                event.put("appPackage",pkg);
            }
            event.put("amount", parsed.amount);
            event.put("receiverSuffix", parsed.receiverSuffix);
            if(parsed.bankTime.isEmpty())event.put("timeBasis","device_observed_only");
            else event.put("bankDisplayTime", parsed.bankTime);
            event.put("deviceObservedAt", parsed.observedAt);
            current.put(event);
            if (!prefs(context).edit().putString(KEY, current.toString()).commit()) return false;
            // Mark as deduplicated only after the queued observation is safely
            // committed. A full queue/storage failure must remain retryable.
            alreadySeen(context,fp.toString(),observedMillis,true);
            schedule(context);
            return true;
        } catch (Exception ignored) { return false; }
    }
    static synchronized boolean enqueueRaw(Context context,String stableIdentity,String source,
                                           String pkg,String title,String raw,long postedAt) {
        SecureSettings settings=new SecureSettings(context);
        if(!settings.enabled()||settings.token().isEmpty()||
           !CompanionClient.validServer(settings.server())||raw==null||raw.length()>4000)return false;
        try {
            MessageDigest dig=MessageDigest.getInstance("SHA-256");
            byte[] id=dig.digest(stableIdentity.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex=new StringBuilder(64);
            for(byte b:id)hex.append(String.format(java.util.Locale.US,"%02x",b&255));
            String eventId=hex.toString();
            // Android/LINE sometimes posts the same notification more than
            // once with a different key or postTime. The eventId still
            // records its original identity; dedupe the *content* briefly.
            // Distinct amounts, accounts or transaction times remain distinct.
            String content=CompanionParser.rawDeduplicationText(source,pkg,title,raw);
            byte[] digest=dig.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder fingerprint=new StringBuilder(64);
            for(byte b:digest)fingerprint.append(String.format(java.util.Locale.US,"%02x",b&255));
            if(alreadySeen(context,fingerprint.toString(),postedAt,false))return true;
            JSONArray current=read(context);
            if(current.length()>=MAX_EVENTS)return false;
            for(int i=0;i<current.length();i++){
                JSONObject entry=current.optJSONObject(i);
                if(entry!=null&&eventId.equals(entry.optString("eventId")))return true;
            }
            JSONObject rawEvent=new JSONObject()
                .put("kind","raw_notification")
                .put("eventId",eventId)
                .put("source",source)
                .put("appPackage",pkg)
                .put("notificationTitle",title)
                .put("notificationText",raw)
                .put("deviceObservedAt",CompanionParser.iso(new java.util.Date(postedAt),"UTC"));
            current.put(RawEventCrypto.encrypt(rawEvent));
            if(!prefs(context).edit().putString(KEY,current.toString()).commit())return false;
            alreadySeen(context,fingerprint.toString(),postedAt,true);
            schedule(context);
            return true;
        }catch(Exception ignored){return false;}
    }
    static void schedule(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler == null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(context, PendingUploadJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setBackoffCriteria(30000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .setPersisted(false)
                .build();
        scheduler.schedule(job);
    }
    static void cancel(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler != null) scheduler.cancel(JOB_ID);
    }
}
