package com.lukkaja.companion;

import java.util.*;

/** RAM-only sanitized fragments from one notification group. Never combines
 *  two distinct amounts/accounts/times or stores private raw message text. */
final class CompanionGroupBuffer {
    private static final long TTL_MS = 90000;
    private static final int MAX_GROUPS = 30;
    private static final Map<String,Group> groups = new HashMap<>();
    private static final class Group {
        final long created;
        final String source;
        String amount="",account="",bankTime="",observedAt="";
        boolean hasIncoming;
        Group(long now,String source){created=now;this.source=source;}
    }
    static synchronized CompanionParser.Parsed accept(String groupKey,CompanionParser.Partial piece,long now) {
        if(piece==null||groupKey==null||groupKey.length()>300||groupKey.isEmpty()||now<=0)return null;
        groups.entrySet().removeIf(e -> now-e.getValue().created>TTL_MS||e.getValue().created>now+3000);
        if(groups.size()>=MAX_GROUPS && !groups.containsKey(groupKey))return null;
        Group group=groups.get(groupKey);
        if(group==null){group=new Group(now,piece.source);groups.put(groupKey,group);}
        if(!group.source.equals(piece.source))return null;
        if(conflicting(group.amount,piece.amount)||conflicting(group.account,piece.account)
          ||conflicting(group.bankTime,piece.time)){
            // If two transfers share an Android notification group, DO NOT
            // manufacture a matching payment by mixing their fragments.
            groups.remove(groupKey);
            return null;
        }
        if(!piece.amount.isEmpty())group.amount=piece.amount;
        if(!piece.account.isEmpty())group.account=piece.account;
        if(!piece.time.isEmpty())group.bankTime=piece.time;
        if(!piece.observedAt.isEmpty())group.observedAt=piece.observedAt;
        group.hasIncoming|=piece.incoming;
        if(group.hasIncoming&&!group.amount.isEmpty()&&!group.account.isEmpty()
          &&!group.bankTime.isEmpty()){
            groups.remove(groupKey);
            return new CompanionParser.Parsed(group.amount,group.account,group.bankTime,
                group.observedAt,group.source);
        }
        return null;
    }
    private static boolean conflicting(String a,String b) {
        return !a.isEmpty()&&!b.isEmpty()&&!a.equals(b);
    }
    static synchronized void clear(){groups.clear();}
}
