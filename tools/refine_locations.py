#!/usr/bin/env python3
"""Nâng toạ độ tour trong frontend/data/locations.json từ "tâm tỉnh" (precision=province) lên "điểm đến" (city | place).

Cách làm (không gọi mạng, không đoán bừa):
  1. Lấy điểm đến đầu tiên của tour từ trường destination/dest (không có thì từ tên tour), bỏ qua điểm xuất phát Hà Nội / TP.HCM
     khi phía sau còn điểm khác (vd. "Hà Nội – Mộc Châu" → Mộc Châu).
  2. Điểm đến phải có trong tools/places-vn.json. Nếu điểm đầu tiên là tên tỉnh chung chung và chỉ có 1 đoạn
     (vd. destination "Kiên Giang", tên tour "Phú Quốc đảo ngọc 4 ngày"), tìm địa danh trong TÊN tour.
  3. Không khớp → giữ nguyên toạ độ tỉnh (precision=province). Điểm mới cách toạ độ tỉnh cũ > MAX_KM → bỏ qua và in cảnh báo.
Chỉ đụng các mục precision=province; giữ nguyên `city` (tên tỉnh, RAG và bộ lọc đang dùng), thêm `place`, `source`.
Chạy:  python3 tools/refine_locations.py [--dry-run]
"""
import glob, json, math, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "frontend", "data")
MAX_KM = 350
WORD = r"[0-9A-Za-zÀ-ỹ]"


def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def segments(text):
    text = re.sub(r"\s+\d+\s*(N\d+Đ|ngày|tuần).*$", "", text or "", flags=re.I)   # bỏ "3N2Đ", "3 ngày 2 đêm…"
    return [s.strip() for s in re.split(r"\s*[–\-·,/&]\s*", text) if s.strip()]


def main():
    dry = "--dry-run" in sys.argv
    places = json.load(open(os.path.join(ROOT, "tools", "places-vn.json"), encoding="utf-8"))["places"]
    by_alias = {}
    for p in places:
        for a in p["alias"]:
            by_alias[norm(a)] = p
    aliases = sorted(by_alias, key=len, reverse=True)

    tours = {}
    for f in ["tours-detail.json"] + sorted(os.path.relpath(x, DATA) for x in glob.glob(os.path.join(DATA, "tours", "*.json"))):
        for t in json.load(open(os.path.join(DATA, f), encoding="utf-8")).get("tours", []):
            tours[str(t["id"])] = t

    path = os.path.join(DATA, "locations.json")
    doc = json.load(open(path, encoding="utf-8"))

    def find_in_name(name):
        low = norm(name)
        best = None
        for a in aliases:
            m = re.search(r"(?<!%s)%s(?!%s)" % (WORD, re.escape(a), WORD), low)
            if m and not by_alias[a].get("origin") and (best is None or m.start() < best[0]):
                best = (m.start(), by_alias[a])
        return best[1] if best else None

    def pick(t):
        dest = t.get("destination") or t.get("dest") or ""
        segs = segments(dest) or segments(t.get("name", ""))
        if len(segs) == 1 and norm(segs[0]) not in by_alias:   # chỉ có tên tỉnh chung chung → xem tên tour
            return find_in_name(t.get("name", ""))
        for s in segs:
            p = by_alias.get(norm(s))
            if p is None:
                return None                                    # điểm đầu là tỉnh/vùng chưa có trong bảng → giữ toạ độ tỉnh
            if not p.get("origin"):
                return p
        return by_alias.get(norm(segs[0])) if segs else None   # toàn điểm xuất phát (vd. chỉ "Hà Nội")

    stat, far, kept = Counter(), [], Counter()
    for loc in doc["locations"]:
        if loc.get("precision") != "province":
            continue
        t = tours.get(str(loc["tourId"]))
        p = pick(t) if t else None
        if not p:
            stat["giữ tỉnh"] += 1
            kept[loc.get("city")] += 1
            continue
        d = km((loc["lat"], loc["lng"]), (p["lat"], p["lng"]))
        if d > MAX_KM:
            far.append((loc["tourId"], t.get("name"), loc.get("city"), p["name"], round(d)))
            stat["bỏ (quá xa)"] += 1
            continue
        loc.update({"lat": p["lat"], "lng": p["lng"], "place": p["name"], "precision": p["level"], "approx": True, "source": "gazetteer"})
        stat["nâng → " + p["level"]] += 1

    doc["note"] = ("Tọa độ gần đúng. precision: city = trung tâm thành phố/thị xã · place = điểm đến cụ thể (đảo, đèo, vườn quốc gia, thị trấn du lịch; "
                   "lấy từ tools/places-vn.json bằng tools/refine_locations.py, sai số vài km) · province = tâm tỉnh (chưa xác định được điểm đến cụ thể) · "
                   "country = thủ đô/đại diện của nước. `city` giữ nguyên là tên tỉnh/thành; `place` là tên điểm đến. Chỉnh tay từng tour nếu cần chính xác hơn.")
    print(dict(stat))
    print("Còn precision:", dict(Counter(l["precision"] for l in doc["locations"])))
    for row in far:
        print("XA:", row)
    print("Giữ tỉnh theo tỉnh:", dict(kept.most_common(12)))
    if not dry:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("Đã ghi", path)


if __name__ == "__main__":
    main()
