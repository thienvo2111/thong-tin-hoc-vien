import { http, HttpResponse } from 'msw';
import type { HopDongPhanHoi, HopDongQuanTri, LyDoChanNop, MaLyDoChanNop } from '@/api/hopDong';
import { kiemTraPhan3, type NhapHopDong } from '@/lib/hopDong';
import { MAU_SDT } from '@/lib/hoSoDonVi';
import { hoSoMau } from './hoSoDonVi';

// Issue #64: hợp đồng (Cổng đơn vị) — CSDL giả, reset sau mỗi test (setup.ts). Mọi giá trị đều BỊA.

export const LY_DO: Record<MaLyDoChanNop, string> = {
  da_nop: 'Hợp đồng đã nộp',
  da_het_han: 'Đã hết hạn ngày 05/12/2026 — liên hệ HCMUE để được gia hạn',
  danh_sach_chua_xac_nhan: 'Danh sách chưa được xác nhận',
  chua_co_don_gia: 'Đợt chưa có đơn giá — chờ HCMUE cập nhật',
  ho_so_chua_du: 'Hồ sơ đơn vị còn thiếu 3 mục',
  thieu_hau_can: 'Trường là điểm học trực tiếp: cần khai đủ mục Hậu cần cơ sở trong Hồ sơ đơn vị',
  phan_3_chua_du: 'Phần 3 (người nhận bản giấy hợp đồng) còn thiếu hoặc sai',
  thieu_so_qd: 'Hợp đồng từ 50.000.000 đ cần số QĐ chỉ định thầu',
  thieu_ngay_qd: 'Hợp đồng từ 50.000.000 đ cần ngày QĐ chỉ định thầu',
  dot_chua_cau_hinh_ngay_qd: 'Đợt chưa cấu hình khoảng ngày QĐ — chờ HCMUE',
  ngay_qd_ngoai_khoang: 'Ngày QĐ phải từ 01/11/2026 đến 30/11/2026',
};

export const lyDo = (...ma: MaLyDoChanNop[]): LyDoChanNop[] => ma.map((m) => ({ ma: m, thong_diep: LY_DO[m] }));

/** Mặc định: chưa nộp, dưới ngưỡng Phần 4, còn 2 lý do chặn. */
export function hopDongMau(p: Partial<HopDongPhanHoi> = {}): HopDongPhanHoi {
  const ly_do_chan = p.ly_do_chan ?? lyDo('danh_sach_chua_xac_nhan', 'phan_3_chua_du');
  return {
    dot: {
      id: 'dot-hsg-1',
      ten: 'HSG Đợt Bịa 2026',
      chuong_trinh: 'hsg',
      don_gia: 1_234_567,
      ngay_qd_tu: '2026-11-01',
      ngay_qd_den: '2026-11-30',
      han_nop: '2026-12-31T16:59:59.000Z',
      han_nop_ngay: '2026-12-31',
    },
    trang_thai_danh_sach: 'cho_xac_nhan',
    trang_thai_hop_dong: 'chua_nop',
    phan_3: { nguoi_nhan: null, sdt_nguoi_nhan: null, dia_chi_nhan: null, ghi_chu: null },
    phan_4: { so_qd: null, ngay_qd: null },
    diem_hoc_truc_tiep: false,
    so_nguoi: 3,
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri: 3_086_418,
    can_phan_4: false,
    ho_so_tinh_trang: { du: true, so_thieu: 0 },
    chuyen_khoan: {
      stk: 'HCMUE1234567',
      don_vi_tiep_nhan: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
      ngan_hang: 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)',
    },
    co_the_nop: ly_do_chan.length === 0,
    ly_do_chan,
    nop_luc: null,
    ban_chup_ho_so: null,
    han_rieng: null,
    han_hieu_luc: '2026-12-31T16:59:59.000Z',
    han_hieu_luc_ngay: '2026-12-31',
    da_het_han: false,
    ...p,
  };
}

