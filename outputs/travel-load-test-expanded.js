import http from 'k6/http';
import { check } from 'k6';

const base = (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const allowRemote = (__ENV.ALLOW_REMOTE || '').toLowerCase() === 'true';
const validProtocol = /^https?:\/\//i.test(base);
const hasCredentials = /^https?:\/\/[^/]*@/i.test(base);
const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(base);
if (!validProtocol || hasCredentials) {
  throw new Error('BASE_URL khong hop le. Hay dung URL http/https va khong nhung username/password.');
}
if (!isLoopback && !allowRemote) {
  throw new Error('BASE_URL khong phai localhost. Chi do staging sau khi dat ALLOW_REMOTE=true.');
}

const rate = Number.parseInt(__ENV.RATE || '5', 10);
const duration = __ENV.DURATION || '2m';
if (!Number.isInteger(rate) || rate < 1 || rate > 100) {
  throw new Error('RATE phai la so nguyen tu 1 den 100 request/s.');
}

export const options = {
  discardResponseBodies: true,
  scenarios: {
    public_read_traffic: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    dropped_iterations: ['count==0'],
  },
};

// Chỉ GET công khai, không đăng nhập và không ghi/sửa dữ liệu.
// Tránh các API tìm vé/khách sạn live vì có thể gọi nhà cung cấp bên ngoài.
const paths = [
  '/api/health',
  '/api/travel/airports',
  '/api/travel/live-status',
  '/api/tours',
  '/api/tours/featured',
  '/api/tours/stats',
  '/api/locations',
  '/api/guides',
  '/api/banners/active',
  '/api/config/public',
  '/api/auth/roles',
  '/api/auth/permissions',
  '/api/tours/pool',
  '/api/rag/status',
];

export default function () {
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${base}${path}`, {
    tags: { endpoint: path },
    timeout: '10s',
  });
  check(res, {
    [`${path} returns HTTP 200`]: (r) => r.status === 200,
  });
}
