(function () {
  "use strict";

  function parseUtm() {
    var params = new URLSearchParams(window.location.search);
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    var utm = {};
    keys.forEach(function (k) {
      var v = params.get(k);
      if (v) utm[k] = v;
    });
    return utm;
  }

  function collectMetrics() {
    var nav = window.navigator || {};
    var scr = window.screen || {};
    return {
      language: nav.language || "",
      platform: nav.platform || "",
      cookie_enabled: !!nav.cookieEnabled,
      screen_width: scr.width,
      screen_height: scr.height,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      referrer: document.referrer || "",
    };
  }

  function collectTechnical() {
    return {
      page_url: window.location.href.split("#")[0],
      user_agent: navigator.userAgent,
    };
  }

  var form = document.getElementById("lead-form");
  var statusEl = document.getElementById("status");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.textContent = "";
    var fd = new FormData(form);
    var name = (fd.get("name") || "").toString().trim();
    var email = (fd.get("email") || "").toString().trim();
    var phone = (fd.get("phone") || "").toString().trim();
    var message = (fd.get("message") || "").toString().trim();
    if (!name || !email) {
      statusEl.textContent = "Укажите имя и email.";
      return;
    }
    var payload = {
      name: name,
      email: email,
      phone: phone || null,
      message: message || null,
      utm: parseUtm(),
      metrics: collectMetrics(),
      technical: collectTechnical(),
    };
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    fetch("/api/v1/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error(t || res.statusText);
          });
        }
        return res.json();
      })
      .then(function (data) {
        statusEl.textContent = "Заявка принята. Номер: " + data.id + ".";
        form.reset();
      })
      .catch(function (err) {
        statusEl.textContent = "Ошибка отправки. Попробуйте позже.";
        console.error(err);
      })
      .finally(function () {
        btn.disabled = false;
      });
  });
})();
