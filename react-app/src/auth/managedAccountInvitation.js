import {sendPasswordResetEmail} from "firebase/auth";
import {auth} from "@/firebase/client";

// Auth Admin SDK cannot send mail by itself. On a deliberate operator click,
// Firebase Authentication's own hosted password-reset template lets a newly
// provisioned user choose their password without exposing an OOB bearer link.
// The SDK resolves an accepted request, NOT proof of inbox delivery.
export async function requestManagedAccountSetupEmail(email){
 const target=String(email||"").trim().toLowerCase();
 if(!auth.currentUser?.uid)throw Error("MANAGED_INVITATION_SIGNIN_REQUIRED");
 if(target.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))
   throw Error("MANAGED_INVITATION_EMAIL_INVALID");
 const url=new URL("/login",location.origin).toString();
 await sendPasswordResetEmail(auth,target,{url,handleCodeInApp:false});
 return {providerAccepted:true,deliveryConfirmed:false,containsPassword:false};
}
