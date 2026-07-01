function html(active){
  var icon=active?'check-square':'square';
  var color=active?'#159447':'#8a9690';
  var text=active?'เปิดใช้งาน':'ไม่ได้ใช้งาน';
  return '<i class="bi bi-'+icon+' admin-status-icon" style="color:'+color+'" role="img" title="'+text+'" aria-label="'+text+'"></i>';
}
function run(){
  document.querySelectorAll('#menuRows .badge,#tableRows .badge').forEach(function(badge){
    if(badge.getAttribute('data-status-icon'))return;
    var active=!badge.classList.contains('dark')&&badge.textContent.indexOf('ปิด')<0;
    badge.outerHTML=html(active);
  });
}
run();
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
