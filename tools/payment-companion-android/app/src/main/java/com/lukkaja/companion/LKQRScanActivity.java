package com.lukkaja.companion;

import android.os.Build;
import android.graphics.Insets;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import com.journeyapps.barcodescanner.CaptureActivity;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;

/** Portrait QR scanner with the LK Shop-style square guide and native ZXing result handling. */
public final class LKQRScanActivity extends CaptureActivity {
    @Override protected DecoratedBarcodeView initializeContent() {
        setContentView(R.layout.lk_qr_capture);
        // Target 35+ draws edge-to-edge: reserve status and gesture-nav insets
        // so the toolbar never overlaps the clock and the hint stays visible.
        if (Build.VERSION.SDK_INT >= 30) {
            final FrameLayout root = findViewById(R.id.lk_qr_root);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                final Insets bars = insets.getInsets(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                view.setPadding(0, bars.top, 0, bars.bottom);
                return WindowInsets.CONSUMED;
            });
            root.requestApplyInsets();
        }
        ((android.widget.TextView)findViewById(R.id.lk_qr_version_footer))
            .setText(CompanionVersionFooter.label());
        final DecoratedBarcodeView scanner = findViewById(R.id.zxing_barcode_scanner);
        // The default ZXing viewfinder adds a barcode laser and a horizontal
        // framing rectangle. Keep its decoding engine, replace only the UI.
        scanner.getViewFinder().setVisibility(View.GONE);
        scanner.getStatusView().setVisibility(View.GONE);
        findViewById(R.id.lk_qr_back).setOnClickListener(view -> finish());
        return scanner;
    }
}
