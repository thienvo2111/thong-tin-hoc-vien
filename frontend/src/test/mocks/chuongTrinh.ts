import { http, HttpResponse } from 'msw';

// Issue #70: mặc định đơn vị chưa tham gia NLS (menu NLS ẩn, /nls/* → 404); test cần NLS thì server.use(...).
export const chuongTrinhHandlers = [http.get('/cong-don-vi/toi/chuong-trinh', () => HttpResponse.json({ nls: false }))];
