const styleId='retailToastMainStyle';
if(!document.getElementById(styleId)){
  const style=document.createElement('style');
  style.id=styleId;
  style.textContent=`
.toast{border-radius:14px!important}
.toast::before{content:""!important;flex:0 0 auto;width:24px!important;height:24px!important;border:0!important;border-radius:0!important;background-repeat:no-repeat;background-position:center;background-size:24px 24px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m8.5 12.2 2.2 2.2 4.8-5'/%3E%3C/svg%3E")!important}
.toast.error,.toast.is-error{border-radius:14px!important}
.toast.error::before,.toast.is-error::before{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m9 9 6 6'/%3E%3Cpath d='m15 9-6 6'/%3E%3C/svg%3E")!important}
`;
  document.head.appendChild(style);
}
export {};
