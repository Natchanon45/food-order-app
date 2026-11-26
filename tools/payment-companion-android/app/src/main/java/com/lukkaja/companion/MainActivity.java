package com.lukkaja.companion;

import android.app.Activity;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import android.app.AlertDialog;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import android.content.Intent;
import android.content.ComponentName;
import android.os.Bundle;
import android.provider.Settings;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;
import android.content.res.ColorStateList;
import android.graphics.Insets;
import android.os.Build;
import android.view.WindowInsets;
import android.widget.ImageView;
import android.widget.ImageButton;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.RadioGroup;
import android.widget.RadioButton;
import android.text.TextWatcher;
import android.text.Editable;
import android.widget.AdapterView;
import android.widget.TextView;
import android.widget.FrameLayout;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Owner-controlled opt-in pilot: no payment authorization exists in this application. */
public final class MainActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private SecureSettings settings;
    private FrameLayout screenRoot;
    private LinearLayout feedbackToast;
    private ImageView feedbackIcon;
    private TextView feedbackMessage;
    private final Runnable hideFeedbackToast = () -> {
        if(feedbackToast!=null) {
            feedbackToast.animate().cancel();
            feedbackToast.animate().alpha(0f).setDuration(180).withEndAction(() ->
                feedbackToast.setVisibility(View.GONE)).start();
        }
    };
    private EditText serverInput, webhookInput, tokenInput;
    private Spinner bankSpinner;
    private RadioGroup sourceGroup;
    private String displayedBankMode;
    private String pendingCustomBankPackage = "";
    private String pendingCustomBankCode = "";
    private int lineSourceId, bankSourceId;
    private CheckBox enableCheckbox;
    private TextView statusLabel, queueLabel, diagnosticsLabel, accessLabel, sourceHintLabel, healthLabel;
    private TextView pairingInfo, selectedSourceInfo, bankPickerLabel;
    private LinearLayout pairingForm, pairingSummary, advancedSection;
    private LinearLayout sourceCard, sourceEditor, sourceSummary, sourceBankPicker, diagnosticsBody;
    private LinearLayout consentCard, diagnosticsCard;
    private Button changePairingButton, editSourceButton, chooseInstalledBankApp;
    private Button sourceSaveButton, openAccessButton, retryButton, disconnectButton;
    private Button cancelPairingEditButton, cancelSourceEditButton, factoryResetButton;
    private Button advancedToggleButton, diagnosticsToggleButton;
    private boolean pairingEditing, sourceEditing, advancedOpen, diagnosticsOpen;
    private boolean restoringSavedCheckbox;
    private Button saveButton, testButton;
    private final int GREEN = Color.rgb(13,112,62);
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        settings = new SecureSettings(this);
        pendingCustomBankPackage = settings.customBankPackage();
        pendingCustomBankCode = settings.bank();
        buildScreen();
        refresh();
    }
    private GradientDrawable background(int color, int stroke) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);shape.setCornerRadius(dp(14));
        if (stroke != 0) shape.setStroke(dp(1), stroke);
        return shape;
    }
    private int dp(int n) { return Math.round(getResources().getDisplayMetrics().density*n); }
    private TextView text(String value,int size,int color,boolean bold) {
        TextView result = new TextView(this);
        result.setText(value);result.setTextSize(size);result.setTextColor(color);
        result.setTypeface(getResources().getFont(R.font.kanit),bold?Typeface.BOLD:Typeface.NORMAL);
        result.setLineSpacing(dp(3),1f);
        return result;
    }
    private void add(LinearLayout layout,View view,int marginBottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1,-2);
        params.bottomMargin=dp(marginBottom);layout.addView(view,params);
    }
    private LinearLayout card(LinearLayout outer) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(dp(15),dp(15),dp(15),dp(15));
        layout.setBackground(background(Color.WHITE,Color.rgb(222,235,226)));
        add(outer,layout,14);
        return layout;
    }
    private void styleButton(Button button, int fill, int stroke, int ink) {
        int[] disabled = new int[]{-android.R.attr.state_enabled};
        StateListDrawable states = new StateListDrawable();
        states.addState(disabled,background(0xFFE7ECE9,0xFFB7C4BD));
        states.addState(new int[]{},background(fill,stroke));
        button.setBackgroundTintList(null);
        button.setBackground(new RippleDrawable(
            ColorStateList.valueOf(0x240B5935),states,background(Color.WHITE,0)));
        button.setTextColor(new ColorStateList(new int[][]{disabled,new int[]{}},
            new int[]{0xFF65736B,ink}));
        button.setStateListAnimator(null);
        button.setElevation(0);
        button.setMinHeight(dp(50));
        button.setMinimumHeight(dp(50));
        button.setPadding(dp(12),dp(10),dp(12),dp(10));
        button.setGravity(Gravity.CENTER);
    }
    private Button button(String title,boolean primary) {
        Button button=new Button(this);
        button.setAllCaps(false);button.setText(title);button.setTextSize(15);
        button.setTypeface(getResources().getFont(R.font.kanit),Typeface.BOLD);
        styleButton(button,primary?0xFF0A7543:Color.WHITE,
            primary?0xFF075530:0xFF579576,primary?Color.WHITE:0xFF125A36);
        return button;
    }
    // Fixed top bar; the setup content scrolls independently beneath it.
    private View topBar() {
        LinearLayout bar=new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(16),dp(10),dp(12),dp(10));
        bar.setBackgroundColor(0xFF103F2D);
        bar.setMinimumHeight(dp(72));
        ImageView logo=new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        bar.addView(logo,new LinearLayout.LayoutParams(dp(44),dp(44)));
        LinearLayout names=new LinearLayout(this);
        names.setOrientation(LinearLayout.VERTICAL);
        names.setPadding(dp(10),0,dp(8),0);
        TextView title=text(getString(R.string.app_name),22,Color.WHITE,true);
        if(Build.VERSION.SDK_INT>=28) title.setAccessibilityHeading(true);
        names.addView(title);
        names.addView(text("Payment Companion",12,0xFFBCE7CE,false));
        bar.addView(names,new LinearLayout.LayoutParams(0,-2,1f));
        ImageButton refreshButton=new ImageButton(this);
        refreshButton.setImageResource(R.drawable.lk_refresh);
        refreshButton.setContentDescription("รีเฟรชสถานะบนเครื่อง");
        refreshButton.setPadding(dp(12),dp(12),dp(12),dp(12));
        refreshButton.setBackground(new RippleDrawable(ColorStateList.valueOf(0x44FFFFFF),
            background(0xFF245A43,0xFF77AC92),null));
        refreshButton.setOnClickListener(v->{updateQueueLabel();showSuccess("อัปเดตสถานะการรับแจ้งเตือนแล้ว");});
        bar.addView(refreshButton,new LinearLayout.LayoutParams(dp(48),dp(48)));
        return bar;
    }
    private void visible(View view,boolean enabled) {
        if(view!=null)view.setVisibility(enabled?View.VISIBLE:View.GONE);
    }
    private String selectedSourceTitle(String mode,String bank) {
        String[] codes=CompanionParser.codesFor(mode);
        String[] names=CompanionParser.labelsFor(mode);
        for(int i=0;i<codes.length;i++) {
            if(codes[i].equals(bank))return names[i];
        }
        return bank;
    }
    private void showFeedback(boolean success,String message) {
        if(statusLabel!=null) {
            statusLabel.setText((success?"✓  ":"!  ")+message);
            statusLabel.setTextColor(success?Color.rgb(14,102,58):Color.rgb(154,47,42));
            statusLabel.setBackground(background(
                success?Color.rgb(230,248,236):Color.rgb(255,240,238),
                success?Color.rgb(162,221,178):Color.rgb(242,182,178)));
            visible(statusLabel,true);
        }
        showWebToast(success,message);
    }
    // Same presentation policy as the web: dark surface, green check/red
    // cross, white readable text, centered in the lower half of the window.
    private void installFeedbackToast(FrameLayout root) {
        feedbackToast=new LinearLayout(this);
        feedbackToast.setOrientation(LinearLayout.HORIZONTAL);
        feedbackToast.setGravity(Gravity.CENTER);
        feedbackToast.setPadding(dp(16),dp(14),dp(16),dp(14));
        feedbackToast.setBackground(background(0xFF111111,0));
        feedbackToast.setElevation(dp(14));
        feedbackToast.setClickable(false);
        feedbackToast.setFocusable(false);
        feedbackToast.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        feedbackIcon=new ImageView(this);
        LinearLayout.LayoutParams iconParams=new LinearLayout.LayoutParams(dp(24),dp(24));
        iconParams.rightMargin=dp(10);
        feedbackToast.addView(feedbackIcon,iconParams);
        feedbackMessage=text("",15,Color.WHITE,false);
        feedbackMessage.setGravity(Gravity.CENTER);
        feedbackToast.addView(feedbackMessage,new LinearLayout.LayoutParams(0,-2,1f));
        FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(-1,-2,Gravity.CENTER);
        params.leftMargin=dp(12);
        params.rightMargin=dp(12);
        root.addView(feedbackToast,params);
        feedbackToast.setVisibility(View.GONE);
        root.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->positionFeedbackToast());
        feedbackToast.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->positionFeedbackToast());
    }
    private void positionFeedbackToast() {
        if(screenRoot==null||feedbackToast==null)return;
        int width=screenRoot.getWidth()-screenRoot.getPaddingLeft()-screenRoot.getPaddingRight();
        int height=screenRoot.getHeight()-screenRoot.getPaddingTop()-screenRoot.getPaddingBottom();
        if(width<=0||height<=0)return;
        FrameLayout.LayoutParams params=(FrameLayout.LayoutParams)feedbackToast.getLayoutParams();
        int toastWidth=Math.min(dp(560),Math.max(1,width-dp(24)));
        if(params.width!=toastWidth){
            params.width=toastWidth;
            feedbackToast.setLayoutParams(params);
        }
        float offset=Math.min(height*.25f,Math.max(0f,(height-feedbackToast.getHeight())*.5f-dp(12)));
        feedbackToast.setTranslationY(offset);
    }
    private void showWebToast(boolean success,String message) {
        if(feedbackToast==null||isFinishing()||isDestroyed())return;
        feedbackToast.removeCallbacks(hideFeedbackToast);
        feedbackToast.animate().cancel();
        feedbackIcon.setImageResource(success?R.drawable.lk_toast_success:R.drawable.lk_toast_error);
        feedbackMessage.setText(message);
        feedbackToast.setAlpha(0f);
        feedbackToast.setVisibility(View.VISIBLE);
        positionFeedbackToast();
        feedbackToast.animate().alpha(1f).setDuration(180).start();
        feedbackToast.postDelayed(hideFeedbackToast, message.length()>80?5000:3500);
        // The persistent statusLabel already announces the same message.
    }
    private void showSuccess(String message) {showFeedback(true,message);}
    private void showError(String message) {showFeedback(false,message);}
    private void updateUiState() {
        if(settings==null||enableCheckbox==null)return;
        boolean paired=!settings.token().isEmpty();
        boolean configured=settings.sourceConfigured();
        visible(pairingForm,CompanionUiVisibility.pairingForm(paired,pairingEditing));
        visible(pairingSummary,CompanionUiVisibility.pairingSummary(paired,pairingEditing));
        visible(changePairingButton,paired&&!pairingEditing);
        visible(cancelPairingEditButton,paired&&pairingEditing);
        if(pairingInfo!=null)pairingInfo.setText("เชื่อมต่อกับ "+settings.server()+
            "\nรหัสอุปกรณ์เก็บอย่างปลอดภัยใน Android Keystore");
        visible(advancedSection,false);
        visible(advancedToggleButton,false);
        if(advancedToggleButton!=null)advancedToggleButton.setText(advancedOpen
                ?"ซ่อนการตั้งค่า Webhook":"ตั้งค่าขั้นสูง • Webhook");
        visible(sourceCard,false);
        visible(sourceEditor,CompanionUiVisibility.sourceEditor(paired,configured,sourceEditing));
        visible(sourceSummary,CompanionUiVisibility.sourceSummary(paired,configured,sourceEditing));
        visible(cancelSourceEditButton,paired&&configured&&sourceEditing);
        if(selectedSourceInfo!=null) selectedSourceInfo.setText(
            ("line".equals(settings.sourceMode())?"LINE":"แอปธนาคาร")+"  •  "+
            selectedSourceTitle(settings.sourceMode(),settings.bank()));
        visible(consentCard,false);
        visible(diagnosticsCard,false);
        boolean access=notificationAccessEnabled();
        visible(openAccessButton,CompanionUiVisibility.notificationPermissionButton(access));
        if(accessLabel!=null)accessLabel.setText(access
            ?"✓ Notification Access เปิดแล้ว":"! ยังไม่ได้รับสิทธิ์ Notification Access");
        // A previously opted-in owner can always turn OFF receiving even
        // when Android temporarily revoked Notification Access.
        enableCheckbox.setEnabled(CompanionUiVisibility.receiveToggleAvailable(paired,configured,access,settings.enabled()));
        if(retryButton!=null)visible(retryButton,CompanionUiVisibility.retryButton(paired,settings.enabled(),CompanionQueue.count(this)));
        if(disconnectButton!=null)visible(disconnectButton,paired);
        visible(diagnosticsBody,diagnosticsOpen);
        if(diagnosticsToggleButton!=null)diagnosticsToggleButton.setText(
            diagnosticsOpen?"ซ่อนรายละเอียดและข้อมูลวิเคราะห์":"ดูข้อมูลวิเคราะห์เมื่อพบปัญหา");
        updateSourceHint();
    }
    private EditText field(String hint) {
        EditText edit=new EditText(this);
        edit.setSingleLine(true);edit.setTextSize(14);edit.setHint(hint);
        edit.setTypeface(getResources().getFont(R.font.kanit),Typeface.NORMAL);
        edit.setPadding(dp(12),dp(12),dp(12),dp(12));
        edit.setBackground(background(Color.rgb(250,253,251),Color.rgb(145,182,157)));
        return edit;
    }
    private void buildScreen() {
        // Explicit system-bar and cutout insets keep the fixed header and
        // last action clear of Android 15+ enforced edge-to-edge areas.
        screenRoot=new FrameLayout(this);
        screenRoot.setBackgroundColor(0xFF103F2D);
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        screenRoot.addView(root,new FrameLayout.LayoutParams(-1,-1));
        if(Build.VERSION.SDK_INT>=30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        screenRoot.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                Insets ime=insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(safe.left,safe.top,safe.right,Math.max(safe.bottom,ime.bottom));
            }else{
                view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.addView(topBar(),new LinearLayout.LayoutParams(-1,-2));
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackgroundColor(0xFFF4F9F6);
        LinearLayout outer=new LinearLayout(this);outer.setOrientation(LinearLayout.VERTICAL);
        outer.setPadding(dp(14),dp(14),dp(14),dp(20));outer.setBackgroundColor(0xFFF4F9F6);
        scroll.addView(outer);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1f));
        // Version/build stays visible outside the scrolling body on every MainActivity state.
        root.addView(CompanionVersionFooter.make(this),
            new LinearLayout.LayoutParams(-1,dp(30)));
        installFeedbackToast(screenRoot);
        setContentView(screenRoot);
        screenRoot.requestApplyInsets();
        LinearLayout intro=card(outer);
        add(intro,text("PG Connect • PENGUIN UAT",17,Color.rgb(24,67,40),true),8);
        add(intro,text("ทดสอบเชื่อมต่อบัญชีส่วนกลางหรือร้านค้าด้วยคีย์หรือ QR · คีย์หมดอายุใน 24 ชั่วโมง",13,Color.rgb(75,108,87),false),8);
        add(intro,text("รุ่นนี้ทดสอบการจับคู่เท่านั้น ไม่อ่าน Notification และไม่รับส่งข้อมูลธนาคาร",12,Color.rgb(154,97,35),false),8);
        healthLabel=text("",13,Color.rgb(144,85,22),true);
        add(intro,healthLabel,0);
        statusLabel=text("",13,GREEN,true);
        statusLabel.setPadding(dp(14),dp(12),dp(14),dp(12));
        statusLabel.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        add(outer,statusLabel,14);
        visible(statusLabel,false);

        LinearLayout pairing=card(outer);
        add(pairing,text("1. เชื่อมต่อบัญชีส่วนกลางหรือร้านค้า",17,Color.rgb(24,67,40),true),9);
        pairingSummary=new LinearLayout(this);
        pairingSummary.setOrientation(LinearLayout.VERTICAL);
        pairingSummary.setPadding(dp(14),dp(12),dp(14),dp(12));
        pairingSummary.setBackground(background(Color.rgb(233,248,238),Color.rgb(176,220,188)));
        pairingInfo=text("",13,Color.rgb(25,94,52),true);
        add(pairingSummary,pairingInfo,10);
        testButton=button("ตรวจสอบการเชื่อมต่อ",true);
        add(pairingSummary,testButton,10);
        testButton.setOnClickListener(v->checkConnection());
        changePairingButton=button("เปลี่ยนรหัสหรือเซิร์ฟเวอร์",false);
        add(pairingSummary,changePairingButton,0);
        changePairingButton.setOnClickListener(v->{
            pairingEditing=true;
            updateUiState();
        });
        add(pairing,pairingSummary,10);

        pairingForm=new LinearLayout(this);
        pairingForm.setOrientation(LinearLayout.VERTICAL);
        Button scanPairingButton=button("สแกน QR จับคู่",true);
        add(pairingForm,scanPairingButton,12);
        scanPairingButton.setOnClickListener(v->{
            IntentIntegrator integrator=new IntentIntegrator(this);
            integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
            integrator.setCaptureActivity(LKQRScanActivity.class);
            integrator.setPrompt("สแกน QR จากหน้า Superadmin หรือจัดการร้าน");
            integrator.setBeepEnabled(false);
            integrator.setOrientationLocked(true);
            integrator.initiateScan();
        });
        add(pairingForm,text("กรอกรหัสที่สร้างจากหน้า Superadmin หรือจัดการร้าน",12,
                Color.rgb(83,107,92),false),13);
        add(pairingForm,text("URL เซิร์ฟเวอร์",12,GREEN,true),6);
        serverInput=field("https://penguin-food.web.app");
        serverInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);
        serverInput.setText(settings.server());serverInput.setEnabled(false);add(pairingForm,serverInput,12);
        add(pairingForm,text("รหัสจับคู่อุปกรณ์ (64 ตัวอักษร)",12,GREEN,true),6);
        tokenInput=field("วางรหัสจากหน้า Pricing");
        tokenInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        add(pairingForm,tokenInput,12);
        saveButton=button("เชื่อมต่อและบันทึกรหัส",true);
        add(pairingForm,saveButton,8);
        saveButton.setOnClickListener(v->savePairing());
        cancelPairingEditButton=button("ยกเลิกการเปลี่ยนการจับคู่",false);
        add(pairingForm,cancelPairingEditButton,0);
        cancelPairingEditButton.setOnClickListener(v->{
            pairingEditing=false;tokenInput.setText("");
            serverInput.setText(settings.server());
            webhookInput.setText(settings.webhook());
            updateUiState();
        });
        add(pairing,pairingForm,10);

        advancedToggleButton=button("ตั้งค่าขั้นสูง • Webhook",false);
        add(pairing,advancedToggleButton,8);
        advancedSection=new LinearLayout(this);
        advancedSection.setOrientation(LinearLayout.VERTICAL);
        advancedSection.setPadding(dp(12),dp(13),dp(12),dp(12));
        advancedSection.setBackground(background(Color.rgb(248,251,249),Color.rgb(225,236,229)));
        advancedToggleButton.setOnClickListener(v->{
            advancedOpen=!advancedOpen;updateUiState();
        });
        add(advancedSection,text("Webhook ปลายทาง (เฉพาะกรณีต้องเปลี่ยน)",12,GREEN,true),6);
        webhookInput=field(CompanionClient.defaultWebhook(settings.server()));
        webhookInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);
        webhookInput.setText(settings.webhook());add(advancedSection,webhookInput,7);
        add(advancedSection,text("Webhook ต้องใช้โดเมนเดียวกับเซิร์ฟเวอร์ เพื่อไม่ส่งรหัสอุปกรณ์ไปที่อื่น",
                11,Color.rgb(96,118,104),false),8);
        Button saveWebhook=button("บันทึก Webhook",true);
        add(advancedSection,saveWebhook,0);
        saveWebhook.setOnClickListener(v->{
            boolean editingPairing=settings.token().isEmpty()||pairingEditing;
            String server=editingPairing?serverInput.getText().toString().trim():settings.server();
            String target=webhookInput.getText().toString().trim();
            if(!CompanionClient.validWebhook(server,target)){
                showError("Webhook ต้องเป็น HTTPS และใช้โดเมนเดียวกับเซิร์ฟเวอร์ที่จับคู่");
                return;
            }
            if(editingPairing) {
                // Never silently reroute a still-active pairing. Save only
                // after its replacement credential passes remote verification.
                showSuccess("Webhook พร้อมบันทึกเมื่อเชื่อมต่อร้านค้าสำเร็จ");
            }else {
                settings.setWebhook(target);
                showSuccess("บันทึก Webhook สำเร็จ");
            }
            advancedOpen=false;updateUiState();
        });
        add(pairing,advancedSection,0);
        serverInput.addTextChangedListener(new TextWatcher() {
            private String previous=settings.server();
            @Override public void beforeTextChanged(CharSequence seq,int start,int count,int after){}
            @Override public void onTextChanged(CharSequence text,int start,int before,int count){
                String current=webhookInput.getText().toString().trim();
                if(current.isEmpty()||current.equals(CompanionClient.defaultWebhook(previous))){
                    webhookInput.setText(CompanionClient.defaultWebhook(text.toString().trim()));
                }
                previous=text.toString().trim();
            }
            @Override public void afterTextChanged(Editable editable){}
        });

        sourceCard=card(outer);
        add(sourceCard,text("2. เลือกแหล่งแจ้งเตือน",17,Color.rgb(24,67,40),true),8);
        sourceSummary=new LinearLayout(this);
        sourceSummary.setOrientation(LinearLayout.VERTICAL);
        sourceSummary.setPadding(dp(14),dp(12),dp(14),dp(12));
        sourceSummary.setBackground(background(Color.rgb(234,248,239),Color.rgb(176,220,188)));
        add(sourceSummary,text("✓ บันทึกแหล่งแจ้งเตือนแล้ว",12,GREEN,true),5);
        selectedSourceInfo=text("",14,Color.rgb(24,67,40),true);
        add(sourceSummary,selectedSourceInfo,10);
        editSourceButton=button("เปลี่ยนแหล่งแจ้งเตือน",false);
        add(sourceSummary,editSourceButton,0);
        editSourceButton.setOnClickListener(v->{
            sourceEditing=true;refreshBankOptions();updateUiState();
        });
        add(sourceCard,sourceSummary,9);

        sourceEditor=new LinearLayout(this);
        sourceEditor.setOrientation(LinearLayout.VERTICAL);
        add(sourceEditor,text("เลือก LINE หรือแอปธนาคารเพียงอย่างเดียว",12,
                Color.rgb(83,107,92),false),8);
        sourceGroup=new RadioGroup(this);
        sourceGroup.setOrientation(RadioGroup.VERTICAL);
        RadioButton line=new RadioButton(this);
        lineSourceId=View.generateViewId();line.setId(lineSourceId);
        line.setText("1. LINE (บริการแจ้งเตือนธนาคาร)");line.setTextSize(14);
        sourceGroup.addView(line);
        RadioButton bank=new RadioButton(this);
        bankSourceId=View.generateViewId();bank.setId(bankSourceId);
        bank.setText("2. แอปธนาคาร");bank.setTextSize(14);
        sourceGroup.addView(bank);
        sourceGroup.check("bank".equals(settings.sourceMode())?bankSourceId:lineSourceId);
        add(sourceEditor,sourceGroup,10);
        sourceHintLabel=text("",12,Color.rgb(154,97,35),false);
        add(sourceEditor,sourceHintLabel,10);
        sourceBankPicker=new LinearLayout(this);
        sourceBankPicker.setOrientation(LinearLayout.VERTICAL);
        bankPickerLabel=text("รายชื่อธนาคาร",12,GREEN,true);
        add(sourceBankPicker,bankPickerLabel,7);
        bankSpinner=new Spinner(this);
        bankSpinner.setContentDescription("ธนาคารหรือ LINE OA ที่เลือกรับ Notification");
        add(sourceBankPicker,bankSpinner,10);
        chooseInstalledBankApp=button("ไม่พบแอปธนาคารที่ต้องการ? เลือกแอปเอง",false);
        add(sourceBankPicker,chooseInstalledBankApp,8);
        chooseInstalledBankApp.setOnClickListener(v->chooseInstalledApp());
        add(sourceEditor,sourceBankPicker,10);
        refreshBankOptions();
        bankSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent,
                    View view,int position,long id) {
                updateSourceHint();
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent){}
        });
        sourceGroup.setOnCheckedChangeListener((group,id)->{
            refreshBankOptions();
            updateSourceHint();
        });
        sourceSaveButton=button("บันทึกแหล่งแจ้งเตือน",true);
        add(sourceEditor,sourceSaveButton,8);
        sourceSaveButton.setOnClickListener(v->saveSourceChoice());
        cancelSourceEditButton=button("ยกเลิกการเปลี่ยน",false);
        add(sourceEditor,cancelSourceEditButton,0);
        cancelSourceEditButton.setOnClickListener(v->{
            sourceEditing=false;
            pendingCustomBankCode=settings.bank();
            pendingCustomBankPackage=settings.customBankPackage();
            displayedBankMode=null; // Force restoring saved bank, not draft.
            sourceGroup.check("bank".equals(settings.sourceMode())?bankSourceId:lineSourceId);
            refreshBankOptions();updateUiState();
        });
        add(sourceCard,sourceEditor,0);
        add(sourceCard,text("ระบบอ่านเฉพาะ Notification ที่คุณเลือก ไม่อ่านแชทส่วนตัวหรือข้อมูลจากแอปอื่น",
                11,Color.rgb(96,118,104),false),0);

        consentCard=card(outer);
        add(consentCard,text("3. เปิดรับแจ้งเตือนเงินเข้า",17,Color.rgb(24,67,40),true),8);
        add(consentCard,text("Android ต้องอนุญาต Notification Access ก่อน จึงจะรับจาก LINE หรือแอปธนาคารที่เลือกได้",
                12,Color.rgb(83,107,92),false),10);
        accessLabel=text("",13,Color.rgb(85,110,91),true);
        add(consentCard,accessLabel,10);
        openAccessButton=button("เปิดหน้าตั้งค่า Notification Access",true);
        add(consentCard,openAccessButton,10);
        openAccessButton.setOnClickListener(v->{
            try{startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));}
            catch(Exception ignored){showError("ไม่สามารถเปิดหน้าตั้งค่า Notification ได้บนอุปกรณ์นี้");}
        });
        enableCheckbox=new CheckBox(this);
        enableCheckbox.setText("เปิดรับและส่งแจ้งเตือนเงินเข้า");
        enableCheckbox.setTextColor(Color.rgb(24,67,40));enableCheckbox.setTextSize(14);
        add(consentCard,enableCheckbox,10);
        enableCheckbox.setOnCheckedChangeListener((button,checked)->{
            if(restoringSavedCheckbox)return;
            if(checked&&!notificationAccessEnabled()){
                enableCheckbox.setChecked(false);
                showError("เปิด Notification Access ให้ PG Connect ในการตั้งค่า Android ก่อน");
                updateUiState();return;
            }
            if(checked&&settings.token().isEmpty()){
                enableCheckbox.setChecked(false);
                showError("กรุณาเชื่อมต่อร้านค้าก่อนเปิดรับแจ้งเตือน");
                updateUiState();return;
            }
            if(checked&&(!settings.sourceConfigured()||
                    !CompanionParser.validSelection(settings.sourceMode(),settings.bank()))){
                enableCheckbox.setChecked(false);
                showError("กรุณาเลือกและบันทึกแหล่งแจ้งเตือนก่อน");
                updateUiState();return;
            }
            settings.setEnabled(checked);
            if(checked) CompanionQueue.schedule(this);
            else CompanionQueue.cancel(this);
            updateQueueLabel();
            showSuccess(checked?"เปิดรับแจ้งเตือนเงินเข้าแล้ว":"หยุดรับและส่งแจ้งเตือนแล้ว");
        });
        queueLabel=text("",12,Color.rgb(80,102,88),false);
        add(consentCard,queueLabel,10);
        retryButton=button("ส่งข้อมูลค้างอีกครั้ง",true);
        add(consentCard,retryButton,10);
        retryButton.setOnClickListener(v->{
            CompanionQueue.schedule(this);updateQueueLabel();
            showSuccess("ส่งคำขอลองส่งรายการที่ค้างแล้ว ตรวจสถานะการส่งอีกครั้ง");
        });
        disconnectButton=button("ยกเลิกการจับคู่บนเซิร์ฟเวอร์",false);
        styleButton(disconnectButton,0xFFFFF3F1,0xFFB9534B,0xFF972C27);
        add(pairing,disconnectButton,0);
        disconnectButton.setOnClickListener(v->{
            new AlertDialog.Builder(this)
                .setTitle("ยกเลิกการจับคู่บนโทรศัพท์?")
                .setMessage("แอปจะยกเลิกสิทธิ์บนเซิร์ฟเวอร์ก่อนล้างรหัสในเครื่อง เพื่อป้องกันการใช้งานต่อโดยไม่ได้รับอนุญาต")
                .setNegativeButton("กลับ",null)
                .setPositiveButton("ยกเลิกการจับคู่", (dialog,which)->revokePairingOnServer()).show();
        });

        LinearLayout resetCard=card(outer);
        add(resetCard,text("รีเซ็ตข้อมูลในเครื่อง",17,Color.rgb(24,67,40),true),6);
        add(resetCard,text("ลบรหัสจับคู่ แหล่งแจ้งเตือน และรายการค้างจากโทรศัพท์นี้ " +
            "โดยไม่ต้องเชื่อมต่อเซิร์ฟเวอร์ สิทธิ์บนเซิร์ฟเวอร์จะยังไม่ถูกเพิกถอน",12,
            Color.rgb(115,82,49),false),10);
        factoryResetButton=button("รีเซ็ต PG Connect ในเครื่อง",false);
        styleButton(factoryResetButton,0xFFFFF3F1,0xFFB9534B,0xFF972C27);
        add(resetCard,factoryResetButton,0);
        factoryResetButton.setOnClickListener(v->{
            new AlertDialog.Builder(this)
                .setTitle("รีเซ็ตข้อมูล PG Connect ในโทรศัพท์?")
                .setMessage("การดำเนินการนี้ลบรหัสจับคู่ การตั้งค่าร้าน คิวแจ้งเตือน " +
                    "และข้อมูลวิเคราะห์ในเครื่องอย่างถาวร\n\n" +
                    "ไม่ได้เพิกถอนสิทธิ์อุปกรณ์บนเซิร์ฟเวอร์ หากเซิร์ฟเวอร์ยังรับรหัสเดิม " +
                    "ผู้ดูแลร้านต้องยกเลิกสิทธิ์ของอุปกรณ์นั้นในหน้า Admin อีกครั้ง\n\n" +
                    "สิทธิ์เข้าถึง Notification ที่ Android อนุญาตไว้ต้องปิดจากการตั้งค่า Android")
                .setNegativeButton("กลับ",null)
                .setPositiveButton("ล้างข้อมูลในเครื่อง", (dialog,which)->resetLocalDevice()).show();
        });

        diagnosticsCard=card(outer);
        add(diagnosticsCard,text("ตรวจสอบการทำงาน",17,Color.rgb(24,67,40),true),6);
        diagnosticsToggleButton=button("ดูข้อมูลวิเคราะห์เมื่อพบปัญหา",false);
        add(diagnosticsCard,diagnosticsToggleButton,8);
        diagnosticsToggleButton.setOnClickListener(v->{
            diagnosticsOpen=!diagnosticsOpen;updateUiState();
        });
        diagnosticsBody=new LinearLayout(this);
        diagnosticsBody.setOrientation(LinearLayout.VERTICAL);
        add(diagnosticsBody,text("ตรวจสอบเส้นทาง Notification → Webhook",14,GREEN,true),6);
        add(diagnosticsBody,text("ใช้เมื่อรายการเงินเข้าจริงยังไม่ขึ้นบนหน้าเว็บ เก็บเฉพาะจำนวนครั้งและรหัสสถานะบนเครื่อง ไม่เก็บข้อความ Notification",
                12,Color.rgb(83,107,92),false),9);
        diagnosticsLabel=text("",12,Color.rgb(25,75,44),false);
        add(diagnosticsBody,diagnosticsLabel,10);
        Button diagRefresh=button("รีเฟรชสถานะรับแจ้งเตือน",false);
        add(diagnosticsBody,diagRefresh,5);
        diagRefresh.setOnClickListener(v->{
            updateQueueLabel();showSuccess("อัปเดตสถานะการรับแจ้งเตือนแล้ว");
        });
        add(diagnosticsBody,text("หากแหล่งที่เลือกเป็น 0 ให้ตรวจว่าแอปธนาคารหรือ LINE แจ้งเตือนจริง และเปิด Notification Access แล้ว หากข้อมูลไม่ครบ ให้ดูรูปแบบ Notification ก่อนปรับเงื่อนไข",
                11,Color.rgb(96,118,104),false),0);
        add(diagnosticsCard,diagnosticsBody,0);
    }
    private boolean notificationAccessEnabled() {
        try {
            String enabled=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");
            if(enabled==null)return false;
            ComponentName ours=new ComponentName(this, IncomingNotificationService.class);
            for(String value:enabled.split(":")) {
                ComponentName component=ComponentName.unflattenFromString(value);
                if(ours.equals(component))return true;
            }
        } catch(Exception ignored) {}
        return false;
    }
    private String selectedBankCode() {
        if(bankSpinner==null || displayedBankMode==null)return settings.bank();
        String[] codes=CompanionParser.codesFor(displayedBankMode);
        int index=bankSpinner.getSelectedItemPosition();
        return index>=0 && index<codes.length?codes[index]:settings.bank();
    }
    private void refreshBankOptions() {
        if(bankSpinner==null)return;
        String mode=sourceGroup.getCheckedRadioButtonId()==bankSourceId?"bank":"line";
        String preserve=selectedBankCode();
        String[] codes=CompanionParser.codesFor(mode);
        ArrayAdapter<String> banks=new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_dropdown_item,CompanionParser.labelsFor(mode));
        banks.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        bankSpinner.setAdapter(banks);
        displayedBankMode=mode;
        int selected=0;
        for(int i=0;i<codes.length;i++)if(codes[i].equals(preserve)){selected=i;break;}
        bankSpinner.setSelection(selected);
    }
    private void chooseInstalledApp() {
        if(sourceGroup.getCheckedRadioButtonId()!=bankSourceId){
            showError("กรุณาเลือกโหมดแอปธนาคารก่อน");return;
        }
        PackageManager pm=getPackageManager();
        List<ApplicationInfo> apps=pm.getInstalledApplications(0);
        List<String[]> available=new ArrayList<>();
        for(ApplicationInfo info:apps){
            String pkg=info.packageName;
            // Include preinstalled bank apps when they expose a launcher icon.
            // Hide background-only system packages; never upload the inventory.
            if(!CompanionParser.validBankApp(pkg)||
               ((info.flags & ApplicationInfo.FLAG_SYSTEM)!=0 &&
                pm.getLaunchIntentForPackage(pkg)==null))continue;
            String label=String.valueOf(pm.getApplicationLabel(info)).trim();
            if(label.isEmpty())label=pkg;
            available.add(new String[]{label,pkg});
        }
        available.sort(Comparator.comparing(a->a[0].toLowerCase(java.util.Locale.ROOT)));
        String[] choices=new String[available.size()];
        for(int i=0;i<available.size();i++)choices[i]=available.get(i)[0]+" ("+available.get(i)[1]+")";
        if(choices.length==0){
            showError("ยังไม่พบแอปที่ติดตั้งไว้ หรือ Android จำกัดการแสดงรายชื่อแอป");return;
        }
        new AlertDialog.Builder(this)
            .setTitle("เลือกแอปธนาคารในเครื่อง (รับเฉพาะแอปนี้)")
            .setItems(choices,(dialog,index)->{
                pendingCustomBankPackage=available.get(index)[1];
                pendingCustomBankCode=selectedBankCode();
                updateSourceHint();
                showSuccess("เลือกแอป "+available.get(index)[0]+" แล้ว กดบันทึกแหล่งแจ้งเตือนเพื่อใช้งาน");
            })
            .setNegativeButton("ยกเลิก",null).show();
    }
    private void updateSourceHint() {
        if(sourceHintLabel==null||sourceGroup==null)return;
        boolean line=sourceGroup.getCheckedRadioButtonId()==lineSourceId;
        if(bankPickerLabel!=null)bankPickerLabel.setText(line
                ?"บริการแจ้งเตือนผ่าน LINE":"เลือกธนาคาร");
        visible(sourceBankPicker,true);
        if(line){
            sourceHintLabel.setText("LINE 8 บริการ: เลือกชื่อบริการที่รับเงินเข้า ไม่อ่าน LINE แชทอื่น");
            visible(chooseInstalledBankApp,false);
            return;
        }
        String code=selectedBankCode();
        String manual=code.equals(pendingCustomBankCode)?pendingCustomBankPackage:"";
        String pkg=CompanionParser.bankPackage(code,manual);
        String automatic=CompanionParser.bankPackage(code,"");
        boolean installed=false;
        if(!automatic.isEmpty()){
            try{installed=getPackageManager().getLaunchIntentForPackage(automatic)!=null;}
            catch(Exception ignored){}
        }
        if(!manual.isEmpty()){
            sourceHintLabel.setText("เลือกใช้แอปจากเครื่องแล้ว: "+manual+
                "\nต้องกดบันทึกเพื่อเปลี่ยนแหล่งรับแจ้งเตือน");
        }else if(automatic.isEmpty()){
            sourceHintLabel.setText("ยังไม่มีแอปเริ่มต้นของธนาคารนี้ กรุณาเลือกจากโทรศัพท์");
        }else if(!installed){
            sourceHintLabel.setText("แอปเริ่มต้น: "+automatic+
                "\nไม่พบแอปบนเครื่องนี้ หากติดตั้งแอปชื่ออื่น ให้เลือกจากโทรศัพท์");
        }else{
            sourceHintLabel.setText("✓ พบแอปธนาคารบนเครื่อง: "+automatic);
        }
        // Default installed banking apps need no manual app picker.
        // The fallback is only shown when that automatic choice is missing.
        visible(chooseInstalledBankApp,CompanionUiVisibility.customBankPicker(false,installed,!manual.isEmpty(),!automatic.isEmpty()));
    }
    private void refreshHealthLabel() {
        if(healthLabel==null||settings==null)return;
        boolean paired=!settings.token().isEmpty();
        healthLabel.setText(paired?"บันทึกการจับคู่แล้ว · กดตรวจสอบการเชื่อมต่อ":"ขั้นตอนถัดไป: สแกน QR หรือกรอกคีย์จาก Pricing");
        healthLabel.setTextColor(paired?Color.rgb(13,112,62):Color.rgb(144,85,22));
    }
    private void refresh() {
        // Programmatic restore must not fire the user's opt-in validation and
        // permanently disable collection during an Android update/rebind.
        restoringSavedCheckbox=true;
        enableCheckbox.setChecked(settings.enabled());
        restoringSavedCheckbox=false;
        refreshHealthLabel();
        updateQueueLabel();
    }
    private void updateQueueLabel() {
        if(queueLabel!=null)queueLabel.setText("รายการที่รอส่ง: "+CompanionQueue.count(this)+" รายการ");
        if(accessLabel!=null)accessLabel.setText(notificationAccessEnabled()
          ?"สิทธิ์ Notification Access: เปิดแล้ว"
          :"สิทธิ์ Notification Access: ยังไม่เปิด — ต้องอนุญาตก่อน");
        if(diagnosticsLabel!=null)diagnosticsLabel.setText(CompanionDiagnostics.summary(this));
        refreshHealthLabel();
        updateUiState();
    }
    private void saveSourceChoice() {
        String mode=sourceGroup.getCheckedRadioButtonId()==bankSourceId?"bank":"line";
        String bank=selectedBankCode();
        String custom=("bank".equals(mode)&&bank.equals(pendingCustomBankCode))
            ?pendingCustomBankPackage:"";
        if(!CompanionParser.validSelection(mode,bank) ||
           ("bank".equals(mode) && !CompanionParser.validBankApp(CompanionParser.bankPackage(bank,custom)))){
            showError("ยังไม่พบแอปธนาคารนี้ กรุณาเลือกแอปจากโทรศัพท์ก่อนบันทึก");
            return;
        }
        // Old captured events are retained in the private retry queue.
        // Each event carries its own source; changing selection doesn't
        // rewrite previously captured bank observations.
        settings.chooseSource(mode,bank,custom);
        pendingCustomBankCode=bank;
        pendingCustomBankPackage=custom;
        sourceEditing=false;
        showSuccess("บันทึก "+("line".equals(mode)?"LINE":"แอปธนาคาร")+" • "+
            selectedSourceTitle(mode,bank)+" สำเร็จ");
        updateQueueLabel();
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        IntentResult scanned=IntentIntegrator.parseActivityResult(requestCode,resultCode,data);
        if(scanned!=null){
            if(scanned.getContents()==null)return;
            CompanionPairingQR.Pairing parsed=CompanionPairingQR.parse(scanned.getContents());
            if(parsed==null){showError("QR จับคู่ไม่ถูกต้อง กรุณาสแกนจากหน้า Admin ของ PG Connect");return;}
            pairingEditing=true;
            serverInput.setText(parsed.server);
            webhookInput.setText(CompanionClient.defaultWebhook(parsed.server));
            tokenInput.setText(parsed.token);
            updateUiState();
            savePairing(); // existing server verification and replace confirmation
            return;
        }
        super.onActivityResult(requestCode,resultCode,data);
    }
    private void savePairing() {
        String endpoint=serverInput.getText().toString().trim();
        String token=tokenInput.getText().toString().trim();
        String hook=webhookInput.getText().toString().trim();
        if(!CompanionClient.validServer(endpoint)||!CompanionClient.validWebhook(endpoint,hook)||
           !token.matches("[a-f0-9]{64}")) {
            showError("ตรวจ URL และ Webhook ให้ใช้โดเมนเดียวกัน และวางรหัส 64 ตัวให้ครบ");
            return;
        }
        if(!settings.token().isEmpty()){
            new AlertDialog.Builder(this)
                .setTitle("เปลี่ยนการจับคู่กับร้านค้า?")
                .setMessage("เมื่อยืนยันรหัสใหม่สำเร็จ รายการค้างส่งในเครื่องจะถูกลบและต้องเปิดรับแจ้งเตือนอีกครั้ง\n\nหากยกเลิก แหล่งที่ใช้อยู่จะทำงานต่อ")
                .setNegativeButton("กลับ",null)
                .setPositiveButton("เชื่อมต่อรหัสใหม่",(dialog,which)->performPairing(endpoint,token,hook))
                .show();
        }else{
            performPairing(endpoint,token,hook);
        }
    }
    private void performPairing(String endpoint,String token,String hook) {
        final boolean replacing=!settings.token().isEmpty();
        saveButton.setEnabled(false);
        if(statusLabel!=null) {
            statusLabel.setText("กำลังตรวจสอบรหัสจับคู่…");
            visible(statusLabel,true);
        }
        executor.execute(()->{
            int result=0;
            try{result=CompanionClient.request(endpoint,token,"/api/companion/device/status",null);}
            catch(Exception ignored){}
            final int code=result;
            runOnUiThread(()->{
                saveButton.setEnabled(true);
                if(code!=200){
                    showError(code==401||code==403
                        ?"รหัสจับคู่ไม่ถูกต้องหรือถูกยกเลิกแล้ว กรุณาสร้างรหัสใหม่ใน Admin"
                        :"เชื่อมต่อร้านค้าไม่สำเร็จ (HTTP "+code+") ตรวจ URL และเครือข่าย");
                    return;
                }
                try{
                    // Only AFTER the new server credential was accepted:
                    // clear queue once; never reset a working pairing on errors.
                    CompanionQueue.cancel(this);
                    settings.savePairing(endpoint,token);
                    settings.setWebhook(hook);
                    // A new merchant pairing must not inherit the previous
                    // merchant's selected bank/LINE sender by accident.
                    if(replacing)settings.clearSourceChoice();
                    CompanionQueue.clear(this);
                    pendingCustomBankCode=settings.bank();
                    pendingCustomBankPackage=settings.customBankPackage();
                    displayedBankMode=null;
                    tokenInput.setText("");
                    pairingEditing=false;
                    advancedOpen=false;
                    sourceEditing=!settings.sourceConfigured();
                    refresh();
                    showSuccess("เชื่อมต่อ PENGUIN สำเร็จ (ทดสอบการจับคู่เท่านั้น)");
                }catch(Exception ignored){
                    showError("บันทึกรหัสใน Android Keystore ไม่สำเร็จ ยังไม่ได้เปิดรับแจ้งเตือน");
                }
            });
        });
    }
    private void revokePairingOnServer() {
        String server=settings.server(), token=settings.token();
        if(token.isEmpty()){showError("ยังไม่มีอุปกรณ์ที่จับคู่");return;}
        disconnectButton.setEnabled(false);
        executor.execute(()->{
            int response=0;
            try{response=CompanionClient.request(server,token,"/api/companion/device/unpair",new org.json.JSONObject());}
            catch(Exception ignored){}
            final int code=response;
            runOnUiThread(()->{
                disconnectButton.setEnabled(true);
                if(!CompanionUnpairPolicy.serverCredentialInvalidated(code)){
                    if(CompanionUnpairPolicy.missingServerRoute(code))
                        showError("เซิร์ฟเวอร์ยังไม่มี API ยกเลิกการจับคู่ (HTTP 404) " +
                            "สามารถรีเซ็ตเฉพาะโทรศัพท์ด้านล่างได้ แต่ต้องเพิกถอนสิทธิ์จากหน้า Admin ด้วย");
                    else
                        showError("ยกเลิกสิทธิ์บนเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจเครือข่ายก่อนลองใหม่ (HTTP "+code+")");
                    return;
                }
                if(!resetLocalDeviceData()){
                    showError("เซิร์ฟเวอร์ปฏิเสธรหัสเดิมแล้ว แต่ล้างข้อมูลในเครื่องไม่ครบ " +
                        "กรุณาใช้เมนูล้างข้อมูลแอปในการตั้งค่า Android");
                    return;
                }
                showSuccess("ยกเลิกสิทธิ์บนเซิร์ฟเวอร์และล้างข้อมูลในเครื่องแล้ว");
            });
        });
    }
    private boolean resetLocalDeviceData() {
        if(factoryResetButton!=null)factoryResetButton.setEnabled(false);
        boolean ok=CompanionLocalReset.reset(this,settings);
        if(factoryResetButton!=null)factoryResetButton.setEnabled(true);
        if(!ok)return false;
        restoringSavedCheckbox=true;
        if(enableCheckbox!=null)enableCheckbox.setChecked(false);
        restoringSavedCheckbox=false;
        if(tokenInput!=null)tokenInput.setText("");
        if(serverInput!=null)serverInput.setText(settings.server());
        if(webhookInput!=null)webhookInput.setText(settings.webhook());
        pendingCustomBankCode="";
        pendingCustomBankPackage="";
        displayedBankMode=null;
        pairingEditing=false;
        advancedOpen=false;
        sourceEditing=false;
        diagnosticsOpen=false;
        refresh();
        return true;
    }

    private void resetLocalDevice() {
        if(!resetLocalDeviceData()){
            showError("ล้างข้อมูลในเครื่องไม่ครบ กรุณาใช้เมนูล้างพื้นที่เก็บข้อมูลของ PG Connect ในการตั้งค่า Android");
            return;
        }
        showSuccess("รีเซ็ตข้อมูลในโทรศัพท์แล้ว ยังไม่ได้เพิกถอนสิทธิ์อุปกรณ์บนเซิร์ฟเวอร์");
    }

    private void checkConnection() {
        if(settings.token().isEmpty()){
            showError("ยังไม่มีรหัสจับคู่ กรุณาเชื่อมต่อร้านค้าก่อน");return;
        }
        testButton.setEnabled(false);
        if(statusLabel!=null){
            statusLabel.setText("กำลังตรวจสอบการเชื่อมต่อ…");
            visible(statusLabel,true);
        }
        executor.execute(()->{
            int result=0;
            try{result=CompanionClient.request(settings.server(),settings.token(),
                "/api/companion/device/status",null);}catch(Exception ignored){}
            final int code=result;
            runOnUiThread(()->{
                testButton.setEnabled(true);
                if(code==401||code==403){
                    restoringSavedCheckbox=true;
                    enableCheckbox.setChecked(false);
                    restoringSavedCheckbox=false;
                    CompanionQueue.cancel(this);
                    CompanionQueue.clear(this);
                    settings.disconnect();
                    tokenInput.setText("");
                    pairingEditing=false;
                    refresh();
                    showError("รหัสถูกยกเลิกบนเซิร์ฟเวอร์แล้ว ลบการจับคู่ในเครื่องและต้องจับคู่ใหม่");
                }else if(code==200){
                    showSuccess("ทดสอบเชื่อมต่อร้านค้าสำเร็จ");
                    updateQueueLabel();
                }else{
                    showError("ทดสอบเชื่อมต่อไม่สำเร็จ (HTTP "+code+") กรุณาตรวจเครือข่าย");
                    updateQueueLabel();
                }
            });
        });
    }
    @Override protected void onResume(){super.onResume();
        if(settings!=null&&queueLabel!=null){
            // Temporary Notification Access loss must never rewrite an opt-in.
            // UI shows the missing-permission action until Android grants it.
            updateQueueLabel();
        }
    }
    @Override protected void onDestroy(){
        if(feedbackToast!=null){
            feedbackToast.removeCallbacks(hideFeedbackToast);
            feedbackToast.animate().cancel();
        }
        executor.shutdownNow();super.onDestroy();
    }
}
