package com.lukkaja.companion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AES-GCM token encryption with a non-exportable Android Keystore key. */
final class SecureSettings {
    private static final String ALIAS = "penguin_connect_pairing_uat_v1";
    private static final String PREF = "penguin_connect_config_uat_v1";
    private final SharedPreferences preferences;
    SecureSettings(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
    boolean enabled() { return false; }
    void setEnabled(boolean enabled) { preferences.edit().putBoolean("enabled", false).commit(); }
    String server() {
        String saved = preferences.getString("server", "");
        return saved.isEmpty() ? BuildConfig.DEFAULT_SERVER_URL : saved;
    }
    String webhook() {
        String saved = preferences.getString("webhook", "");
        return saved.isEmpty() ? CompanionClient.defaultWebhook(server()) : saved;
    }
    void setWebhook(String webhook) { preferences.edit().putString("webhook", webhook).commit(); }
    String sourceMode() { return preferences.getString("sourceMode", "line"); }
    String bank() { return preferences.getString("bank", "scb"); }
    String customBankPackage() { return preferences.getString("customBankPackage", ""); }
    // A default bank is only a suggestion, not an explicitly saved selection.
    // Existing installations with an owner-saved sourceMode remain configured.
    boolean sourceConfigured() {
        return preferences.contains("sourceMode") &&
                CompanionParser.validSelection(sourceMode(), bank()) &&
                (!"bank".equals(sourceMode()) ||
                 CompanionParser.validBankApp(CompanionParser.bankPackage(bank(), customBankPackage())));
    }
    void chooseSource(String sourceMode, String bank) {
        chooseSource(sourceMode, bank, customBankPackage());
    }
    void chooseSource(String sourceMode, String bank, String selectedPackage) {
        if (!CompanionParser.validSelection(sourceMode, bank) ||
            ("bank".equals(sourceMode) &&
             !CompanionParser.validBankApp(CompanionParser.bankPackage(bank,selectedPackage))))
            throw new IllegalArgumentException("INVALID_SOURCE");
        preferences.edit().putString("sourceMode", sourceMode).putString("bank", bank)
            .putString("customBankPackage", "bank".equals(sourceMode) && CompanionParser.validBankApp(selectedPackage) ? selectedPackage : "").commit();
    }
    void setServer(String server) { preferences.edit().putString("server", server).commit(); }
    // Only when intentionally switching/revoking pairing, not on an APK
    // upgrade: require an explicit bank choice for the newly paired store.
    void clearSourceChoice() {
        preferences.edit().remove("sourceMode").remove("bank")
            .remove("customBankPackage").putBoolean("enabled", false).commit();
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }
    void savePairing(String server, String token) throws Exception {
        if (!CompanionClient.validServer(server) || !token.matches("[a-f0-9]{64}")) {
            throw new IllegalArgumentException("INVALID_PAIRING");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        String nonce = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        String ciphertext = Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!preferences.edit().putString("server", server).putString("nonce", nonce)
                .putString("ciphertext", ciphertext).putBoolean("enabled", false).commit()) {
            throw new IllegalStateException("PAIRING_SAVE_FAILED");
        }
    }
    String token() {
        try {
            String nonce = preferences.getString("nonce", "");
            String ciphertext = preferences.getString("ciphertext", "");
            if (nonce.isEmpty() || ciphertext.isEmpty()) return "";
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(nonce, Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception ignored) { return ""; }
    }
    /** Local-only factory reset; does NOT revoke any server-side credential. */
    boolean factoryReset() {
        // A failed commit must not be reported as a completed reset.
        boolean cleared = preferences.edit().clear().commit();
        if (!cleared) return false;
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    void disconnect() {
        preferences.edit().remove("nonce").remove("ciphertext").remove("server").remove("webhook")
                .remove("sourceMode").remove("bank").remove("customBankPackage")
                .putBoolean("enabled", false).commit();
        // Also delete the wrapping key; no revoked pairing material should
        // remain in Android Keystore after the owner disconnects the device.
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS);
        } catch (Exception ignored) {
            // The encrypted pairing ciphertext above has already been erased.
        }
    }
}
