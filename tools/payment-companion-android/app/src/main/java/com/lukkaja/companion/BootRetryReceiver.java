package com.lukkaja.companion;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Reschedule previously accepted, bounded observations after device reboot. */
public final class BootRetryReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        SecureSettings settings = new SecureSettings(context);
        if (settings.enabled() && !settings.token().isEmpty() && CompanionQueue.count(context) > 0) {
            CompanionQueue.schedule(context);
        }
    }
}
