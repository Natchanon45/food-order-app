import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const css = readFileSync("react-app/public/parity/css/revenue-share-report.css", "utf8");
const html = [
'<!doctype html><html lang="th"><meta charset="utf-8">',
'<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font:14px system-ui}',
'.card{border:1px solid #dce8e0}.input{border:1px solid #cedbd0;border-radius:8px}',
css,'</style>',
'<main class="revenue-share-dashboard" style="width:min(968px,calc(100% - 28px));margin:0 auto">',
'<section class="card report-filter-card">',
'<div class="report-section-heading"><div>',
'<h2>ช่วงเวลารายงาน</h2>',
'<p>เลือกรายวัน รายเดือน รายปี หรือกำหนดช่วงเอง</p>',
'<p>รอบคิดค่าบริการปัจจุบัน: 18 ต.ค. 69 - 17 พ.ย. 69</p>',
'<p>วันที่สมัคร/เปิดใช้งานครั้งแรก: 18 มิ.ย. 69</p>',
'</div></div>',
'<div class="report-period-tabs">',
'<button>รายวัน</button><button>รายเดือน</button><button>รายปี</button><button class="active">กำหนดเอง</button>',
'</div>',
'<div class="report-period-controls"><div class="report-custom-period">',
'<label><span>วันที่เริ่มต้น</span><input class="input" type="date" value="2026-10-31"/></label>',
'<label><span>วันที่สิ้นสุด</span><input class="input" type="date" value="2026-10-31"/></label>',
'</div></div><button class="report-filter-refresh">⟳</button></section></main></html>',
].join('');

test("custom date controls shift left and center independently of label on desktop", async () => {
 const browser = await chromium.launch({
   headless: true,
   executablePath: process.platform === "darwin"
     ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
     : chromium.executablePath(),
 });
 try {
  for (const width of [1648,1366,1280,1024,390]) {
   const page = await browser.newPage({viewport:{width,height:900}});
   try {
    await page.setContent(html);
    const r = await page.evaluate(() => {
     const rect = q => {
      const a = document.querySelector(q).getBoundingClientRect();
      return {left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height,centerY:(a.top+a.bottom)/2};
     };
     return {
      outer:rect(".report-filter-card"), heading:rect(".report-section-heading"),
      tabs:rect(".report-period-tabs"),controls:rect(".report-period-controls"),
      group:rect(".report-custom-period"),
      first:rect(".report-custom-period label:first-child input"),
      last:rect(".report-custom-period label:last-child input"),
      label:rect(".report-custom-period label:first-child span"),
      refresh:rect(".report-filter-refresh"),
      dateGroupStyle:(() => {
        const st=getComputedStyle(document.querySelector(".report-custom-period"));
        return {borderWidth:st.borderTopWidth,borderStyle:st.borderTopStyle,borderRadius:st.borderRadius,background:st.backgroundColor};
      })(),
      documentWidth:document.documentElement.scrollWidth,
     };
    });
    console.log("LAYOUT_CHECK",width,{shift:r.tabs.left-r.outer.left,
     refreshRightGap:r.outer.right-r.refresh.right,dateGroupWidth:r.group.width,
     rightInputToRefresh:r.refresh.left-r.last.right,
     dateCenters:[r.first.centerY,r.last.centerY],tabCenter:r.tabs.centerY});
    assert.ok(r.documentWidth<=width+1,"no document overflow "+width);
    if(width>=1280){
     assert.ok(r.tabs.left-r.outer.left<345,"tabs shift left "+width);
     assert.ok(r.heading.right<=r.tabs.left,"heading/tab no overlap "+width);
     assert.ok(r.tabs.right<=r.controls.left+3,"tab/date no overlap "+width);
     assert.ok(r.controls.right<=r.refresh.left+3,"date/refresh no overlap "+width);
     assert.ok(r.refresh.right<=r.outer.right+1,"refresh inside card "+width);
     assert.ok(r.outer.right-r.refresh.right<=19,"refresh restored to original far-right edge "+width);
     assert.ok(r.group.width>=310,"date group expands into available space "+width);
     assert.ok(r.refresh.left-r.last.right<=18,"final date field almost reaches refresh "+width);
     assert.equal(r.dateGroupStyle.borderStyle,"solid");
     assert.equal(r.dateGroupStyle.borderWidth,"1px");
     assert.ok(parseFloat(r.dateGroupStyle.borderRadius)>=10,"date inputs have grouped border");
     for(const input of [r.first,r.last]){
      assert.ok(Math.abs(input.centerY-r.tabs.centerY)<5,"date input centered independently "+width);
     }
     assert.ok(r.label.bottom<=r.first.top,"label floats above date "+width);
    } else {
     assert.ok(r.controls.top>=r.tabs.bottom-1,"responsive stacked controls "+width);
    }
   } finally {await page.close();}
  }
 } finally {await browser.close();}
});
