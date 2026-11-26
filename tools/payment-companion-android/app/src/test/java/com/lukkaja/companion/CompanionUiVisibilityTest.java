package com.lukkaja.companion;

import org.junit.Test;
import static org.junit.Assert.*;

/** Source-parity checks for local presentation only. */
public class CompanionUiVisibilityTest {
    @Test public void pairingEditorAndSummaryAreComplementary() {
        for (boolean paired : new boolean[]{false, true}) {
            for (boolean editing : new boolean[]{false, true}) {
                assertEquals(!paired || editing, CompanionUiVisibility.pairingForm(paired, editing));
                assertEquals(paired && !editing, CompanionUiVisibility.pairingSummary(paired, editing));
            }
        }
    }

    @Test public void configuredSourceEditorAndSummaryAreComplementaryAfterPairing() {
        for (boolean paired : new boolean[]{false, true}) {
            for (boolean configured : new boolean[]{false, true}) {
                for (boolean editing : new boolean[]{false, true}) {
                    assertEquals(paired && (!configured || editing), CompanionUiVisibility.sourceEditor(paired, configured, editing));
                    assertEquals(paired && configured && !editing, CompanionUiVisibility.sourceSummary(paired, configured, editing));
                }
            }
        }
    }
}
