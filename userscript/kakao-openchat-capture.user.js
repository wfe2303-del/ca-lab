// ==UserScript==
// @name         Kakao OpenChat Count Capture
// @namespace    https://your-domain.example/
// @version      1.0.0
// @description  open.kakao.com 오픈채팅 미리보기에서 "n명 참여 중"을 읽어 부모창으로 전송
// @match        https://open.kakao.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  function parseCount(text) {
    // 예: "1,234명 참여 중" / "1234명 참여 중"
    const m = /(\d{1,3}(?:,\d{3})*|\d{1,7})\s*명\s*참여/.exec(text);
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function scrape() {
    // 1) 우선 DOM 특정 영역 텍스트 시도
    const bodyText = document.body ? document.body.innerText : "";
    let count = parseCount(bodyText);

    // 2) 그래도 실패면 접근 가능한 aria/alt 속성 등 전체 탐색
    if (count == null) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let t, buf = "";
      while ((t = walker.nextNode())) { buf += " " + (t.nodeValue || ""); }
      count = parseCount(buf);
    }
    return count;
  }

  function send(count, status) {
    try {
      if (window.opener && typeof window.opener.postMessage === "function") {
        window.opener.postMessage({
          type: "kakao-count",
          url: location.href,
          count: count,
          status: status || (count != null ? "ok" : "not_found")
        }, "*");
      }
    } catch(e) { /* noop */ }
  }

  function main() {
    // 페이지 로드 후 약간 대기(동적 렌더링 대비)
    setTimeout(() => {
      const c = scrape();
      send(c);
      // 필요 시 자동 닫기 원하면 주석 해제
      // setTimeout(() => window.close(), 500);
    }, 800);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    main();
  } else {
    window.addEventListener("DOMContentLoaded", main);
  }
})();
