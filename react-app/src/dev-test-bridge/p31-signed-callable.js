import {httpsCallable} from "firebase/functions";
import {functions,auth,isHybridDemoMode,firebaseConfig} from "@/firebase/client";
// Loaded only by local QA via isolated Vite dev URL; not imported by any app
// route/build. Refuses Staging, Production, missing user or non-demo project.
if (!import.meta.env.DEV || !isHybridDemoMode ||
    firebaseConfig.projectId!=="demo-penguin-hybrid") {
  throw Error("P31_TEST_BRIDGE_DEMO_ONLY");
}
window.__p31SignedCall=async(name,data)=>{
 if(!auth.currentUser)throw Error("P31_SIGNED_LOGIN_REQUIRED");
 if(!["cashierRecordCashReceipt","cashierPickupAction","cashierCancelOrderSafely"].includes(name))
  throw Error("P31_SIGNED_FUNCTION_NOT_ALLOWED");
 return (await httpsCallable(functions,name)(data)).data;
};
