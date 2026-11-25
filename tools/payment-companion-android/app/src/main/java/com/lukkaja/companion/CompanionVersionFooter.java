package com.lukkaja.companion;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.widget.TextView;

/** One non-scrolling version footer shared by MainActivity and the QR scanner. */
final class CompanionVersionFooter {
    private CompanionVersionFooter() {}

    static String label() {
        return "LK Connect  •  Version " + BuildConfig.VERSION_NAME
            + "  •  Build " + BuildConfig.VERSION_CODE;
    }

    static TextView make(Context context) {
        TextView footer = new TextView(context);
        footer.setText(label());
        footer.setFontFeatureSettings("kern");
        footer.setTypeface(context.getResources().getFont(R.font.kanit), Typeface.NORMAL);
        footer.setGravity(Gravity.CENTER);
        footer.setTextColor(Color.rgb(83, 116, 101));
        footer.setTextSize(11);
        footer.setMaxLines(1);
        footer.setSingleLine(true);
        footer.setEllipsize(android.text.TextUtils.TruncateAt.END);
        footer.setPadding(12, 0, 12, 0);
        footer.setBackgroundColor(0xFFF4F8F5);
        return footer;
    }
}
