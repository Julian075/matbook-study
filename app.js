/* 2AFC material study: reference sphere in the middle, Ours vs a competitor on the
 * left/right (random side), trial order randomized per participant. A web version
 * of LCS_Vs_Ours/Experiment_file.m. */
(function () {
  "use strict";
  const CFG = window.STUDY_CONFIG;
  const STORE_KEY = "study_state_" + CFG.STUDY_ID;
  const $ = (id) => document.getElementById(id);

  let DATA = null;   // trials.json
  let S = null;      // session state (persisted in localStorage)
  let current = null, accepting = false, t0 = 0;

  // ---------------------------------------------------------------- utilities
  const rand = (n) => Math.floor(Math.random() * n);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } }
  function clearStore() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }
  function show(id) {
    document.querySelectorAll(".screen").forEach((el) => (el.hidden = el.id !== id));
    window.scrollTo(0, 0);
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ------------------------------------------------------- trial construction
  function makeTrial(t, kind) {
    const ours = { method: "ours", src: t.ours };
    const other = { method: t.compare_model, src: t.other };
    const oursLeft = Math.random() < 0.5;
    return {
      kind, row: t.row, item_id: t.item_id, object: t.object, prompt: t.prompt,
      material_category: t.material_category, compare_model: t.compare_model,
      compare_method: t.compare_method, view: t.view, ref: t.ref,
      left: oursLeft ? ours : other, right: oursLeft ? other : ours,
    };
  }
  function makeCatch(c) {
    const good = { method: "catch_correct", src: c.correct };
    const bad = { method: "catch_wrong", src: c.wrong };
    const goodLeft = Math.random() < 0.5;
    return {
      kind: "catch", row: "", catch_id: c.catch_id, item_id: c.item_id, object: "",
      prompt: c.prompt, material_category: "", compare_model: "catch",
      compare_method: "catch", view: "", ref: c.ref,
      left: goodLeft ? good : bad, right: goodLeft ? bad : good,
    };
  }
  function noRepeats(seq) {
    for (let i = 1; i < seq.length; i++) if (seq[i].item_id === seq[i - 1].item_id) return false;
    return true;
  }
  function buildMain() {
    // Shuffle; spread the catch trials evenly (with jitter); avoid the same item twice in a row.
    for (let attempt = 0; attempt < 5000; attempt++) {
      const mains = shuffle(DATA.trials.map((t) => makeTrial(t, "main")));
      const catches = shuffle(DATA.catch.map(makeCatch));
      const total = mains.length + catches.length;
      const pos = new Set(catches.map((_, k) =>
        Math.min(total - 1, Math.max(3, Math.round(((k + 1) * total) / (catches.length + 1)) + rand(7) - 3))));
      if (pos.size !== catches.length) continue;
      const seq = [];
      for (let i = 0, m = 0, c = 0; i < total; i++) seq.push(pos.has(i) ? catches[c++] : mains[m++]);
      if (noRepeats(seq)) return seq;
    }
    return shuffle(DATA.trials.map((t) => makeTrial(t, "main")).concat(DATA.catch.map(makeCatch)));
  }
  function buildPractice() {
    return shuffle(DATA.trials.slice()).slice(0, CFG.N_PRACTICE || 0).map((t) => makeTrial(t, "practice"));
  }

  // --------------------------------------------------------------- preloading
  function preloadAll(onProgress) {
    const urls = new Set();
    DATA.trials.forEach((t) => [t.ref, t.ours, t.other].forEach((u) => urls.add(u)));
    DATA.catch.forEach((c) => [c.ref, c.correct, c.wrong].forEach((u) => urls.add(u)));
    let done = 0;
    const list = [...urls];
    return Promise.all(list.map((u) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => { done++; onProgress(done, list.length); res(); };
      im.src = u;
    })));
  }

  // ------------------------------------------------------------- trial runner
  function seqFor(phase) { return phase === "practice" ? S.practice : S.main; }

  async function runTrial() {
    const seq = seqFor(S.phase);
    if (S.idx >= seq.length) return phaseDone();
    current = seq[S.idx];
    const trialEl = $("s-trial");
    trialEl.classList.add("blank");
    $("opt-left").classList.remove("chosen");
    $("opt-right").classList.remove("chosen");
    $("progress-bar").style.width = (100 * S.idx / seq.length) + "%";
    $("phase-tag").textContent = S.phase === "practice"
      ? `Practice ${S.idx + 1} / ${seq.length}` : "";

    const imgs = [[$("img-left"), current.left.src], [$("img-ref"), current.ref], [$("img-right"), current.right.src]];
    imgs.forEach(([el, src]) => (el.src = src));
    $("t-prompt").textContent = CFG.SHOW_PROMPT === false ? "" : current.prompt;
    await Promise.all([wait(CFG.ISI_MS), ...imgs.map(([el]) => (el.decode ? el.decode().catch(() => {}) : null))]);

    trialEl.classList.remove("blank");
    requestAnimationFrame(() => { t0 = performance.now(); accepting = true; });
  }

  async function respond(side, input) {
    if (!accepting || !current) return;
    accepting = false;
    const rt = Math.round(performance.now() - t0);
    const tr = current;
    const chosen = side === "left" ? tr.left.method : tr.right.method;
    const isCatch = tr.kind === "catch";
    S.responses.push({
      study_id: CFG.STUDY_ID,
      session_id: S.session_id,
      participant: S.participant,
      phase: tr.kind === "practice" ? "practice" : "main",
      trial_index: S.idx + 1,
      is_catch: isCatch ? 1 : 0,
      row: tr.row,
      item_id: tr.item_id,
      object: tr.object,
      material_category: tr.material_category,
      compare_model: tr.compare_model,
      compare_method: tr.compare_method,
      view: tr.view,
      left_method: tr.left.method,
      right_method: tr.right.method,
      chosen_side: side,
      input: input,
      chosen_method: chosen,
      chose_ours: isCatch ? "" : (chosen === "ours" ? 1 : 0),
      catch_correct: isCatch ? (chosen === "catch_correct" ? 1 : 0) : "",
      rt_ms: rt,
      timestamp: new Date().toISOString(),
      win_w: window.innerWidth,
      win_h: window.innerHeight,
    });
    S.idx++;
    save();
    $(side === "left" ? "opt-left" : "opt-right").classList.add("chosen");
    await wait(150);
    runTrial();
  }

  function phaseDone() {
    current = null;
    if (S.phase === "practice") {
      S.phase = "ready"; S.idx = 0; save();
      $("n-main").textContent = S.main.length;
      show("s-ready");
    } else {
      S.phase = "end"; S.finished_at = new Date().toISOString(); save();
      exitFullscreen();
      show("s-end");
      upload();
    }
  }

  // --------------------------------------------------------- upload / export
  function sessionRecord() {
    const main = S.responses.filter((r) => r.phase === "main");
    const catches = main.filter((r) => r.is_catch === 1);
    return {
      study_id: CFG.STUDY_ID, session_id: S.session_id, participant: S.participant,
      started_at: S.started_at, finished_at: S.finished_at || "",
      duration_s: S.finished_at ? Math.round((new Date(S.finished_at) - new Date(S.started_at)) / 1000) : "",
      n_main_trials: main.length,
      catch_correct: catches.filter((r) => r.catch_correct === 1).length,
      catch_total: catches.length,
      screen: `${screen.width}x${screen.height}`, dpr: window.devicePixelRatio,
      user_agent: navigator.userAgent, language: navigator.language,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || ""),
      resumed: S.resumed || 0,
    };
  }

  async function upload() {
    const status = $("upload-status");
    const btn = $("btn-submit");
    if (!CFG.ENDPOINT_URL) {
      status.textContent = "Online saving is not configured. Please download your results.";
      $("download-box").hidden = false;
      return;
    }
    btn.hidden = true;
    status.textContent = "Saving your results…";
    const body = JSON.stringify({ session: sessionRecord(), rows: S.responses });
    try {
      const r = await fetch(CFG.ENDPOINT_URL, { method: "POST", body });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "server error");
      S.uploaded = true; save();
      status.textContent = "Your results were saved. Thank you! You can close this page now.";
      btn.hidden = true;
      clearStore();
    } catch (e) {
      // Retry without CORS (response unreadable, but usually still stored).
      // Duplicates, if any, are removed in the analysis by session_id + trial_index.
      try {
        await fetch(CFG.ENDPOINT_URL, { method: "POST", body, mode: "no-cors" });
        status.textContent = "Results sent. To be safe, please also download them below.";
      } catch (e2) {
        status.textContent = "Could not send the results (" + e.message + ").";
      }
      $("download-box").hidden = false;
      btn.hidden = false;
    }
  }

  function downloadCSV() {
    const ses = sessionRecord();
    const extra = ["screen", "dpr", "user_agent"];
    const rows = S.responses.map((r) => { const o = { ...r }; extra.forEach((k) => (o[k] = ses[k])); return o; });
    const cols = Object.keys(rows[0] || {});
    const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => esc(r[c])).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${CFG.STUDY_ID}_${(S.participant || "anon").replace(/\W+/g, "_")}_${S.session_id.slice(0, 8)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------------------------------------------------------- fullscreen
  function enterFullscreen() {
    const el = document.documentElement;
    if ($("fs").checked && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  // ------------------------------------------------------------------- wiring
  function newSession() {
    S = {
      session_id: uuid(), participant: "", info: {}, started_at: new Date().toISOString(),
      practice: buildPractice(), main: buildMain(), phase: "info", idx: 0, responses: [],
    };
  }

  function startPreload() {
    $("n-practice").textContent = CFG.N_PRACTICE;
    $("practice-note").hidden = !(CFG.N_PRACTICE > 0);
    $("btn-start").textContent = CFG.N_PRACTICE > 0 ? "Start practice" : "Start the study";
    preloadAll((d, n) => {
      $("load-bar").style.width = (100 * d / n) + "%";
      $("load-text").textContent = d < n ? `Loading images… ${d} / ${n}` : "All images loaded.";
    }).then(() => { $("btn-start").disabled = false; });
  }

  function resumeSession() {
    S.resumed = (S.resumed || 0) + 1;
    save();
    if (S.phase === "info") return show("s-info");
    if (S.phase === "instr") { show("s-instr"); return startPreload(); }
    if (S.phase === "end") { show("s-end"); return upload(); }
    preloadAll(() => {}).then(() => {
      if (S.phase === "ready") { $("n-main").textContent = S.main.length; show("s-ready"); }
      else { show("s-trial"); runTrial(); }
    });
  }

  function init() {
    $("t-question").textContent = CFG.QUESTION;
    if (CFG.CONTACT) $("contact").textContent = "Contact: " + CFG.CONTACT;
    if (window.innerWidth < 900) $("narrow-warning").hidden = false;

    const prev = load();
    if (prev && prev.session_id && !prev.uploaded && prev.phase !== "info") $("resume-box").hidden = false;

    $("consent").onchange = (e) => ($("btn-consent").disabled = !e.target.checked);
    $("btn-consent").onclick = () => { newSession(); save(); show("s-info"); };
    $("btn-resume").onclick = () => { S = prev; resumeSession(); };
    $("btn-restart").onclick = () => { clearStore(); $("resume-box").hidden = true; };

    $("pid").oninput = (e) => ($("btn-info").disabled = !e.target.value.trim());
    $("btn-info").onclick = () => {
      S.participant = $("pid").value.trim();
      S.info = {};
      S.phase = "instr"; save();
      show("s-instr");
      startPreload();
    };
    $("btn-start").onclick = () => {
      enterFullscreen();
      S.phase = S.practice.length ? "practice" : "main"; S.idx = 0; save();
      show("s-trial");
      runTrial();
    };
    $("btn-main").onclick = () => {
      enterFullscreen();
      S.phase = "main"; S.idx = 0; save();
      show("s-trial");
      runTrial();
    };
    $("opt-left").onclick = () => respond("left", "click");
    $("opt-right").onclick = () => respond("right", "click");
    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); respond("left", "key"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); respond("right", "key"); }
    });
    $("btn-submit").onclick = upload;
    $("btn-download").onclick = downloadCSV;
    window.addEventListener("beforeunload", (e) => {
      if (S && (S.phase === "practice" || S.phase === "main")) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  fetch("trials.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => { DATA = d; init(); })
    .catch(() => { document.body.innerHTML = "<p style='padding:2em'>Could not load the study. Please reload the page.</p>"; });
})();
