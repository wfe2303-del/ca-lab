(() => {
  const $ = (id) => document.getElementById(id);
  const btnStart = $("btnStart");
  const btnExport = $("btnExport");
  const statusEl = $("status");
  const tbody = $("tbody");
  const linksEl = $("links");

  let rows = [];
  let pending = new Map();   // url -> {openedAt, win}

  // 메시지 수신 (Userscript -> opener.postMessage)
  window.addEventListener("message", (ev) => {
    try {
      const d = ev.data || {};
      if (d && d.type === "kakao-count" && typeof d.url === "string") {
        const rec = pending.get(d.url);
        const elapsed = rec ? (performance.now() - rec.openedAt) : 0;
        upsertRow({ url: d.url, count: d.count ?? "", status: d.status || "ok", elapsed: Math.round(elapsed) });
        // 창 자동닫힘이 아닐 경우 수동으로 닫아도 됨.
        if (rec && rec.win && !rec.win.closed) { /* 사용자가 볼 수 있게 남김 */ }
        pending.delete(d.url);
        refreshState();
      }
    } catch(e) {
      console.warn("message parse error", e);
    }
  });

  function upsertRow({url, count, status, elapsed}) {
    rows.push({url, count, status, elapsed});
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="${url}" target="_blank" rel="noopener">${url}</a></td>
      <td>${count !== "" ? count : "-"}</td>
      <td class="${statusClass(status)}">${status}</td>
      <td>${elapsed}</td>
    `;
    tbody.appendChild(tr);
    btnExport.disabled = rows.length === 0;
  }

  function statusClass(s) {
    if (s.startsWith("ok")) return "status-ok";
    if (s.includes("not_found") || s.includes("timeout")) return "status-warn";
    if (s.startsWith("error")) return "status-bad";
    return "";
  }

  function refreshState() {
    const total = pending.size + rows.length;
    statusEl.textContent = pending.size ? `수집 중 (${rows.length}/${total})` : (rows.length ? "완료" : "대기 중");
  }

  async function start() {
    rows = [];
    tbody.innerHTML = "";
    btnExport.disabled = true;

    const list = (linksEl.value || "")
      .split("\n").map(s => s.trim()).filter(Boolean);

    if (!list.length) {
      alert("링크를 입력하세요.");
      return;
    }

    statusEl.textContent = "수집 시작";
    // 사용자 제스처 안에서 첫 팝업을 열어야 브라우저가 popup 차단을 덜합니다.
    for (const url of list) {
      await openAndTrack(url);
      await sleep(800); // 너무 빠른 오픈은 차단/부하 ↑
    }

    // 타임아웃 감시
    const timeoutMs = 10000;
    const timer = setInterval(() => {
      const now = performance.now();
      for (const [url, rec] of pending.entries()) {
        if (now - rec.openedAt > timeoutMs) {
          upsertRow({ url, count: "", status: "timeout", elapsed: timeoutMs });
          try { if (rec.win && !rec.win.closed) rec.win.close(); } catch {}
          pending.delete(url);
        }
      }
      refreshState();
      if (!pending.size) clearInterval(timer);
    }, 1000);
  }

  async function openAndTrack(url) {
    const w = window.open(url, "_blank", "noopener"); // 새 탭/창
    if (!w) {
      alert("팝업이 차단되었습니다. 이 사이트에 대해 팝업 허용을 켜주세요.");
      throw new Error("popup blocked");
    }
    pending.set(url, { openedAt: performance.now(), win: w });
    refreshState();
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function toCSV() {
    const header = "url,participants,status,elapsed_ms\n";
    const lines = rows.map(r => [r.url, r.count, r.status, r.elapsed].map(csvCell).join(",")).join("\n");
    const blob = new Blob([header + lines], {type: "text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kakao_openchat_counts.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  btnStart.addEventListener("click", start);
  btnExport.addEventListener("click", toCSV);
})();
