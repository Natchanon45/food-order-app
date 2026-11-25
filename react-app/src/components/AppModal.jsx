import {useEffect,useId,useRef} from "react";

/**
 * LUKKAJA's single new-modal contract: Header / scrollable Body / Footer.
 * Legacy native dialog/role dialog JSX is decorated with the same layout by
 * ui/app-modal-standard.js without changing any pre-existing workflows.
 *
 * Parent owns the open state. Footer accepts the real Save/Cancel/etc actions.
 * Neither the modal nor its styling triggers a submit, approval, or payment.
 */
export function AppModal({
  open,title,description,children,footer,onClose,busy=false,
  width=600,className="",label,id
}) {
  const dialogRef=useRef(null);
  const titleId=useId(),descriptionId=useId();

  useEffect(()=>{
    const dialog=dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    return ()=>{if (dialog.open) dialog.close();};
  },[open]);

  const size=Math.max(300,Math.min(920,Number(width)||600));
  return <dialog ref={dialogRef} id={id}
    className={"app-modal "+className}
    data-app-modal="standard" aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={description?descriptionId:undefined}
    aria-label={label}
    style={{"--app-modal-width":String(size)+"px"}}
    onCancel={event=>{event.preventDefault();if(!busy)onClose?.();}}>
    <div className="app-modal__frame" data-app-modal-frame="true">
      <header className="app-modal__header" data-app-modal-header="true">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description?<p id={descriptionId}>{description}</p>:null}
        </div>
        <button type="button" aria-label="ปิดหน้าต่าง" disabled={busy}
          onClick={()=>onClose?.()}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="app-modal__body" data-app-modal-body="true">
        {children}
      </div>
      <footer className="app-modal__footer" data-app-modal-footer="true">
        {footer??<button type="button" disabled={busy}
          onClick={()=>onClose?.()}>ปิด</button>}
      </footer>
    </div>
  </dialog>;
}
