/*!
 * Callpme — widget vocal pour site web.
 * <script src="https://VOTRE-APP/widget.js" data-agent="ID_AGENT" async></script>
 * Le visiteur clique, autorise le micro et parle à l'agent. Aucune dépendance.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.__callpmeWidget) return;
  window.__callpmeWidget = true;
  var agentId = script.getAttribute("data-agent");
  var base = new URL(script.src, location.href).origin;
  if (!agentId) return console.warn("[Callpme] attribut data-agent manquant.");

  /* ------------------------------ Audio ------------------------------ */

  function linearToMulaw(sample) {
    var s = Math.max(-32635, Math.min(32635, Math.round(sample * 32767)));
    var sign = s < 0 ? 0x80 : 0;
    if (sign) s = -s;
    s += 0x84;
    var exponent = 7;
    for (var mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
    var mantissa = (s >> (exponent + 3)) & 0x0f;
    return ~(sign | (exponent << 4) | mantissa) & 0xff;
  }
  function mulawToFloat(byte) {
    var u = ~byte & 0xff;
    var exponent = (u >> 4) & 0x07;
    var magnitude = ((((u & 0x0f) << 3) + 0x84) << exponent) - 0x84;
    return (u & 0x80 ? -magnitude : magnitude) / 32768;
  }
  function downsampler(inputRate) {
    var ratio = inputRate / 8000, tail = [], pos = 0;
    return function (input) {
      var buf = tail.length ? tail.concat(Array.prototype.slice.call(input)) : Array.prototype.slice.call(input);
      var out = [];
      while (pos + ratio <= buf.length) {
        var start = Math.floor(pos), end = Math.max(start + 1, Math.floor(pos + ratio)), sum = 0;
        for (var j = start; j < end; j++) sum += buf[j];
        out.push(sum / (end - start));
        pos += ratio;
      }
      var consumed = Math.floor(pos);
      tail = buf.slice(consumed);
      pos -= consumed;
      return out;
    };
  }
  var WORKLET =
    "class C extends AudioWorkletProcessor{process(i){var c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('callpme-capture',C);";

  /* ------------------------------ Interface ------------------------------ */

  var host = document.createElement("div");
  host.setAttribute("data-callpme", "");
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  var cfg = { name: "Assistant", label: "Parler à notre assistant", color: "#E8572A", position: "right" };
  var state = "idle", ws = null, ctx = null, stream = null, playhead = 0, sources = [], run = 0;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }

  function render() {
    var side = cfg.position === "left" ? "left" : "right";
    root.innerHTML = "";
    var style = el("style");
    style.textContent =
      ":host{all:initial}" +
      ".w{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917}" +
      ".b{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;background:" + cfg.color + ";color:#fff;font:600 14px/1 inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)}" +
      ".b:focus-visible,.x:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px " + cfg.color + "}" +
      ".p{margin-bottom:10px;width:280px;max-width:calc(100vw - 40px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.2);padding:14px}" +
      ".h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:600}" +
      ".s{margin:6px 0 0;color:#57534e;font-size:13px}" +
      ".t{margin:10px 0 0;padding:0;list-style:none;max-height:160px;overflow:auto;font-size:13px}" +
      ".t li{margin:4px 0}.t .a{color:#1c1917}.t .c{color:#57534e;text-align:right}" +
      ".x{border:0;border-radius:999px;padding:8px 12px;background:#dc2626;color:#fff;font:600 13px/1 inherit;cursor:pointer}" +
      ".d{width:8px;height:8px;border-radius:50%;background:#16a34a;display:inline-block}" +
      "@media (prefers-reduced-motion:no-preference){.live .d{animation:k 1.2s infinite}}" +
      "@keyframes k{50%{opacity:.3}}" +
      "svg{width:18px;height:18px}";
    root.appendChild(style);
    var wrap = el("div", { class: "w" + (state === "live" ? " live" : "") });
    if (state !== "idle") {
      var panel = el("div", { class: "p", role: "dialog", "aria-label": "Conversation avec " + cfg.name });
      var head = el("div", { class: "h" });
      var title = el("span");
      if (state === "live") title.appendChild(el("span", { class: "d", "aria-hidden": "true" }));
      title.appendChild(document.createTextNode(" " + cfg.name));
      head.appendChild(title);
      if (state === "live" || state === "connecting") {
        var hang = el("button", { class: "x", type: "button" }, "Raccrocher");
        hang.onclick = stop;
        head.appendChild(hang);
      }
      panel.appendChild(head);
      var msg = {
        connecting: "Connexion… autorisez le micro si votre navigateur le demande.",
        live: "Vous pouvez parler.",
        ended: "Conversation terminée. Merci !",
        error: errorText,
      }[state];
      panel.appendChild(el("p", { class: "s", role: "status", "aria-live": "polite" }, msg));
      if (lines.length) {
        var list = el("ol", { class: "t", "aria-label": "Transcription" });
        lines.slice(-6).forEach(function (l) {
          list.appendChild(el("li", { class: l.speaker === "agent" ? "a" : "c" }, l.text));
        });
        panel.appendChild(list);
      }
      wrap.appendChild(panel);
    }
    if (state !== "live" && state !== "connecting") {
      var btn = el("button", { class: "b", type: "button", "aria-label": cfg.label + " (conversation vocale)" });
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg>';
      btn.appendChild(document.createTextNode(cfg.label));
      btn.onclick = start;
      wrap.appendChild(btn);
    }
    root.appendChild(wrap);
  }

  var lines = [], errorText = "";
  function setState(s) {
    state = s;
    render();
  }

  /* ------------------------------ Conversation ------------------------------ */

  function play(bytes) {
    if (!ctx) return;
    var buffer = ctx.createBuffer(1, bytes.length, 8000);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bytes.length; i++) data[i] = mulawToFloat(bytes[i]);
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    var at = Math.max(ctx.currentTime + 0.02, playhead);
    src.start(at);
    playhead = at + buffer.duration;
    sources.push(src);
    src.onended = function () {
      sources = sources.filter(function (s) { return s !== src; });
    };
  }
  function clearPlayback() {
    sources.forEach(function (s) { try { s.stop(); } catch (e) { /* déjà arrêté */ } });
    sources = [];
    playhead = 0;
  }
  function teardown() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    clearPlayback();
    if (ctx) ctx.close().catch(function () {});
    ctx = null;
  }
  function stop() {
    run++;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "hangup" }));
    else if (ws) ws.close();
    ws = null;
    teardown();
    setState("ended");
  }
  function fail(text) {
    teardown();
    errorText = text;
    setState("error");
  }

  function start() {
    var mine = ++run;
    lines = [];
    setState("connecting");
    fetch(base + "/api/widget/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: agentId }),
    })
      .then(function (r) {
        return r.json().then(function (b) {
          if (!r.ok) throw new Error(b && b.error ? b.error : "Assistant indisponible.");
          return b;
        });
      })
      .then(function (b) {
        if (mine !== run) return;
        return navigator.mediaDevices
          .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
          .then(function (s) {
            if (mine !== run) return s.getTracks().forEach(function (t) { t.stop(); });
            stream = s;
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            var url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
            return ctx.resume().catch(function () {}).then(function () {
              return ctx.audioWorklet.addModule(url);
            }).then(function () {
              URL.revokeObjectURL(url);
              if (mine !== run) return teardown();
              connect(b.url);
            });
          });
      })
      .catch(function (e) {
        if (mine !== run) return;
        fail(e && e.name === "NotAllowedError" ? "Micro refusé : autorisez le micro pour parler à l'assistant." : (e && e.message) || "Assistant indisponible.");
      });
  }

  function connect(url) {
    ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onopen = function () {
      setState("live");
      var source = ctx.createMediaStreamSource(stream);
      var node = new AudioWorkletNode(ctx, "callpme-capture");
      var down = downsampler(ctx.sampleRate), carry = [];
      node.port.onmessage = function (e) {
        carry = carry.concat(down(e.data));
        while (carry.length >= 160) {
          var frame = new Uint8Array(160);
          for (var k = 0; k < 160; k++) frame[k] = linearToMulaw(carry[k]);
          carry = carry.slice(160);
          if (ws && ws.readyState === 1) ws.send(frame);
        }
      };
      source.connect(node);
    };
    ws.onmessage = function (e) {
      if (e.data instanceof ArrayBuffer) return play(new Uint8Array(e.data));
      var m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.type === "clear" || m.type === "interrupted") clearPlayback();
      if (m.type === "turn" && m.turn && m.turn.speaker !== "tool") {
        lines.push({ speaker: m.turn.speaker, text: m.turn.text });
        render();
      }
      if (m.type === "ended") stop();
    };
    ws.onerror = function () { fail("Connexion impossible. Réessayez dans un instant."); };
    ws.onclose = function () {
      if (state === "live") { teardown(); setState("ended"); }
    };
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && (state === "live" || state === "connecting")) stop();
  });

  /* ------------------------------ Démarrage ------------------------------ */

  fetch(base + "/api/widget/config?agent=" + encodeURIComponent(agentId))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) {
      if (!c) return console.warn("[Callpme] widget non autorisé sur ce site (domaines à déclarer dans Callpme).");
      cfg.name = c.name || cfg.name;
      cfg.label = c.label || cfg.label;
      cfg.color = /^#[0-9a-fA-F]{6}$/.test(c.color || "") ? c.color : cfg.color;
      cfg.position = c.position === "left" ? "left" : "right";
      document.body.appendChild(host);
      render();
    })
    .catch(function () { /* réseau : pas de bouton */ });
})();
