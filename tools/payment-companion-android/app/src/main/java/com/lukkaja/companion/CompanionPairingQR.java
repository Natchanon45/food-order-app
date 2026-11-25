package com.lukkaja.companion;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Strict QR handoff. Never follow URLs from untrusted QR codes. */
final class CompanionPairingQR {
    static final class Pairing {
        final String server, token;
        Pairing(String server, String token) {this.server=server;this.token=token;}
    }
    static Pairing parse(String input) {
        if(input==null || input.length()>550 || !input.startsWith("lkconnect://pair?"))return null;
        try {
            URI uri=new URI(input);
            if(!"lkconnect".equals(uri.getScheme()) || !"pair".equals(uri.getHost()) ||
               uri.getFragment()!=null || (uri.getPath()!=null&&!uri.getPath().isEmpty()))return null;
            Map<String,String> parts=new HashMap<>();
            for(String item:uri.getRawQuery().split("&")) {
                String[] kv=item.split("=",2);
                if(kv.length!=2 || !kv[0].matches("v|server|token") || parts.containsKey(kv[0]))return null;
                parts.put(kv[0],URLDecoder.decode(kv[1],StandardCharsets.UTF_8.name()));
            }
            if(parts.size()!=3 || !"1".equals(parts.get("v")))return null;
            String server=parts.get("server"),token=parts.get("token");
            URI endpoint=new URI(server);
            String host=endpoint.getHost();
            boolean official="https".equalsIgnoreCase(endpoint.getScheme()) &&
                "penguin-food.web.app".equalsIgnoreCase(host) && endpoint.getPort()==-1;
            boolean loopback=BuildConfig.DEBUG && "http".equalsIgnoreCase(endpoint.getScheme()) &&
                ("127.0.0.1".equals(host)||"localhost".equalsIgnoreCase(host));
            if(!CompanionClient.validServer(server) || !(official||loopback) ||
               !token.matches("[a-f0-9]{64}"))return null;
            return new Pairing(server,token);
        }catch(Exception e){return null;}
    }
    static String format(String server,String token) {
        try {
            return "lkconnect://pair?v=1&server="+URLEncoder.encode(server,StandardCharsets.UTF_8.name())+"&token="+token;
        } catch (java.io.UnsupportedEncodingException impossible) {
            throw new IllegalStateException("UTF-8 unavailable",impossible);
        }
    }
}
