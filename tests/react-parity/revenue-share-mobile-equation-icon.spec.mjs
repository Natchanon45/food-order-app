import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const jsx=readFileSync("react-app/src/pages/RevenueShareReportPage.jsx","utf8");
const css=readFileSync("react-app/public/parity/css/revenue-share-report.css","utf8");
test("mobile stacked revenue equation uses actual Bootstrap arrow-down icon, not emoji",()=>{
 assert.match(jsx, /report-equation-arrow-desktop/);
 assert.match(jsx, /bi bi-arrow-right report-equation-arrow-desktop/);
 assert.match(jsx, /bi bi-arrow-down report-equation-arrow-mobile/);
 assert.match(css,/report-equation-arrow-mobile \{ display: none; \}/);
 assert.match(css,/@media \(max-width: 700px\) \{[\s\S]*report-equation-arrow-desktop \{ display: none; \}[\s\S]*report-equation-arrow-mobile \{ display: inline-block; \}/);
 assert.match(jsx,/report-equation-operator">×<\/b>/);
 assert.match(jsx,/report-equation-operator">=<\/b>/);
});

test("computed arrow icon direction matches responsive equation",async()=>{
 const {chromium}=await import("@playwright/test");
 const browser=await chromium.launch({headless:true,executablePath:process.platform==="darwin"?"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome":chromium.executablePath()});
 try{
  for(const width of [390,440,768,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><main class="revenue-share-dashboard"><b class="report-equation-operator"><i class="bi bi-arrow-right report-equation-arrow-desktop"></i><i class="bi bi-arrow-down report-equation-arrow-mobile"></i></b></main>');
    const result=await page.evaluate(()=>({
      right:getComputedStyle(document.querySelector(".report-equation-arrow-desktop")).display,
      down:getComputedStyle(document.querySelector(".report-equation-arrow-mobile")).display,
    }));
    assert.equal(result.right,width<=700?"none":"inline","right icon at "+width);
    assert.equal(result.down,width<=700?"inline-block":"none","down icon at "+width);
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});
