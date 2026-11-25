package com.lukkaja.companion;

/** Only recover recent, individual LINE notifications in the exact group
 * that just posted. Never infer a bank sender from a group summary. */
final class CompanionLineRecovery {
    private CompanionLineRecovery(){}
    static boolean recent(long now,long posted){
        return posted>0 && now>=posted-3000L && now-posted<=60000L;
    }
    static boolean eligible(String summaryGroup,String childGroup,String pkg,
                            boolean summary,long now,long posted){
        return CompanionParser.LINE_PACKAGE.equals(pkg) && !summary
            && summaryGroup!=null && !summaryGroup.isEmpty()
            && summaryGroup.equals(childGroup) && recent(now,posted);
    }
}
