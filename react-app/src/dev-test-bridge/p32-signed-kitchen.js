import {httpsCallable} from "firebase/functions";
import {updateDoc,doc} from "firebase/firestore";
import {functions,db,auth,isHybridDemoMode,firebaseConfig} from "@/firebase/client";
if(!import.meta.env.DEV || !isHybridDemoMode ||
 firebaseConfig.projectId!=="demo-penguin-hybrid")throw Error("P32_DEMO_EMULATOR_ONLY");
window.__p32SignedKitchen=async data=>{
 if(!auth.currentUser)throw Error("P32_SIGNED_LOGIN_REQUIRED");
 return (await httpsCallable(functions,"kitchenApplyOrderAction")(data)).data;
};
window.__p32SignedTableSettlement=async data=>{
 if(!auth.currentUser)throw Error("P32_SIGNED_LOGIN_REQUIRED");
 return (await httpsCallable(functions,"settleTableSession")(data)).data;
};
window.__p32DirectKitchenWrite=async(data)=>{
 if(!auth.currentUser)throw Error("P32_SIGNED_LOGIN_REQUIRED");
 return updateDoc(doc(db,"tenants",data.tenantId,"orders",data.orderId),data.patch);
};
