import {doc,setDoc} from "firebase/firestore";
import {db,isHybridDemoMode,firebaseConfig} from "@/firebase/client";
import {
 createPublicTakeawayOrder,createPublicTableOrder,
 resolvePublicTenant,findPublicTableSession,
} from "@/data/publicStorefrontData";
if(!import.meta.env.DEV||!isHybridDemoMode ||
 firebaseConfig.projectId!=="demo-penguin-hybrid")throw Error("P33_GUEST_BRIDGE_EMULATOR_ONLY");
window.__p33Guest=async({slug,kind,order})=>{
 const tenant=await resolvePublicTenant(slug);
 if(kind==="table")return createPublicTableOrder(tenant,order);
 if(kind==="takeaway")return createPublicTakeawayOrder(tenant,order);
 throw Error("P33_KIND_NOT_ALLOWED");
};
window.__p33GuestUnsafe=async({tenantId,id,order})=>
 setDoc(doc(db,"tenants",tenantId,"orders",id),order);
