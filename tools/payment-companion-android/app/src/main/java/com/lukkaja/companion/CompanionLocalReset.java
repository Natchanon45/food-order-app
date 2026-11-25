package com.lukkaja.companion;

import android.content.Context;

/** Locally removes device credentials/data without misrepresenting server revocation. */
final class CompanionLocalReset {
    private CompanionLocalReset() {}

    static boolean reset(Context context, SecureSettings settings) {
        // Disable notification capture before cancelling uploads or wiping the queue.
        settings.setEnabled(false);
        CompanionQueue.cancel(context);
        boolean queueCleared = CompanionQueue.factoryReset(context);
        boolean diagnosticsCleared = CompanionDiagnostics.clear(context);
        boolean rawKeyDeleted = RawEventCrypto.eraseKey();
        boolean configCleared = settings.factoryReset();
        return queueCleared && diagnosticsCleared && rawKeyDeleted && configCleared;
    }
}
