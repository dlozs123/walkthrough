(function () {
  "use strict";

  var LS_FS = "wt_fs";
  var LS_READ = "wt_read";
  var LS_LAST = "wt_last";

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

  /* ---------- 字号 ---------- */
  var sizes = ["s", "m", "l"];
  function applyFs(v) {
    document.documentElement.setAttribute("data-fs", v);
  }
  applyFs(store(LS_FS) || "m");

  var fsBtn = document.getElementById("fsBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", function () {
      var cur = store(LS_FS) || "m";
      var i = sizes.indexOf(cur);
      var nx = sizes[(i + 1) % sizes.length];
      store(LS_FS, nx);
      applyFs(nx);
      this.textContent = { s: "A", m: "A", l: "A" }[nx];
      this.style.fontSize = { s: "12px", m: "14px", l: "16px" }[nx];
    });
    var cur0 = store(LS_FS) || "m";
    fsBtn.style.fontSize = { s: "12px", m: "14px", l: "16px" }[cur0];
  }

  /* ---------- 文章页 ---------- */
  var reader = document.querySelector(".reader");

  if (reader) {
    var id = reader.getAttribute("data-id") || "";
    var map = readMap();
    map[id] = 1;
    store(LS_READ, JSON.stringify(map));
    store(LS_LAST, JSON.stringify({ id: id, href: location.pathname.split("/").pop(), t: Date.now() }));

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

    if (totop) {
      totop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    /* ---------- 图片查看器 ---------- */
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

    Array.prototype.forEach.call(document.querySelectorAll("article img"), function (img) {
      img.addEventListener("click", function () {
        openViewer(img);
      });
    });

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
  }

  /* ---------- 目录页 ---------- */
  var q = document.getElementById("q");
  var listWrap = document.getElementById("list");
  if (listWrap) {
    var map2 = readMap();
    Array.prototype.forEach.call(listWrap.querySelectorAll("a[data-id]"), function (a) {
      if (map2[a.getAttribute("data-id")]) a.classList.add("read");
    });

    var last = null;
    try {
      last = JSON.parse(store(LS_LAST) || "null");
    } catch (e) {}
    var cont = document.getElementById("cont");
    if (cont && last && last.id) {
      var cur = listWrap.querySelector('a[data-id="' + last.id + '"]');
      if (cur) {
        cont.hidden = false;
        cont.href = cur.getAttribute("href");
        cont.textContent = "继续上次阅读 · " + cur.querySelector(".tt").textContent + " →";
      }
    }

    if (q) {
      q.addEventListener("input", function () {
        var kw = this.value.trim().toLowerCase();
        var groups = listWrap.querySelectorAll(".grp");
        Array.prototype.forEach.call(groups, function (g) {
          var shown = 0;
          var gname = (g.getAttribute("data-g") || "").toLowerCase();
          Array.prototype.forEach.call(g.querySelectorAll("li"), function (li) {
            var a = li.querySelector("a");
            var full = ((a && a.getAttribute("data-t")) || "").toLowerCase();
            var hit = !kw || full.indexOf(kw) >= 0 || gname.indexOf(kw) >= 0;
            li.style.display = hit ? "" : "none";
            if (hit) shown++;
          });
          g.style.display = shown ? "" : "none";
        });
        var old = document.getElementById("nores");
        if (old) old.remove();
        var total = listWrap.querySelectorAll("li:not([style*='none'])").length;
        if (!total) {
          var d = document.createElement("p");
          d.id = "nores";
          d.className = "empty";
          d.textContent = "没有匹配的章节";
          listWrap.appendChild(d);
        }
      });
    }
  }
})();
