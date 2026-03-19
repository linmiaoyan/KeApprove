const API_LEAVE = "/api/leave-cycle";
const API_LEAVE_NLP = "/api/leave-nlp";

function setStatus(text, type) {
  const el = document.getElementById("statusMsg");
  if (!el) return;
  el.textContent = text || "";
  el.className = type ? type : "";
}

function getCycleReplace() {
  const nodes = document.querySelectorAll('input[name="cycleReplace"]');
  for (const n of nodes) {
    if (n.checked) return n.value;
  }
  return "0";
}

function guessWeekRange() {
  // default: current week Monday..Sunday (local time)
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const mondayOffset = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function setLlmOut(text, type) {
  const el = document.getElementById("llmOutput");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = type === "err" ? "var(--danger-color)" : "var(--text-secondary)";
}

function normalizeStudents(arr) {
  if (!Array.isArray(arr)) return "";
  const cleaned = [];
  const seen = new Set();
  arr.forEach((x) => {
    const s = String(x || "").trim();
    if (!s) return;
    if (seen.has(s)) return;
    seen.add(s);
    cleaned.push(s);
  });
  return cleaned.join("\n");
}

function fillFromNlp(nlp) {
  if (!nlp || typeof nlp !== "object") return;
  if (nlp.students) {
    const ta = document.getElementById("students");
    if (ta) ta.value = normalizeStudents(nlp.students);
  }
  if (nlp.weekday) {
    const w = document.getElementById("week");
    if (w) w.value = String(nlp.weekday);
  }
  const t = nlp.time || {};
  if (t.timestart) {
    const a = document.getElementById("timestart");
    if (a) a.value = t.timestart;
  }
  if (t.timeend) {
    const b = document.getElementById("timeend");
    if (b) b.value = t.timeend;
  }
  if (typeof nlp.reason === "string" && nlp.reason.trim()) {
    const r = document.getElementById("reason");
    if (r) r.value = nlp.reason.trim();
  }
}

async function llmParse() {
  const btn = document.getElementById("llmParseBtn");
  const input = (document.getElementById("llmInput") || {}).value || "";
  if (!input.trim()) return setLlmOut("请输入要解析的口述内容。", "err");
  btn.disabled = true;
  setLlmOut("解析中…", "");
  try {
    const resp = await fetch(API_LEAVE_NLP, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      setLlmOut("失败：" + (data.msg || resp.status), "err");
      return;
    }
    const parsed = data.data || {};
    fillFromNlp(parsed);
    const lines = [];
    if (parsed.students) lines.push("students: " + JSON.stringify(parsed.students, null, 0));
    if (parsed.weekday) lines.push("weekday: " + parsed.weekday);
    if (parsed.lesson_hint) lines.push("lesson_hint: " + parsed.lesson_hint);
    if (parsed.time && (parsed.time.timestart || parsed.time.timeend)) {
      lines.push("time: " + (parsed.time.timestart || "") + " - " + (parsed.time.timeend || ""));
    }
    if (parsed.reason) lines.push("reason: " + parsed.reason);
    if (parsed.notes) lines.push("notes: " + parsed.notes);
    setLlmOut(lines.join("\n") || "已解析并回填。", "");
  } catch (e) {
    setLlmOut("请求失败：" + e.message, "err");
  } finally {
    btn.disabled = false;
  }
}

function llmFillWeek() {
  const r = guessWeekRange();
  const s = document.getElementById("timeStart");
  const e = document.getElementById("timeEnd");
  if (s) s.value = r.start;
  if (e) e.value = r.end;
  setLlmOut("已填入本周周期：" + r.start + " ~ " + r.end, "");
}

async function submitLeave() {
  const btn = document.getElementById("submitBtn");
  const grade = (document.getElementById("grade").value || "1").trim();
  const week = (document.getElementById("week").value || "3").trim();
  const timestart = (document.getElementById("timestart").value || "").trim();
  const timeend = (document.getElementById("timeend").value || "").trim();
  const timeStart = (document.getElementById("timeStart").value || "").trim();
  const timeEnd = (document.getElementById("timeEnd").value || "").trim();
  const reason = (document.getElementById("reason").value || "").trim();
  const students = (document.getElementById("students").value || "").trim();
  const vercode = (document.getElementById("vercode").value || "").trim();
  const cycleReplace = getCycleReplace();

  if (!students) return setStatus("请填写学生姓名（逗号或换行分隔）", "err");
  if (!timeStart || !timeEnd) return setStatus("请填写周期开始/结束日期（必须包含目标星期）", "err");
  if (!timestart || !timeend) return setStatus("请填写开始/结束时间", "err");
  if (!reason) return setStatus("请填写原因（50字内）", "err");

  btn.disabled = true;
  setStatus("提交中…", "");
  const resultCard = document.getElementById("resultCard");
  const resultText = document.getElementById("resultText");
  if (resultCard) resultCard.style.display = "none";

  try {
    const resp = await fetch(API_LEAVE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grade,
        students,
        time_start: timeStart,
        time_end: timeEnd,
        week,
        timestart,
        timeend,
        reason,
        cycle_replace: cycleReplace,
        mode: "times",
        vercode,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      if (data.need_captcha) {
        setStatus("需要验证码：请打开登录页查看验证码并填写后重试。", "err");
      } else {
        setStatus("失败：" + (data.msg || resp.status + " " + resp.statusText), "err");
      }
      if (resultCard && resultText) {
        resultCard.style.display = "";
        resultText.textContent = JSON.stringify(data, null, 2);
      }
      return;
    }

    setStatus("提交成功。请到平台“周期请假查询”核对名单（可能按班级拆分）。", "ok");
    if (resultCard && resultText) {
      resultCard.style.display = "";
      const lines = [];
      lines.push("cycle_stuids: " + (data.cycle_stuids || ""));
      if (Array.isArray(data.students)) {
        data.students.forEach((s, idx) => {
          lines.push(`${idx + 1}. ${s.name} -> user_id=${s.user_id}${s.system_name ? " (" + s.system_name + ")" : ""}`);
        });
      }
      if (data.submit_json) {
        lines.push("");
        lines.push("submit_json:");
        lines.push(JSON.stringify(data.submit_json, null, 2));
      }
      resultText.textContent = lines.join("\n");
    }
  } catch (e) {
    setStatus("请求失败：" + e.message, "err");
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("submitBtn");
  if (btn) btn.addEventListener("click", submitLeave);

  // init date range to current week
  const r = guessWeekRange();
  const s = document.getElementById("timeStart");
  const e = document.getElementById("timeEnd");
  if (s && !s.value) s.value = r.start;
  if (e && !e.value) e.value = r.end;

  const llmBtn = document.getElementById("llmParseBtn");
  if (llmBtn) llmBtn.addEventListener("click", llmParse);
  const llmFillBtn = document.getElementById("llmFillWeekBtn");
  if (llmFillBtn) llmFillBtn.addEventListener("click", llmFillWeek);

  // prefill students from previous localStorage
  try {
    const key = "leaveStudentsDraft";
    const ta = document.getElementById("students");
    if (ta) {
      const old = localStorage.getItem(key);
      if (old && !ta.value.trim()) ta.value = old;
      ta.addEventListener("input", () => localStorage.setItem(key, ta.value));
    }
  } catch (e2) {}
});

