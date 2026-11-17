(() => {
"use strict";
const KEY="targetProDataV1";
const defaults={baseSalary:5000,workDays:26,dailyTarget:405,salaryDivisor:30,filesPerOT:60,otPayPerHour:0,leaveEntitlement:0,unusedLeaveMultiplier:3,fridayPaid:true,fridayTarget:false};
const INCENTIVE_SLABS=[
 [131,135,700],[136,140,800],[141,145,925],[146,150,1050],[151,155,1200],
 [156,160,1350],[161,165,1525],[166,170,1700],[171,175,1910],[176,180,2120],
 [181,185,2360],[186,190,2600],[191,195,2870],[196,200,3140],[201,205,3440],
 [206,210,3740],[211,215,4040],[216,220,4340],[221,225,4640],[226,230,4940]
];
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=n=>Number(n||0).toLocaleString("ar-EG",{maximumFractionDigits:2});
const dateISO=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`};
const today=()=>dateISO(new Date());
const uid=()=>`${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
let data=load();
function freshCycle(start=today(),settings=defaults){return{id:uid(),startDate:start,endDate:null,entries:[],closedAt:null,settingsSnapshot:{...settings}}}
function load(){
 try{
  const d=JSON.parse(localStorage.getItem(KEY));
  if(d&&d.settings&&d.current){
   d.settings={...defaults,...d.settings};
   d.current.entries=Array.isArray(d.current.entries)?d.current.entries:[];
   d.current.settingsSnapshot={...d.settings,...(d.current.settingsSnapshot||{})};
   d.archive=Array.isArray(d.archive)?d.archive:[];
   return d;
  }
 }catch(e){console.warn("تعذر تحميل بيانات Target Pro:",e)}
 const settings={...defaults};
 return{settings,theme:"light",current:freshCycle(today(),settings),archive:[]};
}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function notify(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove("show"),2400)}
function dayTarget(entry,settings=data.settings){if(entry.status==="absent"||entry.status==="leave"||entry.status==="holiday")return 0;if(entry.status==="friday"&&!settings.fridayTarget)return 0;return Number(settings.dailyTarget)||0}
function calcEntry(e,settings=data.settings){const ot=Number(e.otHours)||0;const extra=ot*(Number(settings.filesPerOT)||0);const target=dayTarget(e,settings);const base=Number(e.baseProduction)||0;return{target,base,extra,total:base+extra,variance:base-target,otHours:ot}}
function cycleStats(c,settings=c.settingsSnapshot||data.settings){
 const es=c.entries||[];let target=0,base=0,extra=0,ot=0,attendance=0,absence=0,leave=0,holidays=0,fridays=0,surplus=0,deficit=0;
 es.forEach(e=>{const x=calcEntry(e,settings);target+=x.target;base+=x.base;extra+=x.extra;ot+=x.otHours;if(e.status==="present")attendance++;if(e.status==="absent")absence++;if(e.status==="leave")leave++;if(e.status==="holiday")holidays++;if(e.status==="friday")fridays++;surplus+=Math.max(0,x.total-x.target);deficit+=Math.max(0,x.target-x.total)});
 const days=es.filter(e=>e.status==="present"||e.status==="absent"||e.status==="leave").length;
 const total=base+extra;return{target,base,extra,total,ot,attendance,absence,leave,holidays,fridays,surplus,deficit,days,achievement:target?total/target*100:0,avg:attendance?total/attendance:0};
}
function salary(c,settings=c.settingsSnapshot||data.settings){
 const s=cycleStats(c,settings), day=(Number(settings.baseSalary)||0)/(Number(settings.salaryDivisor)||30);
 const absentDeduction=s.absence*day;
 const unused=Math.max(0,(Number(settings.leaveEntitlement)||0)-s.leave);
 const leaveBonus=unused*day*(Number(settings.unusedLeaveMultiplier)||0);
 const otPay=s.ot*(Number(settings.otPayPerHour)||0);
 const extra=Number(c.manualAdditions)||0, deductions=Number(c.manualDeductions)||0;
 const fridayDeduction=(!settings.fridayPaid)?s.fridays*day:0;
 const monthlyTarget=(Number(settings.dailyTarget)||0)*(Number(settings.workDays)||0);
 const incentivePercent=monthlyTarget>0?(s.total/monthlyTarget)*100:0;
 const slab=INCENTIVE_SLABS.find(x=>incentivePercent>=x[0] && incentivePercent<=x[1]);
 const grossIncentive=slab?slab[2]:0;
 const qualityStatus=c.qualityStatus||"eligible";
 const incentiveDeduction=Math.min(grossIncentive,Math.max(0,Number(c.incentiveDeduction)||0));
 const incentive=qualityStatus==="cancelled"?0:Math.max(0,grossIncentive-(qualityStatus==="partial"?incentiveDeduction:0));
 const adminDeduction=Math.max(0,Number(c.adminDeduction)||0);
 const net=(Number(settings.baseSalary)||0)-absentDeduction-fridayDeduction+leaveBonus+otPay+extra-deductions+incentive-adminDeduction;
 return{base:Number(settings.baseSalary)||0,day,absentDeduction,fridayDeduction,unused,leaveBonus,otPay,extra,deductions,monthlyTarget,incentivePercent,slab,grossIncentive,qualityStatus,incentiveDeduction,incentive,adminDeduction,net};
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const statusNames={present:"حضور",absent:"غياب",leave:"عارضة مستخدمة",holiday:"إجازة",friday:"جمعة"};
function render(){
 const c=data.current,s=cycleStats(c),pay=salary(c);$("#cycleDates").textContent=`من ${c.startDate} · ${c.entries.length} سجل`;
 const dashboardTarget=(Number(data.settings.dailyTarget)||0)*(Number(data.settings.workDays)||0);
 const dashboardAchievement=dashboardTarget?s.total/dashboardTarget*100:0;
 $("#totalProduction").textContent=fmt(s.total);$("#totalTarget").textContent=fmt(dashboardTarget);$("#remainingTarget").textContent=fmt(Math.max(0,dashboardTarget-s.total));
 $("#achievementText").textContent=`${fmt(dashboardAchievement)}%`;$("#achievementBar").style.width=`${Math.min(100,dashboardAchievement)}%`;
 $("#totalSurplus").textContent=fmt(s.surplus);$("#totalOT").textContent=fmt(s.ot);$("#attendanceDays").textContent=fmt(s.attendance);$("#salaryNet").textContent=fmt(pay.net);
 $("#salaryPageNet").textContent=`${fmt(pay.net)} ج.م`;

 $("#salaryBreakdown").innerHTML=breakdown([
 ["المرتب الأساسي",pay.base],["قيمة اليوم",pay.day],["خصم الغياب", -pay.absentDeduction],["خصم أيام الجمعة", -pay.fridayDeduction],["مكافأة العارضة غير المستخدمة",pay.leaveBonus],["مقابل الساعات الإضافية",pay.otPay],["حافز التارجت الشهري",pay.incentive],["إضافات يدوية",pay.extra],["خصومات إضافية",-pay.deductions],["الخصم الإداري",-pay.adminDeduction],["صافي المرتب المتوقع",pay.net,true]
 ]);
 $("#incentiveAmount").textContent=`${fmt(pay.incentive)} جنيه`;
 $("#incentiveRange").textContent=`نسبة الإنجاز ${fmt(pay.incentivePercent)}% · التارجت الشهري ${fmt(pay.monthlyTarget)} ملف`;
 $("#incentiveBadge").textContent=pay.qualityStatus==="cancelled"?"ملغي بسبب الجودة":pay.slab?"ضمن شريحة مستحقة":"لم يصل للشريحة الأولى";
 $("#incentiveBreakdown").innerHTML=breakdown([["الحافز قبل مراجعة الجودة",pay.grossIncentive],["خصم الجودة",pay.qualityStatus==="partial"?-pay.incentiveDeduction:0],["الحافز بعد الجودة",pay.incentive]]);
 $("#incentiveSlabsTable").innerHTML=`<table class="slabs-table"><thead><tr><th>نسبة الإنجاز</th><th>الحافز</th></tr></thead><tbody>${INCENTIVE_SLABS.map(x=>`<tr><td>${x[0]}% – ${x[1]}%</td><td>${fmt(x[2])} ج.م</td></tr>`).join("")}</tbody></table>`;
 $("#qualityStatus").value=pay.qualityStatus;
 $("#incentiveDeduction").value=Number(c.incentiveDeduction)||0;
 $("#adminDeduction").value=Number(c.adminDeduction)||0;
 $("#incentiveDeductionWrap").style.display=pay.qualityStatus==="partial"?"block":"none";
 renderEntries();renderArchive();renderCharts();renderReports();
}
function breakdown(rows){return rows.map(([n,v,total])=>`<div class="break-row ${total?"total":""}"><span>${n}</span><b>${fmt(v)} ج.م</b></div>`).join("")}
function renderEntries(){
 const el=$("#entriesList"),es=[...data.current.entries].sort((a,b)=>b.date.localeCompare(a.date));
 el.innerHTML=es.length?es.map(e=>{const x=calcEntry(e);return `<article class="record-card"><div class="record-main"><strong>${esc(e.date)} · ${statusNames[e.status]||"حضور"}</strong><small>أساسي ${fmt(x.base)} · إضافي ${fmt(x.extra)} ملف · ${fmt(x.otHours)} ساعة</small><div class="record-actions"><button class="mini-btn" data-edit="${e.id}">تعديل</button><button class="mini-btn" data-delete="${e.id}">حذف</button></div></div><div class="record-value"><b>${fmt(x.total)}</b><small>من ${fmt(x.target)} ملف</small></div></article>`}).join(""):`<div class="empty-state">لا توجد سجلات بعد<br>ابدأ بتسجيل إنتاجك اليومي.</div>`;
}
function renderArchive(){
 const el=$("#archiveList");el.innerHTML=data.archive.length?[...data.archive].reverse().map(c=>{const s=cycleStats(c,c.settingsSnapshot||data.settings),p=salary(c,c.settingsSnapshot||data.settings);return `<article class="record-card"><div class="record-main"><strong>${esc(c.startDate)} ← ${esc(c.endDate||"—")}</strong><small>${fmt(s.total)} إنتاج · ${fmt(s.achievement)}% إنجاز · ${fmt(s.ot)} ساعة إضافية</small><div class="record-actions"><button class="mini-btn" data-detail="${c.id}">عرض التفاصيل</button></div></div><div class="record-value"><b>${fmt(p.net)}</b><small>جنيه متوقع</small></div></article>`}).join(""):`<div class="empty-state">الأرشيف فارغ حاليًا.<br>ستظهر الدورات هنا بعد إغلاقها.</div>`;
}
function bars(c,container){const es=[...c.entries].sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);if(!es.length){container.innerHTML='<p class="muted">سجّل إنتاجك لعرض الرسم البياني</p>';return}const max=Math.max(1,...es.map(e=>calcEntry(e).total),...es.map(e=>calcEntry(e).target));container.innerHTML=es.map(e=>{const x=calcEntry(e);return `<div class="bar-group" title="${e.date}: ${fmt(x.total)} / ${fmt(x.target)}"><div class="bar" style="height:${Math.max(2,x.total/max*100)}%"></div><span class="bar-label">${e.date.slice(5)}</span></div>`}).join("")}
function renderCharts(){bars(data.current,$("#productionChart"));bars(data.current,$("#reportChart"))}
function renderReports(){const s=cycleStats(data.current),es=data.current.entries;$("#avgProduction").textContent=fmt(s.avg);$("#totalDeficit").textContent=fmt(s.deficit);$("#reportOT").textContent=fmt(s.ot);const best=es.reduce((a,b)=>!a||calcEntry(b).total>calcEntry(a).total?b:a,null);$("#bestDay").textContent=best?best.date.slice(5):"—";$("#bestDayValue").textContent=best?`${fmt(calcEntry(best).total)} ملف`:"0 ملف";$("#reportSummary").innerHTML=breakdown([["إجمالي الإنتاج الأساسي",s.base],["إنتاج الساعات الإضافية",s.extra],["إجمالي الإنتاج",s.total],["إجمالي التارجت",s.target],["نسبة الإنجاز",s.achievement],["أيام الحضور",s.attendance],["أيام الغياب",s.absence],["أيام العارضة المستخدمة",s.leave],["إجمالي الساعات الإضافية",s.ot],["نسبة تحقيق التارجت الشهري",salary(data.current).incentivePercent],["حافز الشريحة",salary(data.current).incentive]])}
function navigate(id){$$(".page").forEach(p=>p.classList.toggle("active",p.id===id));$$(".nav-item").forEach(b=>b.classList.toggle("selected",b.dataset.page===id));if(id==="reportsPage")renderReports();window.scrollTo({top:0,behavior:"smooth"})}
function openEntry(entry){const f=$("#entryForm");f.reset();f.elements.entryId.value=entry?.id||"";f.elements.date.value=entry?.date||today();f.elements.status.value=entry?.status||"present";f.elements.baseProduction.value=entry?.baseProduction??0;f.elements.otHours.value=entry?.otHours??0;f.elements.notes.value=entry?.notes||"";$("#entryModalTitle").textContent=entry?"تعديل سجل الإنتاج":"إضافة إنتاج يومي";previewEntry();$("#entryModal").showModal()}
function previewEntry(){const f=$("#entryForm"),h=Number(f.elements.otHours.value)||0;$("#entryPreview").textContent=`التارجت الأساسي: ${fmt(data.settings.dailyTarget)} ملف · إنتاج إضافي: ${fmt(h*data.settings.filesPerOT)} ملف · التارجت لا يتغير بالساعات الإضافية`}
function closeDialogs(){ $$("dialog[open]").forEach(d=>d.close()) }
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
$$("[data-open]").forEach(b=>b.addEventListener("click",()=>openEntry()));
$$("[data-close]").forEach(b=>b.addEventListener("click",closeDialogs));
$("#entryForm").addEventListener("input",e=>{if(e.target.name==="otHours")previewEntry()});
$("#entryForm").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.entryId.value;const entry={id:id||uid(),date:f.elements.date.value,status:f.elements.status.value,baseProduction:Number(f.elements.baseProduction.value)||0,otHours:Number(f.elements.otHours.value)||0,notes:f.elements.notes.value};if(!entry.date){notify("اختر التاريخ");return}const duplicate=data.current.entries.find(x=>x.date===entry.date&&x.id!==id);if(duplicate&&!confirm("يوجد سجل لهذا التاريخ. هل تريد استبداله؟"))return;if(duplicate)data.current.entries=data.current.entries.filter(x=>x.id!==duplicate.id);if(id)data.current.entries=data.current.entries.map(x=>x.id===id?entry:x);else data.current.entries.push(entry);save();closeDialogs();render();notify("تم حفظ سجل اليوم")});
$("#entriesList").addEventListener("click",e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit){const x=data.current.entries.find(x=>x.id===edit.dataset.edit);openEntry(x)}if(del&&confirm("هل تريد حذف سجل هذا اليوم نهائيًا؟")){data.current.entries=data.current.entries.filter(x=>x.id!==del.dataset.delete);save();render();notify("تم حذف السجل")}});
function startNewCycleDialog(){const s=cycleStats(data.current),p=salary(data.current);$("#cycleSummary").innerHTML=`الإنتاج: <strong>${fmt(s.total)}</strong> ملف<br>التارجت الشهري المرجعي: <strong>${fmt(p.monthlyTarget)}</strong> ملف<br>نسبة الإنجاز: <strong>${fmt(p.incentivePercent)}%</strong><br>الحافز قبل الجودة: <strong>${fmt(p.grossIncentive)} جنيه</strong><br>الساعات الإضافية: <strong>${fmt(s.ot)}</strong><br>الحضور: <strong>${s.attendance}</strong> · الغياب: <strong>${s.absence}</strong> · العارضة: <strong>${s.leave}</strong><br>المرتب المتوقع: <strong>${fmt(p.net)} جنيه</strong>`;$("#cycleForm").elements.startDate.value="";$("#cycleModal").showModal()}
$("#newCycleBtn").addEventListener("click",startNewCycleDialog);
$("#archiveNewCycleBtn").addEventListener("click",startNewCycleDialog);
$("#cycleForm").addEventListener("submit",e=>{e.preventDefault();const start=e.currentTarget.elements.startDate.value;if(!start){notify("يجب اختيار تاريخ بداية الدورة");return}if(!confirm("سيتم حفظ الدورة الحالية في الأرشيف وإنشاء دورة جديدة. هل تؤكد؟"))return;if(start<data.current.startDate){if(!confirm("تاريخ البداية أقدم من بداية الدورة الحالية. هل تريد المتابعة؟"))return}const old=data.current;old.endDate=new Date(new Date(start+"T00:00:00").getTime()-86400000).toISOString().slice(0,10);old.closedAt=new Date().toISOString();old.settingsSnapshot={...data.settings};data.archive.push(old);data.current=freshCycle(start,data.settings);save();closeDialogs();render();navigate("dashboardPage");notify("تم حفظ الدورة وبدء دورة جديدة")});
$("#archiveList").addEventListener("click",e=>{const b=e.target.closest("[data-detail]");if(!b)return;const c=data.archive.find(x=>x.id===b.dataset.detail);if(!c)return;const s=cycleStats(c,c.settingsSnapshot||data.settings),p=salary(c,c.settingsSnapshot||data.settings);$("#detailTitle").textContent=`الدورة ${c.startDate} – ${c.endDate}`;$("#detailContent").innerHTML=`<div class="breakdown-card">${breakdown([["الإنتاج",s.total],["التارجت",s.target],["الإنجاز %",s.achievement],["الساعات الإضافية",s.ot],["الحضور",s.attendance],["الغياب",s.absence],["العارضة",s.leave],["المرتب المتوقع",p.net]])}</div><h3>السجلات اليومية</h3>${c.entries.map(e=>{const x=calcEntry(e,c.settingsSnapshot||data.settings);return `<div class="break-row"><span>${esc(e.date)} · ${statusNames[e.status]}</span><b>${fmt(x.total)} / ${fmt(x.target)}</b></div>`}).join("")||"لا توجد سجلات"}`;$("#detailModal").showModal()});
function populateSettings(){const f=$("#settingsForm");Object.entries(data.settings).forEach(([k,v])=>{const x=f.elements[k];if(x){if(x.type==="checkbox")x.checked=!!v;else x.value=v}})}
$("#settingsForm").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,next={...data.settings};Object.keys(next).forEach(k=>{const x=f.elements[k];if(x)next[k]=x.type==="checkbox"?x.checked:Number(x.value)});if(next.salaryDivisor<=0||next.workDays<=0){notify("تحقق من قيم أيام العمل وقاسم المرتب");return}data.settings=next;data.current.settingsSnapshot={...next};save();render();notify("تم حفظ الإعدادات")});

