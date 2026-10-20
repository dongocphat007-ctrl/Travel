/**
 * lazy-libs.js – Nạp thư viện nặng KHI CẦN, không nạp lúc mở trang.
 *   jspdf (+ font tiếng Việt) · docx · pdfjs · mammoth · xlsx
 * Dùng:  await LazyLibs.load("jspdf");   await LazyLibs.load("pdfjs", "mammoth");
 * Mỗi thư viện chỉ tải 1 lần (kết quả được nhớ lại); lỗi mạng thì lần sau thử lại.
 */
window.LazyLibs = (function () {
  const CDN = "https://cdnjs.cloudflare.com/ajax/libs/";
  const LIBS = {
    jspdf:   { src: CDN + "jspdf/2.5.1/jspdf.umd.min.js",                    ready: () => window.jspdf || window.jsPDF },
    pdffont: { src: "js/pdf-font.js", needs: ["jspdf"],                      ready: () => window.PDF_FONTS },   // font DejaVu ~230 KB, chỉ nạp cùng jsPDF
    docx:    { src: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", ready: () => window.docx },
    pdfjs:   { src: CDN + "pdf.js/3.11.174/pdf.min.js",                      ready: () => window.pdfjsLib },
    mammoth: { src: CDN + "mammoth/1.6.0/mammoth.browser.min.js",            ready: () => window.mammoth },
    xlsx:    { src: CDN + "xlsx/0.18.5/xlsx.full.min.js",                    ready: () => window.XLSX },
  };
  const cache = {};

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error("Không tải được " + src)); };
      document.head.appendChild(s);
    });
  }

  function loadOne(name) {
    const lib = LIBS[name];
    if (!lib) return Promise.reject(new Error("Thư viện không tồn tại: " + name));
    if (lib.ready()) return Promise.resolve(lib.ready());
    if (cache[name]) return cache[name];
    cache[name] = Promise.all((lib.needs || []).map(loadOne))
      .then(() => loadScript(lib.src))
      .then(() => lib.ready())
      .catch((e) => { delete cache[name]; throw e; });     // cho phép thử lại
    return cache[name];
  }

  const load = (...names) => Promise.all(names.map(loadOne)).then((r) => (r.length === 1 ? r[0] : r));

  // Tải sẵn khi trình duyệt rảnh (vd. khi người dùng mở popup Xuất / Nhập) — không bắt buộc
  const preload = (...names) => {
    const go = () => names.forEach((n) => loadOne(n).catch(() => {}));
    (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(go);
  };

  return { load, preload };
})();
