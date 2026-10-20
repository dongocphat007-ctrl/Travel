/**
 * storage.js – Quản lý LocalStorage (per-user)
 * Key lưu trữ gồm userId để tài khoản mới không thấy dữ liệu mẫu
 * Phụ thuộc: auth.js (Auth.getUser)
 */

const StorageManager = (() => {
  const BASE_KEY = "travel_v2";

  // Trả về key riêng cho từng user, hoặc key khách nếu chưa đăng nhập
  const _key = () => {
    try {
      const u = JSON.parse(localStorage.getItem("travel_auth_v1"));
      return u?.id ? `${BASE_KEY}__${u.id}` : `${BASE_KEY}__guest`;
    } catch { return `${BASE_KEY}__guest`; }
  };

  // Đọc toàn bộ dữ liệu từ localStorage
  const load = () => {
    try {
      const raw = localStorage.getItem(_key());
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("StorageManager.load error:", err);
      return [];
    }
  };

  // Lưu toàn bộ dữ liệu vào localStorage
  const save = (trips) => {
    try {
      localStorage.setItem(_key(), JSON.stringify(trips));
      return true;
    } catch (err) {
      console.error("StorageManager.save error:", err);
      return false;
    }
  };

  // Xóa toàn bộ dữ liệu của user hiện tại
  const clear = () => {
    localStorage.removeItem(_key());
  };

  return { load, save, clear };
})();
