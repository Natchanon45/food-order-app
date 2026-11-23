// P1.3d: the verification requirement is opt-in for newly Admin-provisioned
// accounts. Legacy accounts and already verified self-registered owners keep
// their established login and onboarding behavior.
export function managedEmailVerificationPending(profile,user){
 return profile?.emailVerificationRequired===true&&user?.emailVerified!==true;
}
export function accountEmailHome(profile={}){
 switch(profile.role){
  case "super_admin":return "/platform";
  case "kitchen":return "/kitchen";
  case "cashier":return "/cashier";
  case "owner":case "admin":case "manager":return "/admin";
  default:return "/login";
 }
}
export function accountEmailGuardPath(path){
 const pathname=String(path||"").split(/[?#]/,1)[0];
 if(pathname==="/"||pathname==="/react")return true;
 if(["/waiting-queue/customer","/waiting-queue/display","/pos/customer-display",
  "/pos/login","/pos/forbidden"].includes(pathname))return false;
 return /^\/(?:admin|platform|super-admin|cashier|kitchen|pos|reports|waiting-queue)(?:\/|$)/.test(pathname);
}
