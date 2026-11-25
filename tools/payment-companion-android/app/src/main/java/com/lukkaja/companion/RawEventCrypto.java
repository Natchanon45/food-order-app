package com.lukkaja.companion;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Raw financial text exists on disk only in AES-GCM ciphertext with a device-only key. */
final class RawEventCrypto {
    private static final String ALIAS="lukkaja_companion_raw_event_v1";
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }
    static JSONObject encrypt(JSONObject event) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key());
        return new JSONObject()
            .put("eventId",event.getString("eventId"))
            .put("encryptedRaw",Base64.encodeToString(
                cipher.doFinal(event.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP))
            .put("rawIV",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP));
    }
    static JSONObject decrypt(JSONObject stored) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,
            Base64.decode(stored.getString("rawIV"),Base64.NO_WRAP)));
        byte[] clear=cipher.doFinal(Base64.decode(stored.getString("encryptedRaw"),Base64.NO_WRAP));
        return new JSONObject(new String(clear,StandardCharsets.UTF_8));
    }
    static boolean eraseKey() {
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
    private RawEventCrypto(){}
}
