/**
 * js/weather.js – Thời tiết hiện tại của điểm đến tour qua Open-Meteo (mục 7.2 → 7.4)
 * Gọi API TRỰC TIẾP từ trình duyệt (Open-Meteo cho phép CORS, không cần API key):
 *   Weather.fetchWeather(lat, lon)  → { temperature, unit, code, description, icon, isDay, time, lat, lon }
 *   Weather.parseCurrent(json)      → như trên, từ JSON thô của Open-Meteo (thuần, test được)
 *   Weather.describeCode(code, isDay) → { description, icon }  (mã thời tiết WMO)
 *   Weather.locationOf(tourId)      → { country, city, lat, lng } từ /api/locations (mục 7.1)
 *   Weather.parseRain(json)         → { today, hourlyMax } khả năng mưa % (mục 7.5)
 *   Weather.parseDaily(json, n)     → [{ date, tmax, tmin, code, description, icon, rain }] dự báo n ngày (mục 7.7)
 *   Weather.weatherHtml(data)       → chuỗi HTML khối thời tiết (thuần, test được) (mục 7.6)
 *   Weather.renderWeather(el, id)   → vẽ khối thời tiết vào el; lỗi/thiếu toạ độ → "Chưa có dữ liệu thời tiết" (7.6, 7.8)
 * Dùng được cả trong Node để kiểm thử (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Weather = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var ENDPOINT = "https://api.open-meteo.com/v1/forecast";
  var TIMEOUT_MS = 8000;
  var FORECAST_DAYS = 6;        // hôm nay + 5 ngày tới (7.7)
  var NO_DATA = "Chưa có thông tin thời tiết cho điểm đến này.";   // 7.8

  // 7.4 Mã thời tiết WMO (https://open-meteo.com/en/docs) → mô tả tiếng Việt + icon. [mô tả, icon ban ngày, icon ban đêm]
  var WMO = {
    0: ["Trời quang", "☀️", "🌙"], 1: ["Gần như quang đãng", "🌤️", "🌙"], 2: ["Có mây rải rác", "⛅", "☁️"], 3: ["Nhiều mây", "☁️", "☁️"],
    45: ["Sương mù", "🌫️", "🌫️"], 48: ["Sương mù đóng băng", "🌫️", "🌫️"],
    51: ["Mưa phùn nhẹ", "🌦️", "🌧️"], 53: ["Mưa phùn", "🌦️", "🌧️"], 55: ["Mưa phùn dày", "🌧️", "🌧️"],
    56: ["Mưa phùn lạnh nhẹ", "🌧️", "🌧️"], 57: ["Mưa phùn lạnh dày", "🌧️", "🌧️"],
    61: ["Mưa nhẹ", "🌦️", "🌧️"], 63: ["Mưa vừa", "🌧️", "🌧️"], 65: ["Mưa to", "🌧️", "🌧️"],
    66: ["Mưa lạnh nhẹ", "🌧️", "🌧️"], 67: ["Mưa lạnh to", "🌧️", "🌧️"],
    71: ["Tuyết nhẹ", "🌨️", "🌨️"], 73: ["Tuyết vừa", "🌨️", "🌨️"], 75: ["Tuyết dày", "❄️", "❄️"], 77: ["Hạt tuyết", "❄️", "❄️"],
    80: ["Mưa rào nhẹ", "🌦️", "🌧️"], 81: ["Mưa rào", "🌧️", "🌧️"], 82: ["Mưa rào rất to", "⛈️", "⛈️"],
    85: ["Mưa tuyết nhẹ", "🌨️", "🌨️"], 86: ["Mưa tuyết to", "🌨️", "🌨️"],
    95: ["Dông", "⛈️", "⛈️"], 96: ["Dông kèm mưa đá nhẹ", "⛈️", "⛈️"], 99: ["Dông kèm mưa đá to", "⛈️", "⛈️"]
  };

  // isDay: 1/true/undefined = ban ngày; 0/false = ban đêm (chỉ khác icon của trời quang / ít mây / mưa nhẹ)
  function describeCode(code, isDay) {
    var n = typeof code === "number" ? code : (typeof code === "string" && /^\d+$/.test(code) ? +code : NaN);
    var row = WMO[n];
    if (!row) return { description: "Không xác định", icon: "❔" };
    var night = isDay === 0 || isDay === false;
    return { description: row[0], icon: night ? row[2] : row[1] };
  }

  function validCoords(lat, lon) {
    return typeof lat === "number" && typeof lon === "number" && isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function buildUrl(lat, lon) {
    return ENDPOINT + "?latitude=" + encodeURIComponent(lat) + "&longitude=" + encodeURIComponent(lon) +
      "&current=temperature_2m,weather_code,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=" + FORECAST_DAYS + "&timezone=auto";
  }

  /**
   * 7.3 + 7.4 Đọc phần "current" của Open-Meteo. Thiếu/sai dữ liệu → ném lỗi (không bịa số).
   * temperature: °C làm tròn 1 chữ số; code → description + icon.
   */
  function parseCurrent(json) {
    var c = json && json.current;
    if (!c || typeof c !== "object") throw new Error("Open-Meteo không trả dữ liệu hiện tại");
    var t = c.temperature_2m;
    if (typeof t !== "number" || !isFinite(t)) throw new Error("Thiếu nhiệt độ hiện tại");
    var isDay = c.is_day === 0 ? 0 : 1;
    var d = describeCode(c.weather_code, isDay);
    return {
      temperature: Math.round(t * 10) / 10,
      unit: (json.current_units && json.current_units.temperature_2m) || "°C",
      code: typeof c.weather_code === "number" ? c.weather_code : null,
      description: d.description, icon: d.icon, isDay: isDay === 1,
      time: c.time || null, lat: json.latitude, lon: json.longitude,
      rain: parseRain(json).today,          // 7.5
      daily: parseDaily(json)               // 7.7
    };
  }


  function pct(v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null; }

  /**
   * 7.5 Khả năng mưa (%) từ Open-Meteo. today = xác suất mưa cao nhất hôm nay (daily.precipitation_probability_max[0]).
   * Thiếu / ngoài 0–100 → null (không bịa số; khác với 0% = "gần như không mưa").
   */
  function parseRain(json) {
    var d = json && json.daily;
    var arr = d && Array.isArray(d.precipitation_probability_max) ? d.precipitation_probability_max : [];
    return { today: pct(arr[0]), days: arr.map(pct) };
  }

  /**
   * 7.7 Dự báo các ngày tới (bỏ hôm nay, tối đa n ngày, mặc định 5). Ngày thiếu ngày/nhiệt độ thì bỏ qua cả dòng.
   * Thiếu hẳn phần daily → [] (khối thời tiết hiện tại vẫn hiện bình thường).
   */
  function parseDaily(json, n) {
    var d = json && json.daily;
    if (!d || !Array.isArray(d.time)) return [];
    var max = typeof n === "number" && n > 0 ? Math.floor(n) : 5;
    var rain = parseRain(json).days, out = [];
    for (var i = 1; i < d.time.length && out.length < max; i++) {   // i = 0 là hôm nay → đã có ở khối "hiện tại"
      var hi = d.temperature_2m_max && d.temperature_2m_max[i], lo = d.temperature_2m_min && d.temperature_2m_min[i];
      if (typeof d.time[i] !== "string" || typeof hi !== "number" || typeof lo !== "number" || !isFinite(hi) || !isFinite(lo)) continue;
      var w = describeCode(d.weather_code && d.weather_code[i], 1);
      out.push({ date: d.time[i], tmax: Math.round(hi), tmin: Math.round(lo), code: d.weather_code ? d.weather_code[i] : null,
                 description: w.description, icon: w.icon, rain: rain[i] === undefined ? null : rain[i] });
    }
    return out;
  }

  var DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  function dayLabel(iso) {                       // "2026-10-17" → "T7 17/10" (không phụ thuộc múi giờ máy)
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return String(iso || "");
    var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DOW[dt.getUTCDay()] + " " + m[3] + "/" + m[2];
  }
  function esc(x) { return String(x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /** 7.6 + 7.7 HTML khối thời tiết. data = kết quả fetchWeather (có rain, daily); data null/lỗi → 7.8 */
  function weatherHtml(data, place) {
    if (!data || typeof data.temperature !== "number") return '<div class="wx-empty">' + NO_DATA + '</div>';
    var rainTxt = data.rain != null ? "🌧️ Khả năng mưa hôm nay: <b>" + data.rain + "%</b>" : "🌧️ Chưa có dự báo khả năng mưa";
    var h = '<div class="wx-now"><span class="wx-icon" aria-hidden="true">' + data.icon + '</span>' +
      '<div><div class="wx-temp">' + esc(data.temperature) + esc(data.unit) + '</div>' +
      '<div class="wx-desc">' + esc(data.description) + (place ? " · " + esc(place) : "") + '</div>' +
      '<div class="wx-rain">' + rainTxt + '</div></div></div>';
    if (data.daily && data.daily.length) {
      h += '<ul class="wx-days" aria-label="Dự báo các ngày tới">' + data.daily.map(function (d) {
        return '<li class="wx-day"><span class="wx-dl">' + esc(dayLabel(d.date)) + '</span><span class="wx-di" title="' + esc(d.description) + '">' + d.icon + '</span>' +
          '<span class="wx-dt"><b>' + d.tmax + '°</b> / ' + d.tmin + '°</span>' +
          '<span class="wx-dr">' + (d.rain != null ? "💧" + d.rain + "%" : "") + '</span></li>';
      }).join("") + '</ul>';
    }
    return h;
  }

  /**
   * 7.6 Vẽ khối thời tiết vào phần tử el cho tour tourId. 7.8: không có toạ độ / API lỗi → "Chưa có dữ liệu thời tiết".
   * Không ném lỗi ra ngoài; nếu el đã bị gỡ khỏi trang (đóng modal) trong lúc chờ thì bỏ qua.
   */
  async function renderWeather(el, tourId, opts) {
    if (!el) return;
    el.innerHTML = '<div class="wx-loading">Đang xem thông tin thời tiết…</div>';
    var html;
    try {
      var loc = await locationOf(tourId);
      if (!loc || !validCoords(+loc.lat, +loc.lng)) throw new Error("Tour chưa có toạ độ");
      var data = await fetchWeather(loc.lat, loc.lng, opts);
      html = weatherHtml(data, loc.city);
    } catch (e) {
      html = weatherHtml(null);
    }
    if (el.isConnected === false) return;
    el.innerHTML = html;
  }

  /**
   * 7.2 Gọi Open-Meteo từ trình duyệt. opts: { fetch (để test), timeout (ms) }.
   * Lỗi (toạ độ sai, mạng, HTTP != 2xx, quá thời gian, JSON lạ) → reject với Error có message tiếng Việt.
   */
  async function fetchWeather(lat, lon, opts) {
    opts = opts || {};
    lat = typeof lat === "string" && lat.trim() !== "" ? +lat : lat;
    lon = typeof lon === "string" && lon.trim() !== "" ? +lon : lon;
    if (!validCoords(lat, lon)) throw new Error("Toạ độ không hợp lệ");
    var doFetch = opts.fetch || (typeof fetch === "function" ? fetch : null);
    if (!doFetch) throw new Error("Trình duyệt không hỗ trợ fetch");
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || TIMEOUT_MS) : null;
    var res;
    try {
      res = await doFetch(buildUrl(lat, lon), ctl ? { signal: ctl.signal } : undefined);
    } catch (e) {
      throw new Error(e && e.name === "AbortError" ? "Hết thời gian chờ dịch vụ thời tiết" : "Không kết nối được dịch vụ thời tiết");
    } finally { if (timer) clearTimeout(timer); }
    if (!res || !res.ok) throw new Error("Dịch vụ thời tiết lỗi" + (res && res.status ? " (HTTP " + res.status + ")" : ""));
    var json;
    try { json = await res.json(); } catch (e) { throw new Error("Dữ liệu thời tiết không đọc được"); }
    if (json && json.error) throw new Error("Dịch vụ thời tiết từ chối: " + (json.reason || "lỗi không rõ"));
    return parseCurrent(json);
  }

  // Vị trí của tour (7.1): /api/locations, không có server thì đọc data/locations.json
  var locCache = null;
  async function locationOf(tourId) {
    if (!locCache) {
      var list = null;
      try { var r = await fetch("/api/locations"); if (r.ok) list = (await r.json()).locations; } catch (e) { /* thử file */ }
      if (!list) { try { list = (await (await fetch("data/locations.json")).json()).locations; } catch (e) { list = []; } }
      locCache = new Map((list || []).map(function (l) { return [String(l.tourId), l]; }));
    }
    return locCache.get(String(tourId)) || null;
  }

  return { parseRain: parseRain, parseDaily: parseDaily, weatherHtml: weatherHtml, renderWeather: renderWeather, dayLabel: dayLabel, NO_DATA: NO_DATA, fetchWeather: fetchWeather, parseCurrent: parseCurrent, describeCode: describeCode, buildUrl: buildUrl, locationOf: locationOf, WMO: WMO };
});
