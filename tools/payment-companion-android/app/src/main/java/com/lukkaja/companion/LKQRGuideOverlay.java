package com.lukkaja.companion;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

/** Camera-only QR framing overlay. Camera decoding is still handled by ZXing. */
public final class LKQRGuideOverlay extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF frame = new RectF();

    public LKQRGuideOverlay(Context context, AttributeSet attrs) {
        super(context, attrs);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        setClickable(false);
    }

    private float dp(float value) {
        return getResources().getDisplayMetrics().density * value;
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        final float width = getWidth(), height = getHeight();
        final float side = Math.min(dp(260), Math.min(width - dp(56), height * .49f));
        final float left = (width - side) / 2f;
        final float top = (height - side) / 2f;
        frame.set(left, top, left + side, top + side);

        // Keep the QR target unobscured while dimming the camera outside it.
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(0x44000000);
        canvas.drawRect(0, 0, width, top, paint);
        canvas.drawRect(0, top, left, top + side, paint);
        canvas.drawRect(left + side, top, width, top + side, paint);
        canvas.drawRect(0, top + side, width, height, paint);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(3));
        paint.setColor(0xE6FFFFFF);
        canvas.drawRoundRect(frame, dp(18), dp(18), paint);
        paint.setStyle(Paint.Style.FILL);
    }
}
