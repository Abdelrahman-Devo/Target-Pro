(() => {
  "use strict";
  const DEFAULTS = { salary: 5000, target: 405, workDays: 26, ardaMultiplier: 3, fridayMode: "include", ardaTargetMode: "subtract", ardaUnused: 0, extraDeductions: 0 };
  const $ = id => document.getElementById(id);
  const load = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
  let settings = { ...DEFAULTS, ...load("targetPro.settings", {}) };
  let records = load("targetPro.records", {});
  let overtime = load("targetPro.overtime", {});
  const OVERTIME_FILES_PER_HOUR = 60;
  let month = new Date().toISOString().slice(0, 7);
  let editingDate = null;
  const save = () => { localStorage.setItem("targetPro.settings", JSON.stringify(settings)); localStorage.setItem("targetPro.records", JSON.stringify(records)); localStorage.setItem("targetPro.overtime", JSON.stringify(overtime)); };
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = value => Math.round(number(value) * 100) / 100;
  const nf = value => fmt(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const money = value => `${nf(value)} ج`;
  const monthEntries = () => Object.entries(records).filter(([date]) => date.startsWith(month)).sort((a,b) => b[0].localeCompare(a[0]));
  const countFridays = () => {
    const [year, mon] = month.split("-").map(Number);
    let count = 0;
    for (let day = 1; day <= new Date(year, mon, 0).getDate(); day++) if (new Date(year, mon - 1, day).getDay() === 5) count++;
    return count;
  };
  const calc = () => {
    const entries = monthEntries();
    const values = entries.map(([, value]) => number(value));
    const done = values.reduce((sum, value) => sum + value, 0);
    const overtimeHours = entries.reduce((sum, [date]) => sum + number(overtime[date]), 0);
    const overtimeFiles = overtimeHours * OVERTIME_FILES_PER_HOUR;
    const fridays = countFridays();
    const fridayDays = settings.fridayMode === "include" ? fridays : 0;
    const ardaDeduction = settings.ardaTargetMode === "subtract" ? number(settings.ardaUnused) * number(settings.target) : 0;
    const target = Math.max(0, (number(settings.workDays) + fridayDays) * number(settings.target) - ardaDeduction + overtimeFiles);
    const percent = target ? done / target * 100 : 0;
    const best = values.length ? Math.max(...values) : 0;
    const average = values.length ? done / values.length : 0;
    const today = new Date().toISOString().slice(0,10);
    const todayValue = records[today];
    const todayTarget = number(settings.target) + number(overtime[today]) * OVERTIME_FILES_PER_HOUR;
    const dayValue = number(settings.salary) / 30;
    const bonus = number(settings.ardaUnused) * number(settings.ardaMultiplier) * dayValue;
    const gross = number(settings.salary) + bonus;
    const net = gross - number(settings.extraDeductions);
    return { done, target, remaining: Math.max(0,target-done), percent, best, average, fridays, todayValue, todayTarget, overtimeHours, overtimeFiles, bonus, gross, net, dayValue, days: values.length };
  };
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function safeDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString("ar-EG", { day:"numeric", month:"short", year:"numeric" }); }
  function renderList(targetId, entries, limit) {
    const el = $(targetId), list = limit ? entries.slice(0, limit) : entries;
    if (!list.length) { el.innerHTML = '<div class="empty">لا توجد تسجيلات لهذا الشهر حتى الآن.</div>'; return; }
    el.innerHTML = list.map(([date, value]) => {
      const hours = number(overtime[date]);
      const dailyTarget = number(settings.target) + hours * OVERTIME_FILES_PER_HOUR;
      const diff = number(value) - dailyTarget;
      const status = diff >= 0 ? `زيادة ${nf(diff)}` : `عجز ${nf(Math.abs(diff))}`;
      return `<div class="record"><div><div class="record-date">${safeDate(date)}</div><div class="record-sub">${status} عن تارجت ${nf(dailyTarget)} ملف · ${nf(hours)} ساعة إضافية</div></div><div><div class="record-value">${nf(value)} ملف</div>${limit ? "" : `<div class="record-actions"><button class="mini-btn" data-edit="${date}">تعديل</button><button class="mini-btn" data-delete="${date}">حذف</button></div>`}</div></div>`;
    }).join("");
  }
  function render() {
    const c = calc(), entries = monthEntries();
    $("monthTitle").textContent = `ملخص ${month}`;
    $("doneTotal").textContent = nf(c.done); $("targetTotal").textContent = nf(c.target);
    $("remainingTotal").textContent = nf(c.remaining); $("achievementLabel").textContent = `${nf(c.percent)}%`;
    $("progressFill").style.width = `${Math.min(100,c.percent)}%`;
    $("averageDaily").textContent = nf(c.average); $("workDaysCount").textContent = c.days;
    $("bestDay").textContent = c.days ? nf(c.best) : "—"; $("fridayCount").textContent = c.fridays;
    $("todayDelta").textContent = c.todayValue === undefined ? "—" : `${c.todayValue - c.todayTarget >= 0 ? "+" : ""}${nf(c.todayValue-c.todayTarget)}`;
    $("todayDelta").className = c.todayValue === undefined ? "" : (c.todayValue >= c.todayTarget ? "positive" : "negative");
    $("salaryExpected").textContent = money(c.net); $("salaryBase").textContent = money(settings.salary);
    $("ardaBonus").textContent = money(c.bonus); $("salaryDeductions").textContent = money(settings.extraDeductions);
    $("salaryNet").textContent = money(c.net);
    $("salaryArdaCount").value = settings.ardaUnused; $("extraDeductions").value = settings.extraDeductions;
    $("reportMonth").textContent = month; $("reportDone").textContent = nf(c.done);
    $("reportTarget").textContent = nf(c.target); $("reportPercent").textContent = `${nf(c.percent)}%`;
    $("reportAverage").textContent = nf(c.average); $("reportDays").textContent = c.days;
    $("reportFridays").textContent = c.fridays; $("reportBest").textContent = c.days ? nf(c.best) + " ملف" : "—";
    $("reportSalary").textContent = money(c.net);
    $("reportOvertimeHours").textContent = nf(c.overtimeHours); $("reportOvertimeFiles").textContent = nf(c.overtimeFiles); $("recordsCount").textContent = `${entries.length} تسجيل`;
    renderList("recentList", entries, 4); renderList("allRecords", entries);
    const today = new Date().toISOString().slice(0,10);
    $("todayDate").value = $("todayDate").value || today; $("entryDate").value = editingDate || today;
    $("todayProduction").value = records[$("todayDate").value] ?? "";
    $("todayOvertime").value = overtime[$("todayDate").value] ?? 0;
    $("todayTargetPreview").textContent = `${nf(number(settings.target) + number(overtime[$("todayDate").value]) * OVERTIME_FILES_PER_HOUR)} ملف`;
  }
  function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
    document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === pageId));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function edit(date) {
    editingDate = date; $("entryDate").value = date; $("entryValue").value = records[date]; $("entryOvertime").value = overtime[date] ?? 0;
    $("entryFormTitle").textContent = "تعديل إنتاج"; $("saveEntryBtn").textContent = "حفظ التعديل";
    $("cancelEditBtn").hidden = false; showPage("productionPage");
  }
  function cancelEdit() {
    editingDate = null; $("entryFormTitle").textContent = "إضافة إنتاج";
    $("saveEntryBtn").textContent = "حفظ اليوم"; $("cancelEditBtn").hidden = true;
    $("entryDate").value = new Date().toISOString().slice(0,10); $("entryValue").value = ""; $("entryOvertime").value = 0;
  }
  function saveRecord(date, value, hours) {
    if (!date || !Number.isInteger(value) || value < 0) { toast("أدخل تاريخاً وعدداً صحيحاً من الملفات."); return false; }
    if (!Number.isInteger(hours) || hours < 0) { toast("أدخل عدد ساعات إضافية صحيحًا."); return false; }
    records[date] = value; if (hours > 0) overtime[date] = hours; else delete overtime[date]; save(); render(); return true;
  }
  $("saveTodayBtn").addEventListener("click", () => {
    const date = $("todayDate").value, raw = $("todayProduction").value, hours = Number($("todayOvertime").value || 0);
    if (raw === "" || !saveRecord(date, Number(raw), hours)) return;
    toast("تم حفظ إنتاج اليوم بنجاح.");
  });
  $("saveEntryBtn").addEventListener("click", () => {
    const date = $("entryDate").value, raw = $("entryValue").value, hours = Number($("entryOvertime").value || 0);
    if (raw === "" || !saveRecord(date, Number(raw), hours)) return;
    cancelEdit(); render(); toast("تم حفظ التسجيل.");
  });
  $("cancelEditBtn").addEventListener("click", cancelEdit);
  document.addEventListener("click", event => {
    const editDate = event.target.dataset.edit, deleteDate = event.target.dataset.delete;
    if (editDate) edit(editDate);
    if (deleteDate && confirm(`هل تريد حذف إنتاج يوم ${deleteDate}؟`)) {
      delete records[deleteDate]; delete overtime[deleteDate]; save(); render(); toast("تم حذف التسجيل.");
    }
    const go = event.target.dataset.go; if (go) showPage(go);
    const nav = event.target.closest(".nav-item"); if (nav) showPage(nav.dataset.page);
  });
  $("todayDate").addEventListener("change", () => { const date = $("todayDate").value; $("todayProduction").value = records[date] ?? ""; $("todayOvertime").value = overtime[date] ?? 0; $("todayTargetPreview").textContent = `${nf(number(settings.target) + number(overtime[date]) * OVERTIME_FILES_PER_HOUR)} ملف`; });
  $("monthPicker").value = month;
  $("monthPicker").addEventListener("change", event => { if (event.target.value) { month = event.target.value; render(); } });
  $("saveSalaryBtn").addEventListener("click", () => {
    settings.ardaUnused = Math.max(0, Math.floor(number($("salaryArdaCount").value)));
    settings.extraDeductions = Math.max(0, number($("extraDeductions").value));
    save(); render(); toast("تم تحديث حساب المرتب.");
  });
  function fillSettings() {
    $("setSalary").value = settings.salary; $("setTarget").value = settings.target;
    $("setDays").value = settings.workDays; $("setArdaMultiplier").value = settings.ardaMultiplier;
    document.querySelector(`input[name="fridayMode"][value="${settings.fridayMode}"]`).checked = true;
    document.querySelector(`input[name="ardaTargetMode"][value="${settings.ardaTargetMode}"]`).checked = true;
  }
  $("saveSettingsBtn").addEventListener("click", () => {
    settings.salary = Math.max(0, number($("setSalary").value));
    settings.target = Math.max(0, Math.floor(number($("setTarget").value)));
    settings.workDays = Math.max(1, Math.floor(number($("setDays").value)));
    settings.ardaMultiplier = Math.max(0, number($("setArdaMultiplier").value));
    settings.fridayMode = document.querySelector('input[name="fridayMode"]:checked').value;
    settings.ardaTargetMode = document.querySelector('input[name="ardaTargetMode"]:checked').value;
    save(); render(); toast("تم حفظ الإعدادات وتحديث الحسابات.");
  });
  $("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem("targetPro.theme", document.body.classList.contains("light") ? "light" : "dark");
  });
  if (load("targetPro.theme", "dark") === "light") document.body.classList.add("light");
  $("printBtn").addEventListener("click", () => window.print());
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ settings, records, overtime }, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `target-pro-backup-${month}.json`; a.click(); URL.revokeObjectURL(url);
  });
  $("importFile").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.settings || !data.records || typeof data.records !== "object") throw new Error("invalid");
      settings = { ...DEFAULTS, ...data.settings }; records = data.records; overtime = data.overtime || {}; save(); fillSettings(); render(); toast("تم استيراد النسخة الاحتياطية.");
    } catch { toast("ملف النسخة الاحتياطية غير صالح."); }
    event.target.value = "";
  });
  $("clearDataBtn").addEventListener("click", () => {
    if (!confirm("سيتم حذف كل الإنتاج والإعدادات من هذا الجهاز. هل أنت متأكد؟")) return;
    settings = { ...DEFAULTS }; records = {}; overtime = {}; save(); fillSettings(); render(); toast("تم مسح البيانات.");
  });
  fillSettings(); render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
})();