export const PHAN_3_MAU = {
  nguoi_nhan: 'Người Nhận Bịa',
  sdt_nguoi_nhan: '0900000009',
  dia_chi_nhan: 'Số 1, đường Bịa, xã Thử, tỉnh Giả',
  ghi_chu: null,
};

export function banChupMau() {
  return {
    ...hoSoMau(),
    stk_chuyen_khoan: 'HCMUE1234567',
    don_vi_tiep_nhan: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
    ngan_hang_tiep_nhan: 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)',
    chup_luc: '2026-11-20T03:04:00.000Z',
  };
}

/** Hợp đồng đã nộp lúc 10:04 ngày 20/11/2026 (giờ VN). */
export function hopDongDaNopMau(p: Partial<HopDongPhanHoi> = {}): HopDongPhanHoi {
  return hopDongMau({
    trang_thai_danh_sach: 'da_xac_nhan',
    trang_thai_hop_dong: 'da_nop',
    phan_3: PHAN_3_MAU,
    ly_do_chan: lyDo('da_nop'),
    nop_luc: '2026-11-20T03:04:00.000Z',
    ban_chup_ho_so: banChupMau(),
    ...p,
  });
}

export function hopDongQuanTriMau(p: Partial<HopDongQuanTri> = {}): HopDongQuanTri {
  return {
    ...hopDongDaNopMau(),
    don_vi: { id: 'tr-1', ten: 'Trường THCS Mẫu Một' },
    nop_boi: { ho_ten: 'Tài Khoản Trường Bịa', ten_dang_nhap: 'truong-bia@mau.test' },
    ho_so_hien_tai: null,
    ...p,
  };
}

export const dbHopDong = {
  truong: {} as Record<string, HopDongPhanHoi>,
  /** Khóa `${dotId}/${donViId}`. */
  quanTri: {} as Record<string, HopDongQuanTri>,
};

export function datLaiHopDongMock() {
  dbHopDong.truong = {};
  dbHopDong.quanTri = {};
}

const loi = (status: number, code: string, message: string, fields?: { field: string; message: string }[]) =>
  HttpResponse.json({ error: { code, message, fields } }, { status });
