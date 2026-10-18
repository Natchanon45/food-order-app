import {test,expect} from "@playwright/test";
import {createServer} from "vite";

let server;
let url;
test.use({launchOptions:{executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}});
test.beforeAll(async()=>{
 server=await createServer({configFile:false,root:process.cwd(),logLevel:"silent",server:{host:"127.0.0.1",port:0}});
 await server.listen();
 url="http://127.0.0.1:"+server.httpServer.address().port+"/tests/react-parity/fixtures/pos-users-button-layout.html";
});
test.afterAll(async()=>{await server?.close()});

for(const width of [390,1280]){
 test("POS Users icons stay centered/gapped and statuses stay distinct at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:880});
  await page.goto(url,{waitUntil:"networkidle"});
  for(const selector of ["#add","#edit","#save","#select","#clear"]){
   const result=await page.locator(selector).evaluate(button=>{
    const i=button.querySelector(".bi");
    const label=button.querySelector("span");
    const b=button.getBoundingClientRect();
    const icon=i.getBoundingClientRect();
    const text=label.getBoundingClientRect();
    return {dy:Math.abs(icon.y+icon.height/2-(b.y+b.height/2)),gap:text.x-(icon.x+icon.width),width:b.width,iconVisible:icon.width>5};
   });
   expect(result.iconVisible,selector).toBe(true);
   expect(result.dy,selector+" icon Y offset").toBeLessThanOrEqual(1.05);
   expect(result.gap,selector+" icon-to-label gap").toBeGreaterThanOrEqual(7);
  }
  const colors=await page.evaluate(()=>{
    const select=getComputedStyle(document.getElementById("select"));
    const clear=getComputedStyle(document.getElementById("clear"));
    return {select:select.color,clear:clear.color,sbg:select.backgroundColor,cbg:clear.backgroundColor};
  });
  expect(colors.select).not.toEqual(colors.clear);
  expect(colors.sbg).not.toEqual(colors.cbg);
  await expect(page.locator("#hiddenDelete")).toBeHidden();
  const toast=page.locator("#posUsersToast");
  await expect(page.getByRole("status")).toContainText("บันทึกบทบาทสำเร็จ");
  const toastGeometry=await toast.evaluate(el=>{
    const box=el.getBoundingClientRect();
    const icon=el.querySelector(".app-toast-icon");
    return {
      bg:getComputedStyle(el).backgroundColor, text:getComputedStyle(el).color,
      iconColor:getComputedStyle(icon).color,z:Number(getComputedStyle(el).zIndex),
      centerX:box.x+box.width/2, centerY:box.y+box.height/2,
      parent:el.parentElement?.tagName,
    };
  });
  expect(toastGeometry.bg).toBe("rgb(17, 17, 17)");
  expect(toastGeometry.text).toBe("rgb(255, 255, 255)");
  expect(toastGeometry.iconColor).toBe("rgb(34, 197, 94)");
  expect(toastGeometry.z).toBe(2147483647);
  expect(toastGeometry.parent).toBe("BODY");
  expect(Math.abs(toastGeometry.centerX-width/2)).toBeLessThanOrEqual(1);
  expect(Math.abs(toastGeometry.centerY-880*.75)).toBeLessThanOrEqual(1);
  await toast.evaluate(el=>{
    el.classList.replace("success","error");
    el.querySelector(".app-toast-icon .bi").className="bi bi-x-circle app-icon";
    el.querySelector(".app-toast-message").textContent="บันทึกบทบาทไม่สำเร็จ";
    el.setAttribute("role","alert");
  });
  await expect(page.getByRole("alert")).toContainText("บันทึกบทบาทไม่สำเร็จ");
  expect(await toast.locator(".app-toast-icon").evaluate(el=>getComputedStyle(el).color)).toBe("rgb(239, 68, 68)");
  expect(await toast.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(17, 17, 17)");
  // The shared Toast layer manager must keep Toast above native modal top-layer.
  await page.evaluate(()=>document.querySelector("#testDialog").showModal());
  await expect.poll(()=>page.evaluate(()=>{
    const el=document.querySelector("#posUsersToast");
    return el?.matches(":popover-open") && el?.parentElement?.id === "testDialog";
  })).toBe(true);
  // Toast deliberately uses pointer-events:none: elementFromPoint must not
  // be used to check visibility. Being an open popover above the modal is the
  // browser Top Layer contract.
  expect(await toast.evaluate(el=>el.matches(":popover-open"))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 });
}
