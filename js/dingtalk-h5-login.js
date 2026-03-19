/**
 * 钉钉客户端内 H5：requestAuthCode -> POST /api/dingtalk/h5-auth
 * 需在 .env 开启 DINGTALK_USE_H5_JSAPI=1 并配置 DINGTALK_CORP_ID
 */
(function () {
  var UA = navigator.userAgent || "";
  var inDingTalk = /DingTalk|AliApp\(DingTalk/i.test(UA);

  function show(el, on) {
    if (!el) return;
    el.style.display = on ? "" : "none";
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("load fail")); };
      document.head.appendChild(s);
    });
  }

  async function init() {
    var h5Btn = document.getElementById("h5LoginBtn");
    var hint = document.getElementById("dingtalkEnvHint");
    if (!h5Btn) return;

    var cfg = {};
    try {
      var r = await fetch("/api/dingtalk/web-config");
      cfg = await r.json();
    } catch (e) {
      return;
    }

    if (!cfg || !cfg.h5_jsapi_enabled || !cfg.corp_id) {
      show(h5Btn, false);
      return;
    }

    if (hint) {
      hint.textContent = inDingTalk
        ? "检测到钉钉内打开，可使用「钉钉内登录」。"
        : "在系统浏览器中请使用「钉钉扫码登录」；从钉钉工作台打开本站可使用「钉钉内登录」。";
    }

    show(h5Btn, inDingTalk);

    h5Btn.addEventListener("click", async function () {
      h5Btn.disabled = true;
      try {
        if (!window.dd) {
          await loadScript("https://g.alicdn.com/dingding/dingtalk-jsapi/2.13.42/dingtalk.open.js");
        }
        if (!window.dd || !dd.runtime || !dd.runtime.permission || !dd.runtime.permission.requestAuthCode) {
          alert("当前环境不支持钉钉 JSAPI，请从钉钉客户端打开微应用首页。");
          return;
        }
        dd.runtime.permission.requestAuthCode({
          corpId: cfg.corp_id,
          onSuccess: async function (info) {
            var code = info && (info.code || info.authCode);
            if (!code) {
              alert("未获取到授权码");
              return;
            }
            try {
              var resp = await fetch("/api/dingtalk/h5-auth", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ authCode: code }),
              });
              var d = await resp.json().catch(function () { return {}; });
              if (resp.ok && d.ok) {
                window.location.reload();
              } else {
                alert((d && d.msg) || "登录失败");
              }
            } catch (e2) {
              alert("请求失败：" + (e2.message || e2));
            }
          },
          onFail: function (err) {
            alert((err && (err.errorMessage || err.message)) ? (err.errorMessage || err.message) : "钉钉授权失败");
          },
        });
      } catch (e) {
        alert("加载或调用钉钉接口失败：" + (e.message || e));
      } finally {
        h5Btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
