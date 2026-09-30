import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ParityFooter } from "@/components/ParityFooter";

export function ParityLayout({ header, children, hideFooter = false }) {
  return (
    <>
      <header className="app-header">
        {header}
        <LocaleSwitcher />
      </header>
      {children}
      {hideFooter ? null : <ParityFooter />}
    </>
  );
}
