package com.lukkaja.companion;
import org.junit.Test;
import static org.junit.Assert.*;

public final class CompanionPairingQRTest {
  private static final String TOKEN="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  @Test public void authenticQrRecognized() {
    CompanionPairingQR.Pairing qr=CompanionPairingQR.parse(
      CompanionPairingQR.format("https://penguin-food.web.app",TOKEN));
    assertNotNull(qr);
    assertEquals("https://penguin-food.web.app",qr.server);
    assertEquals(TOKEN,qr.token);
  }
  @Test public void maliciousQrIsRejected() {
    assertNull(CompanionPairingQR.parse("https://evil.example/?token="+TOKEN));
    assertNull(CompanionPairingQR.parse(CompanionPairingQR.format("https://penguin-food.web.app.evil.example",TOKEN)));
    assertNull(CompanionPairingQR.parse(CompanionPairingQR.format("http://evil.example",TOKEN)));
    assertNull(CompanionPairingQR.parse(CompanionPairingQR.format("https://penguin-food.web.app","short")));
    String good=CompanionPairingQR.format("https://penguin-food.web.app",TOKEN);
    assertNull(CompanionPairingQR.parse(good+"&token="+TOKEN));
    assertNull(CompanionPairingQR.parse(good+"#fragment"));
  }
}
