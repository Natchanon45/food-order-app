package com.lukkaja.companion;

/** Revoke must succeed or the token must already be invalid before we claim server unpair. */
final class CompanionUnpairPolicy {
    private CompanionUnpairPolicy() {}

    static boolean serverCredentialInvalidated(int httpStatus) {
        return httpStatus == 200 || httpStatus == 401;
    }

    static boolean missingServerRoute(int httpStatus) {
        return httpStatus == 404;
    }
}
