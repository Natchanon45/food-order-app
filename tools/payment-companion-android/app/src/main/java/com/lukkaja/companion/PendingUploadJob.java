package com.lukkaja.companion;

import android.app.job.JobParameters;
import android.app.job.JobService;
import org.json.JSONObject;

/** Bounded upload; retry transient errors without ever changing server-side payment status. */
public final class PendingUploadJob extends JobService {
    private volatile boolean cancelled;
    private Thread worker;
    @Override public boolean onStartJob(JobParameters params) {
        cancelled = false;
        worker = new Thread(() -> {
            boolean retry = false;
            try {
                SecureSettings settings = new SecureSettings(this);
                if (!settings.enabled() || settings.token().isEmpty()) {
                    CompanionQueue.clear(this);
                } else {
                    for (int i = 0; i < 20 && !cancelled; i++) {
                        JSONObject event = CompanionQueue.first(this);
                        if (event == null) break;
                        int code = CompanionClient.sendWebhook(settings.server(), settings.webhook(), settings.token(), event);
                        if (code == 200) {
                            // Both stored and idempotent duplicate response are acknowledged.
                            CompanionQueue.removeFirst(this);
                            CompanionDiagnostics.record(this,"sent","Webhook รับข้อมูลแล้ว (HTTP 200)");
                        } else if (code == 401 || code == 403) {
                            CompanionDiagnostics.record(this,"sendError","คีย์ถูกเพิกถอน (HTTP "+code+")");
                            // Token revoked: stop; do not resend private events to another tenant.
                            settings.disconnect();
                            CompanionQueue.cancel(this);
                            CompanionQueue.clear(this);
                            break;
                        } else if (code >= 400 && code < 500 && code != 408 && code != 429) {
                            // Invalid data: never repeatedly hammer the backend with bad payload.
                            CompanionDiagnostics.record(this,"sendError",
                                "Webhook ปฏิเสธรูปแบบข้อมูล (HTTP "+code+")");
                            CompanionQueue.removeFirst(this);
                        } else {
                            CompanionDiagnostics.record(this,"sendError",
                                "Webhook ติดต่อไม่ได้หรือยังไม่พร้อม (HTTP "+code+")");
                            retry = true; break;
                        }
                    }
                    if (!cancelled && CompanionQueue.count(this) > 0) retry = true;
                }
            } catch (Exception ignored) {
                CompanionDiagnostics.record(this,"sendError","เชื่อมต่อ Webhook ไม่สำเร็จ (เครือข่าย)");
                retry = true;
            }
            jobFinished(params, retry && !cancelled);
        }, "lukkaja-companion-uploader");
        worker.start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) {
        cancelled = true;
        if (worker != null) worker.interrupt();
        return new SecureSettings(this).enabled() && CompanionQueue.count(this) > 0;
    }
}
