import { http, HttpResponse } from 'msw';
import type { CauHinhKhaoSat, KetQuaCauHinhKhaoSat } from '@/api/cauHinhKhaoSat';

// Mock /cau-hinh-khao-sat — tách khỏi handlers.ts. Mặc định chưa lưu (cau_hinh null) để các trang dùng
// giá trị mặc định trong content/trienKhai.ts; test gọi datCauHinhKhaoSatMock() để giả lập admin đã lưu.
let hienTai: KetQuaCauHinhKhaoSat = { cau_hinh: null, cap_nhat_luc: null };

export function datCauHinhKhaoSatMock(cauHinh: CauHinhKhaoSat | null) {
  hienTai = { cau_hinh: cauHinh, cap_nhat_luc: cauHinh ? '2026-10-02T03:00:00.000Z' : null };
}

export function layCauHinhKhaoSatMock() {
  return hienTai;
}

export const cauHinhKhaoSatHandlers = [
  http.get('/cau-hinh-khao-sat', () => HttpResponse.json(hienTai)),
  http.put('/cau-hinh-khao-sat', async ({ request }) => {
    const body = (await request.json()) as CauHinhKhaoSat;
    hienTai = { cau_hinh: body, cap_nhat_luc: new Date().toISOString() };
    return HttpResponse.json(hienTai);
  }),
];
