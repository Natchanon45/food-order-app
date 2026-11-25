// P3.3 Public-guest order intake is a distinct authorization decision from
// the ability to read a shop's branding or an existing customer's receipt.
export function publicOrderAcceptingTenant(tenant={}) {
  if(!tenant||typeof tenant!=="object")return false;
  if(tenant.active===false || tenant.operationalSuspended===true ||
     tenant.revenueShareSuspended===true ||
     ["suspended","expired"].includes(String(tenant.subscriptionStatus||"").toLowerCase()) ||
     String(tenant.status||"").toLowerCase()==="suspended")
    return false;
  const type=String(tenant.businessType||"both").toLowerCase();
  return ["both","restaurant_cafe"].includes(type);
}
