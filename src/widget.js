/**
 * TVA Widget Loader (clean rebuild)
 * - ShadowRoot: open
 * - Retell iframe inside a panel
 * - Auto-open supported via data-auto-open="true"
 * - Theme override via CSS inside shadow root:
 *   background black, bot bubble purple w/ white text, user bubble turquoise w/ white text
 * - Optional logo via data-logo-url="https://.../logo.png"
 */
(function () {
  "use strict";

  function $(root, sel) { return root.querySelector(sel); }

  function safeLower(x) { return String(x || "").toLowerCase(); }

  function createEl(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "style") {
          Object.keys(props.style).forEach(function (sk) { el.style[sk] = props.style[sk]; });
        } else if (k === "text") {
          el.textContent = props.text;
        } else if (k === "html") {
          el.innerHTML = props.html;
        } else if (k === "class") {
          el.className = props[k];
        } else {
          el.setAttribute(k, props[k]);
        }
      });
    }
    return el;
  }

  function buildIframeUrl(publicKey, agentId, agentVer, title, logoUrl, color, autoOpen) {
    // IMPORTANT: same origin to allow CSS overrides if Retell renders inside our shadow root
    var base = (location.origin || "http://localhost:3000") + "/retell-frame.html";
    var qs = [];
    if (publicKey) qs.push("public_key=" + encodeURIComponent(publicKey));
    if (agentId) qs.push("agent_id=" + encodeURIComponent(agentId));
    if (agentVer) qs.push("agent_version=" + encodeURIComponent(agentVer));
    if (title) qs.push("title=" + encodeURIComponent(title));
    if (logoUrl) qs.push("logo_url=" + encodeURIComponent(logoUrl));
    if (color) qs.push("color=" + encodeURIComponent(color));
    if (autoOpen != null) qs.push("auto_open=" + encodeURIComponent(String(autoOpen)));
    return base + (qs.length ? ("?" + qs.join("&")) : "");
  }

  function injectTheme(shadowRoot) {
    // Works if Retell renders DOM inside our shadow root. If Retell is inside iframe only, then you must style inside retell-frame.html instead.
    var style = createEl("style", { id: "TVA_THEME" });

    style.textContent = [
      ":host {",
      "  --tva-bg: #000000;",
      "  --tva-panel: #0b0b0b;",
      "  --tva-border: rgba(255,255,255,.12);",
      "  --tva-text: #ffffff;",
      "  --tva-bot: #7c3aed;",   /* lila */
      "  --tva-user: #06b6d4;",  /* türkis */
      "}",
      "",
      /* panel background */
      ".tva-panel { background: var(--tva-panel) !important; }",
      "",
      /* Retell common containers (best effort) */
      ".retell-chat-window, .retell-messages, .retell-body, .retell-root {",
      "  background: var(--tva-bg) !important;",
      "  color: var(--tva-text) !important;",
      "}",
      "",
      /* message bubbles (based on what you saw in inspector: .retell-msg.user / agent) */
      ".retell-msg.user {",
      "  background: var(--tva-user) !important;",
      "  color: #ffffff !important;",
      "}",
      ".retell-msg.agent, .retell-msg.bot {",
      "  background: var(--tva-bot) !important;",
      "  color: #ffffff !important;",
      "}",
      "",
      /* message text */
      ".retell-msg.user *, .retell-msg.agent *, .retell-msg.bot * {",
      "  color: #ffffff !important;",
      "}",
      "",
      /* header bar */
      ".retell-header {",
      "  background: var(--tva-bot) !important;",
      "  color: #ffffff !important;",
      "  border-bottom: 1px solid rgba(255,255,255,.12) !important;",
      "}",
      ".retell-header * { color: #ffffff !important; }",
      "",
      /* input area */
      ".retell-input, .retell-composer, input, textarea {",
      "  background: #0f0f0f !important;",
      "  color: #ffffff !important;",
      "  border: 1px solid rgba(255,255,255,.14) !important;",
      "}",
      "",
      /* send button */
      ".retell-send, button {",
      "  background: var(--tva-bot) !important;",
      "  color: #ffffff !important;",
      "  border: 1px solid rgba(255,255,255,.12) !important;",
      "}",
      "",
      /* scrollbars (optional) */
      "::-webkit-scrollbar { width: 10px; }",
      "::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 10px; }",
      "::-webkit-scrollbar-track { background: rgba(255,255,255,.04); }",
      ""
    ].join("\n");

    shadowRoot.appendChild(style);
  }

  function tryInsertLogo(shadowRoot, logoUrl) {
    if (!logoUrl) return;

    function doInsert() {
      var header = shadowRoot.querySelector(".retell-header");
      if (!header) return false;

      // Avoid duplicates
      if (shadowRoot.querySelector("#TVA_LOGO")) return true;

      var img = createEl("img", { id: "TVA_LOGO" });
      img.src = logoUrl;
      img.alt = "TVA";
      img.style.width = "22px";
      img.style.height = "22px";
      img.style.borderRadius = "6px";
      img.style.marginRight = "10px";
      img.style.objectFit = "contain";

      // Try to put it left of title
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.paddingLeft = "12px";

      // Put img as first child
      header.insertBefore(img, header.firstChild);
      return true;
    }

    // Try now, then observe for late render
    if (doInsert()) return;

    var mo = new MutationObserver(function () {
      if (doInsert()) mo.disconnect();
    });
    mo.observe(shadowRoot, { childList: true, subtree: true });
  }

  function init(script) {
    var customerId = script.getAttribute("data-customer-id") || "demo";
    var publicKey  = script.getAttribute("data-public-key") || "";
    var agentId    = script.getAttribute("data-agent-id") || "";
    var agentVer   = script.getAttribute("data-agent-version") || "";
    var autoOpen   = safeLower(script.getAttribute("data-auto-open")) === "true";
    var title      = script.getAttribute("data-title") || "The Virtual Assistant";
    var title      = script.getAttribute("data-title") || "The Virtual Assistant";
    var color      = script.getAttribute("data-color") || "#7c3aed";
    var logoUrl    = script.getAttribute("data-logo-url") || "";

    if (!publicKey || !agentId) {
      console.error("[TVA Widget] Missing data-public-key or data-agent-id.");
    }

    // Mount container
    var host = createEl("div", { id: "tva-widget-host" });
    host.style.position = "fixed";
    host.style.right = "24px";
    host.style.bottom = "24px";
    host.style.zIndex = "999999";
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });

    // Base wrapper
    var wrap = createEl("div");
    shadow.appendChild(wrap);

    // Floating button
    var fab = createEl("button", { type: "button" });
    fab.textContent = "Chat";
    fab.style.width = "62px";
    fab.style.height = "62px";
    fab.style.borderRadius = "999px";
    fab.style.border = "1px solid rgba(255,255,255,.14)";
    fab.style.background = "#7c3aed";
    fab.style.color = "#fff";
    fab.style.cursor = "pointer";
    fab.style.boxShadow = "0 12px 30px rgba(0,0,0,.45)";
    fab.style.fontSize = "14px";
    fab.style.fontWeight = "700";

    // Panel
    var panel = createEl("div", { class: "tva-panel" });
    panel.style.width = "360px";
    panel.style.height = "520px";
    panel.style.borderRadius = "18px";
    panel.style.overflow = "hidden";
    panel.style.border = "1px solid rgba(255,255,255,.14)";
    panel.style.boxShadow = "0 20px 60px rgba(0,0,0,.60)";
    panel.style.display = "none";
    panel.style.marginBottom = "14px";

    // Iframe
    var iframe = createEl("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.background = "#000";

    var iframeUrl = buildIframeUrl(publicKey, agentId, agentVer, title, logoUrl, color, autoOpen)
  + "&subscription_id=" + encodeURIComponent(customerId);
    iframe.src = iframeUrl;

    panel.appendChild(iframe);

    // Add to DOM
    wrap.appendChild(panel);
    wrap.appendChild(fab);

    // Inject theme into OUR shadow root (if retell renders here, it will apply)
    injectTheme(shadow);

    // Optional logo (best effort if header exists in shadow)
    tryInsertLogo(shadow, logoUrl);

    function openPanel() { panel.style.display = "block"; }
    function closePanel() { panel.style.display = "none"; }
    function toggle() {
      if (panel.style.display === "none" || panel.style.display === "") openPanel();
      else closePanel();
    }

    fab.addEventListener("click", toggle);

    // Auto open
    if (autoOpen) {
      setTimeout(function () { openPanel(); }, 250);
    }

    // Debug
    console.log("[TVA Widget] mounted", {
      customerId: customerId,
      autoOpen: autoOpen,
      iframe: iframeUrl
    });
  }

  // Find current script (works in most embedding cases)
  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var all = document.getElementsByTagName("script");
    scriptEl = all[all.length - 1];
  }
  try {
    init(scriptEl);
  } catch (e) {
    console.error("[TVA Widget] init failed:", e);
  }
})();

