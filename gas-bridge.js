/**
 * gas-bridge.js — 깃허브(정적 사이트)에서 google.script.run 을 흉내 냅니다.
 *
 * 앱 HTML은 원래 Apps Script 안에서 google.script.run.함수이름(...) 으로 시트와 이야기합니다.
 * 깃허브에서는 그 객체가 없으므로, 같은 모양의 객체를 만들어 두고
 * 실제로는 config.js 의 API_URL(통합 Code.gs 웹 앱)로 fetch POST 를 보냅니다.
 * 그래서 앱 HTML 코드는 거의 고치지 않아도 됩니다.
 *
 * API_URL 이 비어 있으면 아무것도 하지 않아요 → 앱은 원래의 '이 기기에만 저장' 모드로 동작.
 */
(function () {
  var C = window.APP_CONFIG || {};
  if (!C.API_URL) return;

  /* ---- 가명 처리: 학교명 → S-xxxxxx (FNV-1a 해시, 같은 이름은 늘 같은 코드) ---- */
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function pseudo(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s || /^S-[0-9a-z]+$/.test(s)) return s;
    return "S-" + hash(s);
  }
  function pseudoClassKey(v) {          // "학교명|2606" → "S-xxxx|2606"
    var s = String(v == null ? "" : v), i = s.indexOf("|");
    return i < 0 ? s : pseudo(s.slice(0, i)) + s.slice(i);
  }
  function scrub(fn, args) {
    if (!C.PSEUDONYMIZE) return args;
    function walk(v) {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        var o = {};
        for (var k in v) {
          if (k === "school") o[k] = pseudo(v[k]);
          else if (k === "classKey") o[k] = pseudoClassKey(v[k]);
          else o[k] = walk(v[k]);
        }
        return o;
      }
      return v;
    }
    var out = args.map(walk);
    if (fn === "getApp3Votes") out[0] = pseudoClassKey(out[0]);
    return out;
  }

  /* ---- 서버 부르기 ---- */
  function call(fn, args, ok, fail) {
    fetch(C.API_URL, {
      method: "POST",
      // text/plain 이어야 브라우저가 사전 요청(CORS preflight)을 보내지 않아 Apps Script 와 통해요
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ fn: fn, args: scrub(fn, args) }),
      redirect: "follow"
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { if (ok) ok(d.result); }
        else { var e = new Error((d && d.error) || "서버 오류"); if (fail) fail(e); else console.warn(e); }
      })
      .catch(function (e) { if (fail) fail(e); else console.warn("[gas-bridge]", fn, e); });
  }

  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === "withSuccessHandler") return function (f) { return runner(f, fail); };
        if (name === "withFailureHandler") return function (f) { return runner(ok, f); };
        if (name === "withUserObject") return function () { return runner(ok, fail); };
        if (typeof name !== "string" || name === "then") return undefined;
        return function () { call(name, Array.prototype.slice.call(arguments), ok, fail); };
      }
    });
  }

  var params = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { params[k] = v; }); } catch (e) {}

  window.google = {
    script: {
      run: runner(null, null),
      url: { getLocation: function (cb) { setTimeout(function () { cb({ parameter: params, hash: location.hash.slice(1) }); }, 0); } }
    }
  };
  window.GAS_BRIDGE = true;
})();
