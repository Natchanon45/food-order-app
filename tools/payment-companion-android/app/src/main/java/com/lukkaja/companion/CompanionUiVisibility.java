package com.lukkaja.companion;

// Pure presentation rules. No token, source, notification queue or Android
// permission state is modified when a form is collapsed or expanded.
final class CompanionUiVisibility {
    private CompanionUiVisibility() {}
    static boolean pairingForm(boolean paired,boolean editing) {
        return !paired||editing;
    }
    static boolean pairingSummary(boolean paired,boolean editing) {
        return paired&&!editing;
    }
    static boolean sourceEditor(boolean paired,boolean configured,boolean editing) {
        return paired&&(!configured||editing);
    }
    static boolean sourceSummary(boolean paired,boolean configured,boolean editing) {
        return paired&&configured&&!editing;
    }
    static boolean notificationPermissionButton(boolean accessGranted) {
        return !accessGranted;
    }
    static boolean receiveToggleAvailable(boolean paired,boolean configured,
                                          boolean accessGranted,boolean enabled) {
        // The OFF action must remain possible even if Android access was
        // revoked or unbound while the owner was opted in.
        return paired&&configured&&(accessGranted||enabled);
    }
    static boolean retryButton(boolean paired,boolean enabled,int queued) {
        return paired&&enabled&&queued>0;
    }
    static boolean customBankPicker(boolean lineMode,boolean defaultInstalled,
                                     boolean hasCustom,boolean defaultKnown) {
        return !lineMode&&(!defaultKnown||!defaultInstalled||hasCustom);
    }
}
