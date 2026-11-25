import React from "react";
import {createRoot} from "react-dom/client";
import {ThaiPaymentQR,rememberThaiPaymentObservation} from "@/components/ThaiPaymentQR";
import {generatePromptPayPayload} from "@/utils/promptPay";
const cases=[["0812345678",219],["1234567890123",268.15]];
function App(){
 const [observed,setObserved]=React.useState(false);
 const masked=rememberThaiPaymentObservation("p34:test","bank-ref",observed);
 return <main style={{maxWidth:680,margin:"0 auto"}}>
  {cases.map(([id,amount],i)=><div data-case={i} key={id}>
   <ThaiPaymentQR payload={generatePromptPayPayload(id,amount)}
    imageId={"p34-thai-"+i} amount={amount.toFixed(2)+" บาท"}
    recipient={"ทดสอบ ร้าน "+(i+1)} /></div>)}
  <button id="detect" type="button" onClick={()=>setObserved(true)}>Detected</button>
  <div data-observation={masked?"masked":"active"}>
   <ThaiPaymentQR payload={generatePromptPayPayload(cases[0][0],cases[0][1])}
    amount="219.00 บาท" recipient="Test Receiver" processing={masked}/>
  </div>
 </main>;
}
createRoot(document.getElementById("root")).render(<App/>);
