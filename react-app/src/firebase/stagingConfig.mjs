// P1.3 staging provider UAT: configuration is public Firebase web metadata,
// NOT a secret. There is deliberately NO implicit staging default, because this
// repository's .firebaserc default project is the existing production project.
const PROJECT=/^[a-z][a-z0-9-]{5,39}$/;
const API_KEY=/^AIza[A-Za-z0-9_-]{20,}$/;
const APP_ID=/^1:([0-9]{6,20}):web:[a-zA-Z0-9]{8,}$/;
const fail=code=>{throw Error(code);};
const str=value=>typeof value==="string"?value.trim():"";

export function readStagingFirebaseConfig(env={},productionConfig={}){
 const projectId=str(env.VITE_STAGING_FIREBASE_PROJECT_ID);
 if(!PROJECT.test(projectId)||projectId.startsWith("demo-")||
    projectId===str(productionConfig.projectId))
   fail("STAGING_FIREBASE_PROJECT_MUST_BE_DISTINCT_FROM_PRODUCTION");
 if(env.VITE_USE_FIREBASE_EMULATORS==="true"||
    env.VITE_HYBRID_DEMO_PAYMENT_E2E==="true")
   fail("STAGING_FIREBASE_EMULATOR_FLAGS_FORBIDDEN");
 const apiKey=str(env.VITE_STAGING_FIREBASE_API_KEY);
 const authDomain=str(env.VITE_STAGING_FIREBASE_AUTH_DOMAIN);
 const storageBucket=str(env.VITE_STAGING_FIREBASE_STORAGE_BUCKET);
 const messagingSenderId=str(env.VITE_STAGING_FIREBASE_MESSAGING_SENDER_ID);
 const appId=str(env.VITE_STAGING_FIREBASE_APP_ID);
 const match=APP_ID.exec(appId);
 if(!API_KEY.test(apiKey)||apiKey===str(productionConfig.apiKey)||
    authDomain!==projectId+".firebaseapp.com"||
    ![projectId+".firebasestorage.app",projectId+".appspot.com"]
      .includes(storageBucket)||
    !/^[0-9]{6,20}$/.test(messagingSenderId)||
    !match||match[1]!==messagingSenderId||
    appId===str(productionConfig.appId)||
    storageBucket===str(productionConfig.storageBucket)||
    authDomain===str(productionConfig.authDomain))
   fail("STAGING_FIREBASE_WEB_CONFIG_INCOMPLETE_OR_MISMATCHED");
 return Object.freeze({
  apiKey,authDomain,projectId,storageBucket,messagingSenderId,appId,
 });
}
