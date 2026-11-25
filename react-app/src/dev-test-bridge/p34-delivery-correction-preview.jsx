import React from "react";
import {createRoot} from "react-dom/client";
import {httpsCallable} from "firebase/functions";
import {functions,firebaseConfig,isHybridDemoMode} from "@/firebase/client";
import {DeliveryPaymentCorrection} from "@/components/DeliveryPaymentCorrection";
if(!isHybridDemoMode||firebaseConfig.projectId!=="demo-penguin-hybrid")
 throw Error("P34_CORRECTION_BRIDGE_DEMO_ONLY");
const data=window.__p34Fixture;
if(!data?.tenantId||!data?.orderId)throw Error("P34_CORRECTION_FIXTURE_REQUIRED");
window.__p34CorrectionTest={
 state:payload=>httpsCallable(functions,"getPublicDeliveryCorrectionState")(payload).then(x=>x.data),
 submit:payload=>httpsCallable(functions,"submitPublicDeliveryCorrectionSlip")(payload).then(x=>x.data),
};
function App(){
 return <main style={{padding:12,maxWidth:720,margin:"auto"}}>
  <DeliveryPaymentCorrection tenant={{id:data.tenantId}} order={{
   tenantId:data.tenantId,id:data.orderId,orderType:"delivery",
   paymentMethod:"promptpay",paymentStatus:"pending_verification",
   status:"pending",totalAmount:150,
  }} orderId={data.orderId} onToast={()=>{}} />
 </main>;
}
createRoot(document.getElementById("root")).render(<App/>);
