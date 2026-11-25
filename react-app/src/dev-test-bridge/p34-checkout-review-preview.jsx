import React from "react";
import {createRoot} from "react-dom/client";
import {I18nProvider} from "@/i18n/I18nProvider";
import {DeliveryCheckoutReviewDialog} from "@/components/DeliveryCheckoutReviewDialog";
function App(){
 const [open,setOpen]=React.useState(false),[confirmed,setConfirmed]=React.useState(0);
 return <I18nProvider>
  <button type="button" id="open-review" onClick={()=>setOpen(true)}>Review order</button>
  <output id="confirmed-count">{confirmed}</output>
  <DeliveryCheckoutReviewDialog open={open} onClose={()=>setOpen(false)}
   onConfirm={()=>{setOpen(false);setConfirmed(v=>v+1);}}
   cart={[{id:"menu1",name:"Food item A",price:30,qty:2,note:"Less spicy"},
          {id:"menu2",name:"Food item B",price:50,qty:1,note:"No nuts"}]}
   subtotal={110} fee={30} total={140}
   paymentMethod="promptpay" paymentEnabled routeReady storeReady
   money={n=>Number(n).toFixed(2)}
  />
 </I18nProvider>;
}
createRoot(document.getElementById("root")).render(<App/>);
