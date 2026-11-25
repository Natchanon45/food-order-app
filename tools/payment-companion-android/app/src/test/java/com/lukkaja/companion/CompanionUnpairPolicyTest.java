package com.lukkaja.companion;

import org.junit.Test;
import static org.junit.Assert.*;

public class CompanionUnpairPolicyTest {
    @Test public void onlyServerRevocationOrAnAlreadyInvalidCredentialAllowsAutomaticLocalErasure() {
        assertTrue(CompanionUnpairPolicy.serverCredentialInvalidated(200));
        assertTrue(CompanionUnpairPolicy.serverCredentialInvalidated(401));
        for (int status: new int[]{0, 403, 404, 408, 409, 429, 500, 503})
            assertFalse("must not auto-clear on HTTP "+status,
                CompanionUnpairPolicy.serverCredentialInvalidated(status));
    }

    @Test public void missingRouteIsReportedSeparatelyFromNetworkFailure() {
        assertTrue(CompanionUnpairPolicy.missingServerRoute(404));
        assertFalse(CompanionUnpairPolicy.missingServerRoute(0));
        assertFalse(CompanionUnpairPolicy.missingServerRoute(503));
    }

    @Test public void appFooterAlwaysShowsActualPackageVersion() {
        assertTrue(CompanionVersionFooter.label().contains(BuildConfig.VERSION_NAME));
        assertTrue(CompanionVersionFooter.label().contains(String.valueOf(BuildConfig.VERSION_CODE)));
    }
}
