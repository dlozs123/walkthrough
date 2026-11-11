(function () {
  "use strict";

  var BASE = document.body.getAttribute("data-base") || ".";
  var LS_FS = "wt_fs",
    LS_READ = "wt_read",
    LS_LAST = "wt_last",
    LS_BM = "wt_bm",
    LS_G = "wt_sg";

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }

  function readMap() {
    try {
      return JSON.parse(store(LS_READ) || "{}");
    } catch (e) {
      return {};
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var toastEl = null,
    toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("on");
    }, 1800);
  }

  /* ==================== 字号 ==================== */
  var sizes = ["s", "m", "l"];
  function applyFs(v) {
    document.documentElement.setAttribute("data-fs", v);
  }
  applyFs(store(LS_FS) || "m");

  var fsBtn = document.getElementById("fsBtn");
  if (fsBtn) {
    var fsz = { s: "12px", m: "14px", l: "16px" };
    fsBtn.style.fontSize = fsz[store(LS_FS) || "m"];
    fsBtn.addEventListener("click", function () {
      var cur = store(LS_FS) || "m";
      var nx = sizes[(sizes.indexOf(cur) + 1) % sizes.length];
      store(LS_FS, nx);
      applyFs(nx);
      this.style.fontSize = fsz[nx];
    });
  }

  /* ==================== 全文搜索 ==================== */
  var idx = null,
    idxLoading = false,
    waiters = [],
    selG = {},
    sqEl = document.getElementById("sq"),
    sresEl = document.getElementById("sres"),
    gchkEl = document.getElementById("gchk"),
    sheetS = document.getElementById("searchSheet");

  function loadIndex(cb) {
    if (idx) return cb();
    waiters.push(cb);
    if (idxLoading) return;
    idxLoading = true;
    if (sresEl) sresEl.innerHTML = '<p class="hint">正在加载搜索索引…</p>';
    fetch(BASE + "/assets/search.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        idx = j;
        idxLoading = false;
        buildGroups();
        var w = waiters;
        waiters = [];
        w.forEach(function (f) {
          f();
        });
      })
      .catch(function (e) {
        idxLoading = false;
        if (sresEl)
          sresEl.innerHTML =
            '<p class="hint">索引加载失败：' + esc(e.message || e) + "</p>";
      });
  }

  function buildGroups() {
    if (!gchkEl || gchkEl.childElementCount) return;
    var saved = null;
    try {
      saved = JSON.parse(store(LS_G) || "null");
    } catch (e) {}
    gchkEl.innerHTML = "";
    idx.g.forEach(function (name, i) {
      var on = saved ? saved.indexOf(i) >= 0 : true;
      if (on) selG[i] = 1;
      var n = 0;
      for (var k = 0; k < idx.a.length; k++) if (idx.a[k].g === i) n++;
      var lab = document.createElement("label");
      lab.className = "gc";
      lab.innerHTML =
        '<input type="checkbox" data-g="' +
        i +
        '"' +
        (on ? " checked" : "") +
        "><span>" +
        esc(name) +
        "<em>" +
        n +
        "</em></span>";
      gchkEl.appendChild(lab);
    });
    gchkEl.addEventListener("change", function (e) {
      var cb = e.target;
      if (!cb || cb.tagName !== "INPUT") return;
      var g = +cb.getAttribute("data-g");
      if (cb.checked) selG[g] = 1;
      else delete selG[g];
      store(LS_G, JSON.stringify(Object.keys(selG).map(Number)));
      runSearch();
    });
  }

  function countIn(hay, needle) {
    var n = 0,
      i = 0;
    while ((i = hay.indexOf(needle, i)) >= 0) {
      n++;
      i += needle.length;
    }
    return n;
  }

  function runSearch() {
    if (!idx || !sresEl) return;
    var kw = (sqEl.value || "").trim();
    if (!kw) {
      sresEl.innerHTML =
        '<p class="hint">输入关键词，在全部 ' + idx.a.length + " 篇正文中检索</p>";
      return;
    }
    var ts = kw.toLowerCase().split(/\s+/).filter(Boolean);
    var pool = idx.a.filter(function (a) {
      return selG[a.g];
    });
    if (!pool.length) {
      sresEl.innerHTML = '<p class="hint">请至少选择一个游戏</p>';
      return;
    }
    var hits = [];
    for (var k = 0; k < pool.length; k++) {
      var a = pool[k];
      var body = a.x.toLowerCase();
      var title = a.t.toLowerCase();
      var sc = 0,
        allHit = true,
        c;
      for (var i = 0; i < ts.length; i++) {
        var t = ts[i];
        c = countIn(body, t);
        if (!c && title.indexOf(t) < 0) allHit = false;
        if (c) sc += Math.min(c, 30) * 2 + (c > 2 ? 4 : 0);
        if (title.indexOf(t) >= 0) sc += 60;
      }
      if (!allHit) continue;
      if (ts.length > 1) {
        var sp = body.indexOf(kw.toLowerCase());
        sc += sp >= 0 ? 40 : -6;
      }
      var first = body.indexOf(ts[0]);
      if (first >= 0 && first < 300) sc += 8;
      if (a.s.toLowerCase().indexOf(kw.toLowerCase()) >= 0) sc += 25;
      hits.push({ a: a, sc: sc });
    }
    if (!hits.length) {
      sresEl.innerHTML =
        '<p class="hint">没有找到「' + esc(kw) + "」，试试更短的关键词</p>";
      return;
    }
    hits.sort(function (x, y) {
      return y.sc - x.sc;
    });
    var top = hits.slice(0, 60);
    var q = encodeURIComponent(kw);
    var html = top
      .map(function (h) {
        return (
          '<a class="sr" href="' +
          BASE +
          "/p/" +
          h.a.i +
          ".html?q=" +
          q +
          '">' +
          '<div class="sr-hd"><span class="sr-g">' +
          esc(idx.g[h.a.g]) +
          '</span><span class="sr-n">' +
          esc(h.a.s) +
          '</span><span class="sr-sc">' +
          (h.sc > 999 ? "999+" : h.sc) +
          "</span></div>" +
          '<div class="sr-x">' +
          snippet(h.a.x, ts) +
          "</div></a>"
        );
      })
      .join("");
    sresEl.innerHTML =
      '<p class="hint">共 ' +
      hits.length +
      " 篇命中" +
      (hits.length > top.length ? "，显示前 " + top.length + " 篇" : "") +
      "</p>" +
      html;
  }

  function snippet(text, ts) {
    var low = text.toLowerCase();
    var pos = -1,
      hit = "";
    for (var i = 0; i < ts.length; i++) {
      var p = low.indexOf(ts[i]);
      if (p >= 0 && (pos < 0 || p < pos)) {
        pos = p;
        hit = ts[i];
      }
    }
    var s, pre, post;
    if (pos < 0) {
      s = text.slice(0, 90);
      pre = "";
      post = "…";
    } else {
      var start = Math.max(0, pos - 34);
      var end = Math.min(text.length, pos + hit.length + 58);
      s = text.slice(start, end);
      pre = start > 0 ? "…" : "";
      post = end < text.length ? "…" : "";
    }
    var out = esc(s.replace(/\n/g, " "));
    ts.forEach(function (t) {
      var e = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(e, "gi"), function (m) {
        return "\u0001" + m + "\u0002";
      });
    });
    return pre + out.replace(/\u0001/g, "<mark>").replace(/\u0002/g, "</mark>") + post;
  }

  var sTimer = null;
  if (sqEl) {
    sqEl.addEventListener("input", function () {
      clearTimeout(sTimer);
      sTimer = setTimeout(function () {
        if (idx) runSearch();
        else loadIndex(runSearch);
      }, 220);
    });
    sqEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(sTimer);
        if (idx) runSearch();
        else loadIndex(runSearch);
        sqEl.blur();
      }
    });
  }

  function openSearch() {
    if (!sheetS) return;
    closeBM();
    sheetS.hidden = false;
    document.body.style.overflow = "hidden";
    loadIndex(runSearch);
    setTimeout(function () {
      if (sqEl) sqEl.focus();
    }, 60);
  }
  function closeSearch() {
    if (!sheetS || sheetS.hidden) return;
    sheetS.hidden = true;
    document.body.style.overflow = "";
  }
  var sOpenBtn = document.getElementById("searchOpen");
  if (sOpenBtn) sOpenBtn.addEventListener("click", openSearch);
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-search]"),
    function (b) {
      b.addEventListener("click", openSearch);
    }
  );
  var sCancel = document.getElementById("sCancel");
  if (sCancel) sCancel.addEventListener("click", closeSearch);

  /* ==================== 书签 ==================== */
  var bmSheet = document.getElementById("bmSheet"),
    bmMask = document.getElementById("bmMask"),
    bmlistEl = document.getElementById("bmlist"),
    bmCountEl = document.getElementById("bmCount");

  function bmGet() {
    try {
      return JSON.parse(store(LS_BM) || "[]");
    } catch (e) {
      return [];
    }
  }
  function bmSet(v) {
    store(LS_BM, JSON.stringify(v));
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var p = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    var hm = p(d.getHours()) + ":" + p(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return "今天 " + hm;
    if (d.getFullYear() === now.getFullYear())
      return d.getMonth() + 1 + "月" + d.getDate() + "日 " + hm;
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }

  function currentArtId() {
    var rd = document.querySelector(".reader");
    return rd ? rd.getAttribute("data-id") : "";
  }

  function renderBM() {
    if (!bmlistEl) return;
    var list = bmGet();
    if (bmCountEl) bmCountEl.textContent = list.length ? list.length + " 条" : "";
    if (!list.length) {
      bmlistEl.innerHTML =
        '<p class="hint">还没有书签<br>在文章里滚到想记的位置，点上面「记录当前位置」</p>';
      return;
    }
    var cur = currentArtId();
    bmlistEl.innerHTML =
      '<div class="bmg">' +
      list
        .map(function (b, i) {
          var href =
            BASE +
            "/p/" +
            b.id +
            ".html?y=" +
            (b.y || 0) +
            (b.q ? "&q=" + encodeURIComponent(b.q) : "");
          return (
            '<div class="bi' +
            (b.id === cur ? " here" : "") +
            '"><a class="bi-go" href="' +
            href +
            '" data-id="' +
            b.id +
            '" data-y="' +
            (b.y || 0) +
            '"><div class="bi-t">' +
            esc(b.t || "") +
            "</div>" +
            (b.ex ? '<div class="bi-x">' + esc(b.ex) + "</div>" : "") +
            '<div class="bi-m">' +
            esc(b.g || "") +
            " · " +
            fmtTime(b.ts) +
            '</div></a><button class="bi-del" data-i="' +
            i +
            '" aria-label="删除书签">×</button></div>'
          );
        })
        .join("") +
      "</div>";

    Array.prototype.forEach.call(
      bmlistEl.querySelectorAll(".bi-go"),
      function (a) {
        a.addEventListener("click", function (e) {
          if (a.getAttribute("data-id") === cur) {
            e.preventDefault();
            closeBM();
            window.scrollTo({
              top: +a.getAttribute("data-y") || 0,
              behavior: "smooth",
            });
          }
        });
      }
    );
    Array.prototype.forEach.call(
      bmlistEl.querySelectorAll(".bi-del"),
      function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var l = bmGet();
          l.splice(+btn.getAttribute("data-i"), 1);
          bmSet(l);
          renderBM();
          toast("已删除书签");
        });
      }
    );
  }

  var curQ = new URLSearchParams(location.search).get("q") || "";

  function addBookmark() {
    var rd = document.querySelector(".reader");
    if (!rd) {
      toast("到文章页里才能记录位置");
      return;
    }
    var id = rd.getAttribute("data-id");
    var h1 = document.querySelector("article h1");
    var gEl = document.querySelector(".meta span");
    var y = Math.round(window.scrollY || document.documentElement.scrollTop || 0);
    var ex = "";
    var nodes = document.querySelectorAll("article p, article h2, article h3");
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.bottom > 90) {
        ex = nodes[i].textContent.trim().slice(0, 50);
        break;
      }
    }
    var item = {
      id: id,
      t: h1 ? h1.textContent : "",
      g: gEl ? gEl.textContent : "",
      y: y,
      ex: ex,
      q: curQ,
      ts: Date.now(),
    };
    var list = bmGet();
    var dup = -1;
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === id && Math.abs((list[j].y || 0) - y) < 400) {
        dup = j;
        break;
      }
    }
    if (dup >= 0) list[dup] = item;
    else list.unshift(item);
    bmSet(list);
    renderBM();
    toast(dup >= 0 ? "已更新这条书签" : "已记录当前位置");
  }

  function openBM() {
    if (!bmSheet) return;
    closeSearch();
    renderBM();
    bmMask.hidden = false;
    bmSheet.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeBM() {
    if (!bmSheet || bmSheet.hidden) return;
    bmSheet.hidden = true;
    if (bmMask) bmMask.hidden = true;
    document.body.style.overflow = "";
  }
  var bmBtn = document.getElementById("bmBtn");
  if (bmBtn) bmBtn.addEventListener("click", openBM);
  var bmClose = document.getElementById("bmClose");
  if (bmClose) bmClose.addEventListener("click", closeBM);
  if (bmMask) bmMask.addEventListener("click", closeBM);
  var bmSave = document.getElementById("bmSave");
  if (bmSave) bmSave.addEventListener("click", addBookmark);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (sheetS && !sheetS.hidden) closeSearch();
    else if (bmSheet && !bmSheet.hidden) closeBM();
  });

  /* ==================== 文章页 ==================== */
  var reader = document.querySelector(".reader");

  function markNode(node, ts) {
    var s = node.nodeValue;
    if (!s) return;
    var low = s.toLowerCase();
    var ranges = [];
    ts.forEach(function (t) {
      var i = 0;
      while ((i = low.indexOf(t, i)) >= 0) {
        ranges.push([i, i + t.length]);
        i += t.length;
      }
    });
    if (!ranges.length) return;
    ranges.sort(function (a, b) {
      return a[0] - b[0];
    });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    });
    var frag = document.createDocumentFragment(),
      cur = 0;
    merged.forEach(function (r) {
      if (r[0] > cur) frag.appendChild(document.createTextNode(s.slice(cur, r[0])));
      var m = document.createElement("mark");
      m.textContent = s.slice(r[0], r[1]);
      frag.appendChild(m);
      cur = r[1];
    });
    if (cur < s.length) frag.appendChild(document.createTextNode(s.slice(cur)));
    node.parentNode.replaceChild(frag, node);
  }

  function highlightQuery(q) {
    var ts = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!ts.length) return null;
    var nodes = document.querySelectorAll("article p, article h2, article h3");
    var first = null,
      firstAll = false,
      cnt = 0;
    for (var i = 0; i < nodes.length && cnt < 40; i++) {
      var el = nodes[i];
      var txt = el.textContent.toLowerCase();
      var any = false,
        all = true;
      for (var k = 0; k < ts.length; k++) {
        if (txt.indexOf(ts[k]) >= 0) any = true;
        else all = false;
      }
      if (!any) continue;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var tns = [],
        n;
      while ((n = walker.nextNode())) tns.push(n);
      tns.forEach(function (tn) {
        markNode(tn, ts);
      });
      if (!first || (all && !firstAll)) {
        first = el;
        firstAll = all;
      }
      cnt++;
    }
    return first;
  }

  if (reader) {
    var id = reader.getAttribute("data-id") || "";
    var map = readMap();
    map[id] = 1;
    store(LS_READ, JSON.stringify(map));
    store(
      LS_LAST,
      JSON.stringify({
        id: id,
        href: location.pathname.split("/").pop(),
        t: Date.now(),
      })
    );

    var prog = document.getElementById("prog");
    var totop = document.getElementById("totop");
    function onScroll() {
      var h = document.documentElement;
      var top = h.scrollTop || document.body.scrollTop;
      var max = h.scrollHeight - h.clientHeight;
      if (prog) prog.style.width = (max > 0 ? (top / max) * 100 : 0) + "%";
      if (totop) totop.classList.toggle("on", top > 700);
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (totop)
      totop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

    var viewer = document.getElementById("viewer");
    var vimg = viewer ? viewer.querySelector("img") : null;
    var zi = 0;
    function setZoom(n) {
      zi = n;
      viewer.classList.toggle("zoom", n === 1);
      viewer.classList.toggle("zoom2", n === 2);
    }
    function openViewer(img) {
      vimg.src = img.getAttribute("data-hq") || img.currentSrc || img.src;
      viewer.hidden = false;
      setZoom(0);
      viewer.scrollTop = 0;
      document.body.style.overflow = "hidden";
    }
    function closeViewer() {
      viewer.hidden = true;
      vimg.removeAttribute("src");
      document.body.style.overflow = "";
      setZoom(0);
    }
    Array.prototype.forEach.call(
      document.querySelectorAll("article img"),
      function (img) {
        img.addEventListener("click", function () {
          openViewer(img);
        });
      }
    );
    if (viewer) {
      var tapTimer = null;
      viewer.addEventListener("click", function () {
        if (tapTimer) {
          clearTimeout(tapTimer);
          tapTimer = null;
          setZoom((zi + 1) % 3);
          return;
        }
        tapTimer = setTimeout(function () {
          tapTimer = null;
          closeViewer();
        }, 260);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !viewer.hidden) closeViewer();
      });
    }

    var params = new URLSearchParams(location.search);
    var qp = params.get("q");
    var yp = params.get("y");

    /* 关掉 CSS 的 scroll-behavior: smooth，否则长页面上定位要"飞"几秒 */
    function jumpTo(top) {
      var de = document.documentElement;
      var old = de.style.scrollBehavior;
      de.style.scrollBehavior = "auto";
      window.scrollTo(0, top);
      requestAnimationFrame(function () {
        de.style.scrollBehavior = old;
      });
    }

    if (qp) {
      var anchor = highlightQuery(qp);
      if (yp === null && anchor) {
        setTimeout(function () {
          var top = anchor.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
          jumpTo(Math.max(0, top));
        }, 260);
      }
    }
    if (yp !== null) {
      setTimeout(function () {
        jumpTo(+yp || 0);
      }, 300);
    }
  }

  /* ==================== 目录页 ==================== */
  var listWrap = document.getElementById("list");
  if (listWrap) {
    var map2 = readMap();
    Array.prototype.forEach.call(
      listWrap.querySelectorAll("a[data-id]"),
      function (a) {
        if (map2[a.getAttribute("data-id")]) a.classList.add("read");
      }
    );
    var last = null;
    try {
      last = JSON.parse(store(LS_LAST) || "null");
    } catch (e) {}
    var cont = document.getElementById("cont");
    if (cont && last && last.id) {
      var curA = listWrap.querySelector('a[data-id="' + last.id + '"]');
      if (curA) {
        cont.hidden = false;
        cont.href = curA.getAttribute("href");
        cont.textContent =
          "继续上次阅读 · " + curA.querySelector(".tt").textContent + " →";
      }
    }
  }
})();
