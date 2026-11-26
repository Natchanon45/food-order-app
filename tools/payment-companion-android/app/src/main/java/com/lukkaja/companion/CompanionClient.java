package com.lukkaja.companion;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Strict HTTPS API client. Loopback HTTP is available only in debug builds with adb reverse. */
final class CompanionClient {
    private CompanionClient() {}
    static boolean validServer(String address) {
        return "https://penguin-food.web.app".equals(address) ||
            "https://penguin-food.web.app/".equals(address);
    }
    static String defaultWebhook(String server) {
        return server.replaceAll("/$", "") + "/api/companion/notifications";
    }
    static boolean validWebhook(String server, String url) {
        try {
            if (!validServer(server) || url == null || !url.equals(url.trim())) return false;
            URI base = new URI(server), target = new URI(url);
            // Pairing token is a financial-observation capability. Never permit
            // a webhook on another host/port or a protocol downgrade.
            return target.getScheme() != null && target.getScheme().equalsIgnoreCase(base.getScheme())
                && target.getHost() != null && target.getHost().equalsIgnoreCase(base.getHost())
                && target.getPort() == base.getPort() && target.getUserInfo() == null
                && target.getQuery() == null && target.getFragment() == null
                && target.getPath() != null && target.getPath().startsWith("/api/companion/")
                && !target.getPath().contains("..");
        } catch (Exception ignored) { return false; }
    }
    static int sendWebhook(String server, String webhook, String token, JSONObject payload) {
        // Pairing-only UAT never transmits notification contents.
        throw new IllegalStateException("NOTIFICATION_INGEST_DISABLED");
    }
    static int request(String server, String token, String route, JSONObject payload) throws Exception {
        if (!validServer(server) || token == null || !token.matches("[a-f0-9]{64}")) {
            throw new IllegalArgumentException("NOT_PAIRED");
        }
        if ("/api/companion/device/status".equals(route) && payload == null) {
            route="/api/platform/connect/device/status";
        } else if ("/api/companion/device/unpair".equals(route) && payload != null) {
            route="/api/platform/connect/device/unpair";
            payload=new JSONObject();
        } else throw new IllegalArgumentException("PAIRING_ONLY");
        HttpURLConnection connection = (HttpURLConnection) new URL(server.replaceAll("/$", "") + route).openConnection();
        try {
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(12000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Accept", "application/json");
            if (payload != null) {
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int responseCode = connection.getResponseCode();
            // A Hosting fallback can return HTML with HTTP 200. Accept only
            // the explicit pairing-only JSON acknowledgement from PENGUIN.
            if (responseCode == 200) {
                String contentType=connection.getContentType();
                if(contentType==null || !contentType.toLowerCase(java.util.Locale.ROOT).startsWith("application/json")) return 502;
                ByteArrayOutputStream body=new ByteArrayOutputStream();
                try(InputStream in=connection.getInputStream()){
                    byte[] buffer=new byte[1024]; int count;
                    while((count=in.read(buffer))!=-1){
                        if(body.size()+count>8192)return 502;
                        body.write(buffer,0,count);
                    }
                }
                JSONObject result=new JSONObject(body.toString("UTF-8"));
                if(!result.optBoolean("ok",false)||(!"platform".equals(result.optString("scope"))&&!"tenant".equals(result.optString("scope")))||
                    !"pairing_only".equals(result.optString("mode"))||
                    !Boolean.FALSE.equals(result.opt("notificationEnabled"))||
                    !Boolean.FALSE.equals(result.opt("paymentRoutingEnabled"))||
                    !Boolean.FALSE.equals(result.opt("paymentVerified"))||
                    !(route.endsWith("/unpair")?result.optBoolean("revoked",false):result.optBoolean("connected",false)))return 502;
            }
            return responseCode;
        } finally { connection.disconnect(); }
    }
}
