import { http, HttpResponse } from 'msw';
import type { HoSoDonViPhanHoi } from '@/api/hoSoDonVi';
import {
  DON_VI_TIEP_NHAN,
  NGAN_HANG_TIEP_NHAN,
  chuanHoaHoSo,
  kiemTraHoSo,
  stkChuyenKhoan,
  tinhTrangHoSo,
  type HoSoDauVao,
  type HoSoDonViDuLieu,
} from '@/lib/hoSoDonVi';

// Issue #63: Hồ sơ đơn vị — CSDL giả, reset sau mỗi test (setup.ts). Mọi giá trị đều BỊA.
export const DON_VI_MAU = { id: 'tr-1', ten: 'Trường THCS Mẫu Một' };

export function hoSoMau(p: HoSoDauVao = {}): HoSoDonViDuLieu {
  return chuanHoaHoSo({
    ten_truong: 'Trường THCS Mẫu Một',
    dia_chi: 'Ấp Bịa, xã Thử, tỉnh Giả',
    ma_so_thue: '0000000001',
    nguoi_dai_dien: 'Người Đại Diện Bịa',
    sdt_dai_dien: '0900000001',
    email_hoa_don: 'hoadon@mau.test',
    so_tai_khoan: '0000111122223333',
    ngan_hang: 'Ngân hàng Giả',
    chi_nhanh: 'Chi nhánh Giả',
    kho_bac: 'Kho bạc Giả',
    mst_kho_bac: '0000000001',
    ma_qhns: '1234567',
    ma_nguon: '13',
    ht_ho_ten: 'Hiệu Trưởng Bịa',
    ht_so_tai_khoan: '9999888877776666',
    ht_ngan_hang: 'Ngân hàng Giả – CN Thử',
    kt_ho_ten: 'Kế Toán Bịa',
    kt_sdt: '0900000002',
    kt_so_tai_khoan: '5555444433332222',
    kt_ngan_hang: 'Ngân hàng Giả – CN Thử',
    ...p,
  });
}

/** Dựng phản hồi như backend từ 1 hồ sơ (null = chưa khai). */
export function phanHoiHoSo(
  hoSo: HoSoDonViDuLieu | null,
  donVi: { id: string; ten: string } = DON_VI_MAU,
): HoSoDonViPhanHoi {
  const { du, thieu } = tinhTrangHoSo(hoSo);
  const stk = stkChuyenKhoan(hoSo?.ma_qhns);
  return {
    don_vi: donVi,
    ho_so: hoSo ? { ...hoSo, updated_at: '2026-11-20T02:00:00.000Z' } : null,
    tinh_trang: { du, thieu, so_thieu: thieu.length },
    chuyen_khoan: stk ? { stk, don_vi_tiep_nhan: DON_VI_TIEP_NHAN, ngan_hang: NGAN_HANG_TIEP_NHAN } : null,
    goi_y: { ten_truong: donVi.ten },
  };
}

export const dbHoSoDonVi = {
  /** Hồ sơ của trường đang đăng nhập. */
  cuaTruong: null as HoSoDonViDuLieu | null,
  /** Quản trị: theo id đơn vị (vắng = 404, null = chưa khai). */
  theoId: {} as Record<string, { ten: string; hoSo: HoSoDonViDuLieu | null }>,
};

export function datLaiHoSoDonViMock() {
  dbHoSoDonVi.cuaTruong = null;
  dbHoSoDonVi.theoId = {};
}

export const hoSoDonViHandlers = [
  http.get('/cong-don-vi/ho-so-don-vi', () => HttpResponse.json(phanHoiHoSo(dbHoSoDonVi.cuaTruong))),
  http.put('/cong-don-vi/ho-so-don-vi', async ({ request }) => {
    const moi = chuanHoaHoSo((await request.json()) as HoSoDauVao);
    const fields = Object.entries(kiemTraHoSo(moi).loi).map(([field, message]) => ({ field, message }));
    if (fields.length) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Hồ sơ đơn vị chưa hợp lệ', fields } },
        { status: 400 },
      );
    }
    dbHoSoDonVi.cuaTruong = moi;
    return HttpResponse.json(phanHoiHoSo(moi));
  }),
  http.get('/cong-don-vi/ho-so-don-vi/:donViId', ({ params }) => {
    const id = params.donViId as string;
    const dv = dbHoSoDonVi.theoId[id];
    if (!dv) {
      return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đơn vị' } }, { status: 404 });
    }
    return HttpResponse.json(phanHoiHoSo(dv.hoSo, { id, ten: dv.ten }));
  }),
];
