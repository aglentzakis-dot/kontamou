/* ============================================================
   Οθόνη έναρξης GlenApps — κοινό αρχείο για όλες τις εφαρμογές
   © Ανδρέας Μ. Γλεντζάκης — GlenApps

   Χρήση: πρώτη γραμμή μέσα στο <head> του index.html:
   <script src="othoni-enarxis.js"
           data-eikona="othoni-enarxis.webp"
           data-titlos="Κοντά μου"
           data-ypotitlos="Ό,τι χρειάζεσαι, δίπλα σου."
           data-xroma-pano="#FFE14A"
           data-xroma-kato="#F7A600"></script>

   Για μετάφραση: πριν από αυτό το script μπορείς να ορίσεις
   window.OTHONI_ENARXIS = { titlos: "...", ypotitlos: "..." };
   ============================================================ */
(function () {
  "use strict";
  var tag = document.currentScript || {};
  var ds = tag.dataset || {};
  var c = window.OTHONI_ENARXIS || {};

  var eikona   = c.eikona   || ds.eikona   || "othoni-enarxis.webp";
  var titlos   = c.titlos   || ds.titlos   || document.title || "";
  var ypotitlos= c.ypotitlos|| ds.ypotitlos|| "";
  var pano     = c.xromaPano|| ds.xromaPano|| "#FFE14A";
  var kato     = c.xromaKato|| ds.xromaKato|| "#F7A600";
  var diarkeia = +(c.diarkeia || ds.diarkeia || 1600); // χιλιοστά δευτερολέπτου
  var keimeno  = c.xromaKeimenou || ds.xromaKeimenou || "#14213D";

  var hremia = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var css =
    "#ge-enarxi{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:2.2vh;padding:4vh 6vw calc(4vh + env(safe-area-inset-bottom));" +
    "background:radial-gradient(120% 80% at 50% 38%," + pano + " 0%," + kato + " 100%);" +
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif;color:" + keimeno + ";" +
    "opacity:1;transition:opacity .45s ease;-webkit-tap-highlight-color:transparent;cursor:pointer;box-sizing:border-box}" +
    "#ge-enarxi.ge-svinei{opacity:0;pointer-events:none}" +
    "#ge-enarxi img{width:min(84vw,56vh);height:auto;display:block;" +
    "filter:drop-shadow(0 2.2vh 3vh rgba(120,60,0,.35));" +
    (hremia ? "" : "animation:ge-mpainei .7s cubic-bezier(.2,.9,.3,1.2) both;") + "}" +
    "#ge-enarxi h1{margin:1vh 0 0;font-size:clamp(30px,5.4vh,52px);font-weight:800;letter-spacing:-.5px;text-align:center;line-height:1.1;" +
    (hremia ? "" : "animation:ge-anevainei .6s .15s ease both;") + "}" +
    "#ge-enarxi p{margin:0;font-size:clamp(16px,2.5vh,22px);font-weight:600;opacity:.85;text-align:center;" +
    (hremia ? "" : "animation:ge-anevainei .6s .25s ease both;") + "}" +
    "#ge-enarxi .ge-ypografi{position:absolute;bottom:calc(2.5vh + env(safe-area-inset-bottom));left:0;right:0;" +
    "text-align:center;font-size:13px;font-weight:700;letter-spacing:2px;opacity:.6}" +
    "@keyframes ge-mpainei{from{transform:scale(.82);opacity:0}to{transform:scale(1);opacity:1}}" +
    "@keyframes ge-anevainei{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}";

  var style = document.createElement("style");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  var div = document.createElement("div");
  div.id = "ge-enarxi";
  div.setAttribute("role", "presentation");
  div.innerHTML =
    '<img alt="" src="' + eikona + '">' +
    (titlos ? "<h1></h1>" : "") +
    (ypotitlos ? "<p></p>" : "") +
    '<div class="ge-ypografi">GlenApps</div>';
  if (titlos) div.querySelector("h1").textContent = titlos;
  if (ypotitlos) div.querySelector("p").textContent = ypotitlos;
  document.documentElement.appendChild(div);

  var arxi = Date.now(), egine = false;
  function svise() {
    if (egine) return; egine = true;
    div.classList.add("ge-svinei");
    setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 500);
  }
  function otanFortosei() {
    var ypoloipo = Math.max(0, diarkeia - (Date.now() - arxi));
    setTimeout(svise, ypoloipo);
  }
  div.addEventListener("click", svise);
  if (document.readyState === "complete") otanFortosei();
  else window.addEventListener("load", otanFortosei);
  setTimeout(svise, 6000); // ασφάλεια: ποτέ να μη μείνει κολλημένη

  window.GlenAppsEnarxi = { svise: svise };
})();
