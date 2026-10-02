import { http, HttpResponse } from 'msw';
import type { CauHinhKhaoSat, KetQuaCauHinhKhaoSat, TinhCoCauHinh } from '@/api/cauHinhKhaoSat';

// Mock /cau-hinh-khao-sat — tách khỏi handlers.ts. Mặc định chưa lưu (cau_hinh null) để các trang dùng
// giá trị mặc định trong content/trienKhai.ts; test gọi datCauHinhKhaoSatMock() để giả lập admin đã lưu.
// 2026-10-02: thêm cấu hình riêng theo khóa (datCauHinhKhoaMock) — gắn tỉnh thì hiện ở ô chọn tỉnh trang chủ;
// datCauHinhCuaToiMock giả lập khóa học viên đang ghi danh (mặc định: dùng cấu hình chung).
let hienTai: KetQuaCauHinhKhaoSat = { cau_hinh: null, cap_nhat_luc: null, pham_vi: { loai: 'chung' } };

interface CauHinhKhoaMock {
  khoa_id: string;
  ma_khoa: string;
  ten_khoa: string;
  tinh: TinhCoCauHinh | null;
  cau_hinh: CauHinhKhaoSat;
}
let theoKhoa: CauHinhKhoaMock[] = [];
let khoaCuaToi: string | null = null;

const LUC = '2026-10-02T03:00:00.000Z';

function tuKhoa(k: CauHinhKhoaMock): KetQuaCauHinhKhaoSat {
  return {
    cau_hinh: k.cau_hinh,
    cap_nhat_luc: LUC,
    pham_vi: {
      loai: 'khoa',
      khoa_id: k.khoa_id,
      ma_khoa: k.ma_khoa,
      ten_khoa: k.ten_khoa,
      tinh_id: k.tinh?.tinh_id ?? null,
      ten_tinh: k.tinh?.ten_tinh ?? null,
    },
  };
}

export function datCauHinhKhaoSatMock(cauHinh: CauHinhKhaoSat | null) {
  hienTai = { cau_hinh: cauHinh, cap_nhat_luc: cauHinh ? LUC : null, pham_vi: { loai: 'chung' } };
}

export function datCauHinhKhoaMock(k: CauHinhKhoaMock) {
  theoKhoa = [...theoKhoa.filter((x) => x.khoa_id !== k.khoa_id), k];
}

export function datCauHinhCuaToiMock(khoaId: string | null) {
  khoaCuaToi = khoaId;
}

export function datLaiCauHinhKhaoSatMock() {
  datCauHinhKhaoSatMock(null);
  theoKhoa = [];
  khoaCuaToi = null;
}

export function layCauHinhKhaoSatMock() {
  return hienTai;
}

export function layCauHinhKhoaMock(khoaId: string) {
  return theoKhoa.find((k) => k.khoa_id === khoaId) ?? null;
}

export const cauHinhKhaoSatHandlers = [
  http.get('/cau-hinh-khao-sat/tinh', () =>
    HttpResponse.json(theoKhoa.filter((k) => k.tinh).map((k) => k.tinh as TinhCoCauHinh)),
  ),
  http.get('/cau-hinh-khao-sat/cua-toi', () => {
    const k = theoKhoa.find((x) => x.khoa_id === khoaCuaToi);
    return HttpResponse.json(k ? tuKhoa(k) : hienTai);
  }),
  http.get('/cau-hinh-khao-sat/khoa/:khoaId', ({ params }) => {
    const k = theoKhoa.find((x) => x.khoa_id === params.khoaId);
    if (k) return HttpResponse.json(tuKhoa(k));
    return HttpResponse.json({
      cau_hinh: null,
      cap_nhat_luc: null,
      pham_vi: { loai: 'khoa', khoa_id: params.khoaId, ma_khoa: 'K-MOCK', ten_khoa: 'Khóa mock', tinh_id: null, ten_tinh: null },
    });
  }),
  http.put('/cau-hinh-khao-sat/khoa/:khoaId', async ({ params, request }) => {
    const { tinh_id, ...cauHinh } = (await request.json()) as CauHinhKhaoSat & { tinh_id: string | null };
    const cu = theoKhoa.find((x) => x.khoa_id === params.khoaId);
    const k: CauHinhKhoaMock = {
      khoa_id: String(params.khoaId),
      ma_khoa: cu?.ma_khoa ?? 'K-MOCK',
      ten_khoa: cu?.ten_khoa ?? 'Khóa mock',
      tinh: tinh_id ? { tinh_id, ten_tinh: `Tỉnh ${tinh_id}` } : null,
      cau_hinh: cauHinh,
    };
    datCauHinhKhoaMock(k);
    return HttpResponse.json(tuKhoa(k));
  }),
  http.delete('/cau-hinh-khao-sat/khoa/:khoaId', ({ params }) => {
    theoKhoa = theoKhoa.filter((x) => x.khoa_id !== params.khoaId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/cau-hinh-khao-sat', ({ request }) => {
    const tinh = new URL(request.url).searchParams.get('tinh');
    const k = tinh ? theoKhoa.find((x) => x.tinh?.tinh_id === tinh) : undefined;
    return HttpResponse.json(k ? tuKhoa(k) : hienTai);
  }),
  http.put('/cau-hinh-khao-sat', async ({ request }) => {
    const body = (await request.json()) as CauHinhKhaoSat;
    hienTai = { cau_hinh: body, cap_nhat_luc: new Date().toISOString(), pham_vi: { loai: 'chung' } };
    return HttpResponse.json(hienTai);
  }),
];
