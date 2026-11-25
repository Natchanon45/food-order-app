package com.lukkaja.companion;
public final class CompanionUiVisibilitySelfTest {
 private static void check(boolean condition,String title){
  if(!condition)throw new AssertionError(title);
 }
 public static void main(String[] args){
  check(CompanionUiVisibility.pairingForm(false,false),"show pairing input before connection");
  check(!CompanionUiVisibility.pairingSummary(false,false),"no fake paired summary");
  check(!CompanionUiVisibility.pairingForm(true,false),"hide pair credentials when connected");
  check(CompanionUiVisibility.pairingSummary(true,false),"show paired server summary");
  check(CompanionUiVisibility.pairingForm(true,true),"explicit re-pair can reopen form");
  check(!CompanionUiVisibility.pairingSummary(true,true),"never show summary and form together");
  check(!CompanionUiVisibility.sourceEditor(false,false,false),"no source choice before pairing");
  check(CompanionUiVisibility.sourceEditor(true,false,false),"choose source when paired but unset");
  check(!CompanionUiVisibility.sourceSummary(true,false,false),"do not pretend source saved");
  check(!CompanionUiVisibility.sourceEditor(true,true,false),"hide radio after source saved");
  check(CompanionUiVisibility.sourceSummary(true,true,false),"show saved source summary");
  check(CompanionUiVisibility.sourceEditor(true,true,true),"source can be changed explicitly");
  check(!CompanionUiVisibility.sourceSummary(true,true,true),"hide summary while editing");
  check(CompanionUiVisibility.notificationPermissionButton(false),"prompt for missing Android access");
  check(!CompanionUiVisibility.notificationPermissionButton(true),"hide redundant permission CTA");
  check(!CompanionUiVisibility.receiveToggleAvailable(false,false,true,false),"no toggle before connection");
  check(!CompanionUiVisibility.receiveToggleAvailable(true,false,true,false),"no toggle before source saved");
  check(!CompanionUiVisibility.receiveToggleAvailable(true,true,false,false),"no enable while access missing");
  check(CompanionUiVisibility.receiveToggleAvailable(true,true,false,true),"always allow turning OFF saved opt-in");
  check(CompanionUiVisibility.receiveToggleAvailable(true,true,true,false),"can enable when ready");
  check(!CompanionUiVisibility.retryButton(true,true,0),"no retry button if queue empty");
  check(!CompanionUiVisibility.retryButton(true,false,5),"no retry when opted out");
  check(CompanionUiVisibility.retryButton(true,true,5),"retry pending queue");
  check(!CompanionUiVisibility.customBankPicker(true,false,false,false),"never bank picker in LINE mode");
  check(!CompanionUiVisibility.customBankPicker(false,true,false,true),"hide fallback for installed bank app");
  check(CompanionUiVisibility.customBankPicker(false,false,false,true),"offer fallback for missing bank app");
  check(CompanionUiVisibility.customBankPicker(false,false,false,false),"offer fallback for unknown bank app");
  check(CompanionUiVisibility.customBankPicker(false,true,true,true),"allow changing custom package");
  System.out.println("COMPANION_ANDROID_UI_VISIBILITY_PASS");
 }
}