const khongThay = () => loi(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng của trường cho đợt này');
const trong = (v: string | null) => !v || !v.trim();

/** Issue #66 / T2: hết hạn → 403 HET_HAN_DOT (X5 đã nộp xét trước). */
const hetHan = (hd: HopDongPhanHoi) =>
  loi(
    403,
    'HET_HAN_DOT',
    `Đã hết hạn ngày ${hd.han_hieu_luc_ngay.split('-').reverse().join('/')} — liên hệ HCMUE để được gia hạn`,
  );

const MA_PHAN_3_4: MaLyDoChanNop[] = ['phan_3_chua_du', 'thieu_so_qd', 'thieu_ngay_qd'];

/** Bản rút gọn lyDoChanNop của backend: tính lại phần phụ thuộc Phần 3–4 sau khi lưu nháp. */
function tinhLaiLyDo(hd: HopDongPhanHoi, nhap: NhapHopDong): LyDoChanNop[] {
  const giu = hd.ly_do_chan.filter((l) => !MA_PHAN_3_4.includes(l.ma));
  const them: MaLyDoChanNop[] = [];
  if (trong(nhap.nguoi_nhan) || trong(nhap.dia_chi_nhan) || !MAU_SDT.test(nhap.sdt_nguoi_nhan ?? '')) {
    them.push('phan_3_chua_du');
  }
  if (hd.can_phan_4 && trong(nhap.so_qd)) them.push('thieu_so_qd');
  if (hd.can_phan_4 && trong(nhap.ngay_qd)) them.push('thieu_ngay_qd');
  return [...giu, ...lyDo(...them)];
}

export const hopDongHandlers = [
  http.get('/cong-don-vi/truong/dot/:dotId/hop-dong', ({ params }) => {
    const hd = dbHopDong.truong[params.dotId as string];
    return hd ? HttpResponse.json(hd) : khongThay();
  }),
  http.put('/cong-don-vi/truong/dot/:dotId/hop-dong', async ({ params, request }) => {
    const dotId = params.dotId as string;
    const hd = dbHopDong.truong[dotId];
    if (!hd) return khongThay();
    if (hd.trang_thai_hop_dong === 'da_nop') {
      return loi(409, 'CONFLICT', 'Hợp đồng đã nộp — liên hệ HCMUE nếu cần mở lại');
    }
    if (hd.da_het_han) return hetHan(hd);
    const nhap = (await request.json()) as NhapHopDong;
    const fields = Object.entries(kiemTraPhan3(nhap).loi).map(([field, message]) => ({ field, message }));
    if (fields.length) return loi(400, 'VALIDATION_ERROR', 'Thông tin hợp đồng chưa hợp lệ', fields);
    const ly_do_chan = tinhLaiLyDo(hd, nhap);
    dbHopDong.truong[dotId] = {
      ...hd,
      phan_3: {
        nguoi_nhan: nhap.nguoi_nhan,
        sdt_nguoi_nhan: nhap.sdt_nguoi_nhan,
        dia_chi_nhan: nhap.dia_chi_nhan,
        ghi_chu: nhap.ghi_chu,
      },
      phan_4: { so_qd: nhap.so_qd, ngay_qd: nhap.ngay_qd },
      diem_hoc_truc_tiep: nhap.diem_hoc_truc_tiep,
      ly_do_chan,
      co_the_nop: ly_do_chan.length === 0,
    };
    return HttpResponse.json(dbHopDong.truong[dotId]);
  }),
  http.post('/cong-don-vi/truong/dot/:dotId/hop-dong/nop', ({ params }) => {
    const dotId = params.dotId as string;
    const hd = dbHopDong.truong[dotId];
    if (!hd) return khongThay();
    if (hd.trang_thai_hop_dong === 'da_nop') {
      return loi(409, 'CONFLICT', 'Hợp đồng đã nộp — liên hệ HCMUE nếu cần mở lại');
    }
    if (hd.da_het_han) return hetHan(hd);
    if (hd.ly_do_chan.length) {
      return loi(
        400,
        'VALIDATION_ERROR',
        'Chưa nộp được hợp đồng',
        hd.ly_do_chan.map((l) => ({ field: l.ma, message: l.thong_diep })),
      );
    }
    const daNop = hopDongDaNopMau();
    dbHopDong.truong[dotId] = {
      ...hd,
      trang_thai_hop_dong: 'da_nop',
      ly_do_chan: daNop.ly_do_chan,
      co_the_nop: false,
      nop_luc: daNop.nop_luc,
      ban_chup_ho_so: daNop.ban_chup_ho_so,
    };
    return HttpResponse.json(dbHopDong.truong[dotId]);
  }),
  http.get('/cong-don-vi/dot-trien-khai/:dotId/hop-dong/:donViId', ({ params }) => {
    const hd = dbHopDong.quanTri[`${params.dotId}/${params.donViId}`];
    return hd ? HttpResponse.json(hd) : khongThay();
  }),
  http.post('/cong-don-vi/dot-trien-khai/:dotId/hop-dong/:donViId/mo-lai', async ({ params, request }) => {
    const khoa = `${params.dotId}/${params.donViId}`;
    const hd = dbHopDong.quanTri[khoa];
    if (!hd) return khongThay();
    const { ly_do } = (await request.json()) as { ly_do?: string };
    if (!ly_do?.trim()) {
      const message = 'Nhập lý do (tối đa 500 ký tự)';
      return loi(400, 'VALIDATION_ERROR', message, [{ field: 'ly_do', message }]);
    }
    if (hd.trang_thai_hop_dong !== 'da_nop') return loi(409, 'CONFLICT', 'Hợp đồng chưa nộp');
    dbHopDong.quanTri[khoa] = {
      ...hd,
      trang_thai_hop_dong: 'chua_nop',
      nop_luc: null,
      nop_boi: null,
      ban_chup_ho_so: null,
      ho_so_hien_tai: hoSoMau(),
      ly_do_chan: [],
      co_the_nop: true,
    };
    return HttpResponse.json(dbHopDong.quanTri[khoa]);
  }),
];