$("#themeBtn").addEventListener("click",()=>{data.theme=data.theme==="dark"?"light":"dark";applyTheme();save()});
function applyTheme(){document.body.classList.toggle("dark",data.theme==="dark");$("#themeBtn").textContent=data.theme==="dark"?"☀":"◐"}
$("#backupBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});download(blob,`target-pro-backup-${today()}.json`)});
$("#restoreBtn").addEventListener("click",()=>$("#restoreFile").click());
$("#restoreFile").addEventListener("change",async e=>{
 const file=e.target.files[0]; if(!file)return;
 try{
  const imported=JSON.parse(await file.text());
  if(!imported.settings||!imported.current||!Array.isArray(imported.archive))throw Error("invalid backup");
  if(!confirm("سيتم استبدال البيانات الحالية بالنسخة المختارة. هل تريد المتابعة؟"))return;
  data=imported; save(); populateSettings(); applyTheme(); render(); notify("تم استيراد النسخة الاحتياطية بنجاح");
 }catch(err){notify("ملف النسخة الاحتياطية غير صالح");}
 e.target.value="";
});
function download(blob,name){const a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("#wipeBtn").addEventListener("click",()=>{
 if(!confirm("تحذير: سيتم حذف كل الدورات والسجلات والإعدادات. هل أنت متأكد؟"))return;
 if(!confirm("تأكيد أخير: لا يمكن التراجع عن مسح البيانات. هل تم تصدير نسخة احتياطية؟"))return;
 localStorage.removeItem(KEY); data={settings:{...defaults},theme:"light",current:freshCycle(today(),{...defaults}),archive:[]};
 save(); populateSettings(); applyTheme(); render(); notify("تم مسح البيانات");
});
$("#printBtn").addEventListener("click",()=>{navigate("reportsPage");window.print()});
$("#exportCsvBtn").addEventListener("click",()=>{const rows=[["التاريخ","الحالة","التارجت","الإنتاج الأساسي","الساعات الإضافية","إنتاج إضافي","الإجمالي","الفرق"],...data.current.entries.map(e=>{const x=calcEntry(e);return[e.date,statusNames[e.status],x.target,x.base,x.otHours,x.extra,x.total,x.variance]})];const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");download(new Blob([csv],{type:"text/csv;charset=utf-8"}),`target-pro-report-${today()}.csv`)});
$("#qualityStatus").addEventListener("change",()=>{$("#incentiveDeductionWrap").style.display=$("#qualityStatus").value==="partial"?"block":"none"});
$("#saveQualityBtn").addEventListener("click",()=>{data.current.qualityStatus=$("#qualityStatus").value;data.current.incentiveDeduction=Number($("#incentiveDeduction").value)||0;data.current.adminDeduction=Number($("#adminDeduction").value)||0;save();render();notify("تم حفظ تقييم الجودة والحافز")});
populateSettings();applyTheme();render();
if("serviceWorker"in navigator&&location.protocol!=="file:")window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
})();