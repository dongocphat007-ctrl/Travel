/**
 * include.js – Nhúng các mảnh HTML trong thư mục html/ vào index.html
 * Mỗi chức năng (trang / popup / navbar / footer) nằm trong 1 file riêng.
 *
 * Cách dùng (đặt đúng chỗ muốn chèn trong index.html):
 *     <script>includeHtml('html/navbar.html')</script>
 *
 * Vì sao dùng XMLHttpRequest đồng bộ + document.write?
 * → Nội dung được chèn NGAY lúc trình duyệt đọc trang, đúng thứ tự như khi
 *   viết thẳng trong index.html, nên các file js (DOMContentLoaded, getElementById…)
 *   chạy y như trước, không phải sửa gì.
 *
 * ⚠ Trang phải chạy qua web server (VS Code "Live Server", `python -m http.server`…),
 *   vì trình duyệt chặn đọc file khi mở trực tiếp index.html bằng file://
 */
function includeHtml(path) {
  let xhr = new XMLHttpRequest();
  try {
    xhr.open("GET", path, false);          // false = đồng bộ
    xhr.send();
  } catch (e) {
    return includeFail(path, e.message);
  }
  if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
    document.write(xhr.responseText);
  } else {
    includeFail(path, "HTTP " + xhr.status);
  }
}

function includeFail(path, why) {
  console.error("[include] Không nạp được " + path + " (" + why + ")");
  if (window.__includeWarned) return;
  window.__includeWarned = true;
  document.write(
    '<div style="position:fixed;inset:0;z-index:99999;background:#fff;color:#111;padding:32px;font:16px/1.6 sans-serif">' +
    '<h2 style="color:#b91c1c">Không nạp được giao diện (' + path + ")</h2>" +
    "<p>Trang đang được mở bằng <code>file://</code> nên trình duyệt chặn đọc các file trong thư mục <code>html/</code>.</p>" +
    "<p>Hãy chạy bằng web server:</p><ul>" +
    "<li>VS Code: cài tiện ích <b>Live Server</b> → chuột phải <code>index.html</code> → <i>Open with Live Server</i></li>" +
    "<li>hoặc mở terminal trong thư mục dự án: <code>python -m http.server 8000</code> rồi vào <code>http://localhost:8000</code></li>" +
    "</ul></div>"
  );
}
