function html(active){
  var icon=active?'check-square':'square';
  var color=active?'#159447':'#8a9690';
  var text=active?'ใช้งาน':'ไม่ได้ใช้งาน';
  return '<span style="display:inline-flex;align-items:center;gap:6px;color:'+color+';font-weight:800"><i class="bi bi-'+icon+'"></i><span>'+text+'</span></span>';
}
function run(){
  document.querySelectorAll('#menuRows .badge,#tableRows .badge').forEach(function(badge){
    if(badge.getAttribute('data-status-icon'))return;
    var active=!badge.classList.contains('dark')&&badge.textContent.indexOf('ปิด')<0;
    badge.setAttribute('data-status-icon','1');
    badge.innerHTML=html(active);
  });
}
run();
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
