import { http, HttpResponse } from 'msw';
import type { DanhSachGvSoPhong, DongTienDoSoPhong, TheDotSoPhong, TienDoSoPhong } from '@/api/donViTienDo';
import { LOC_TIEN_DO, type LocTienDo, type TongHopTienDo } from '@/api/tienDoDot';

// Issue #71: tiến độ Sở/Phòng (Cổng đơn vị) — CSDL giả, reset sau mỗi test (setup.ts). Mọi giá trị đều BỊA.
// Đúng hình dạng API thật: KHÔNG có tài khoản, người nhận, QĐ, liên hệ, người thao tác.

export function dotSoPhongMau(p: Partial<TheDotSoPhong['dot']> = {}): TheDotSoPhong['dot'] {
  return {
    id: 'dot-sp-1',
    ten: 'HSG Đợt Bịa Sở',
    chuong_trinh: 'hsg',
    don_gia: 1_000_000,
    han_nop: '2026-12-31T16:59:59.000Z',
    han_nop_ngay: '2026-12-31',
    ...p,
  };
}

export function dongSoPhongMau(p: Partial<DongTienDoSoPhong> = {}): DongTienDoSoPhong {
  return {
    don_vi: { id: 'tr-sp-1', ma: 'TR-SP-001', ten: 'Trường THCS Bịa Một', dia_ban: 'Xã Bịa' },
    so_nguoi: 3,
    tong_suat: 2.5,
    gia_tri: 2_500_000,
    trang_thai_danh_sach: 'cho_xac_nhan',
    trang_thai_hop_dong: 'chua_nop',
    nop_luc: null,
    han_hieu_luc_ngay: '2026-12-31',
    qua_han: false,
    so_de_nghi_cho: 0,
    thao_tac_cuoi_luc: null,
    ...p,
  };
}

/** 3 trường: Một chờ xác nhận, Hai báo sai lệch (1 đề nghị chờ, quá hạn), Ba đã nộp. */
export function dsSoPhongMau(): DongTienDoSoPhong[] {
  return [
    dongSoPhongMau(),
    dongSoPhongMau({
      don_vi: { id: 'tr-sp-2', ma: 'TR-SP-002', ten: 'Trường Tiểu học Bịa Hai', dia_ban: 'Phường Thử' },
      so_nguoi: 1,
      tong_suat: 0.5,
      gia_tri: 500_000,
      trang_thai_danh_sach: 'bao_sai_lech',
      so_de_nghi_cho: 1,
      han_hieu_luc_ngay: '2026-11-01',
      qua_han: true,
    }),
    dongSoPhongMau({
      don_vi: { id: 'tr-sp-3', ma: 'TR-SP-003', ten: 'Trường THPT Bịa Ba', dia_ban: 'Phường Thử' },
      so_nguoi: 7,
      tong_suat: 6.5,
      gia_tri: 6_500_000,
      trang_thai_danh_sach: 'da_xac_nhan',
      trang_thai_hop_dong: 'da_nop',
      nop_luc: '2026-11-19T03:04:00.000Z',
      thao_tac_cuoi_luc: '2026-11-19T03:04:00.000Z',
    }),
  ];
}

export function danhSachGvMau(p: Partial<DanhSachGvSoPhong> = {}): DanhSachGvSoPhong {
  return {
    dot: dotSoPhongMau(),
    truong: { id: 'tr-sp-1', ma: 'TR-SP-001', ten: 'Trường THCS Bịa Một' },
    trang_thai_danh_sach: 'cho_xac_nhan',
    trang_thai_hop_dong: 'chua_nop',
    so_nguoi: 2,
    tong_suat: 1.5,
    gia_tri: 1_500_000,
    dong: [
      {
        id: 'gv-1',
        ho_ten: 'Nguyễn Thị Bịa',
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nữ',
        lop: '6A',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: 'Ghi chú bịa',
        y_kien_truong: 'dong_y',
      },
      {
        id: 'gv-2',
        ho_ten: 'Trần Văn Giả',
        ngay_sinh: null,
        gioi_tinh: null,
        lop: null,
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        ghi_chu: null,
        y_kien_truong: null,
      },
    ],
    ...p,
  };
}

export const dbDonViTienDo = {
  /** Đợt có trường trong phạm vi → dòng của đợt. Đợt không có → 404 (ngoài phạm vi). */
  theoDot: {} as Record<string, { dot: TheDotSoPhong['dot']; dong: DongTienDoSoPhong[] }>,
  /** Khóa `${dotId}/${donViId}` → danh sách GV; không có → 404. */
  danhSach: {} as Record<string, DanhSachGvSoPhong>,
};

export function datLaiDonViTienDoMock() {
  dbDonViTienDo.theoDot = {};
  dbDonViTienDo.danhSach = {};
}

function khopLoc(d: DongTienDoSoPhong, loc: LocTienDo): boolean {
  if (loc === 'chua_xac_nhan_ds') return d.trang_thai_danh_sach !== 'da_xac_nhan';
  if (loc === 'bao_sai_lech') return d.trang_thai_danh_sach === 'bao_sai_lech';
  if (loc === 'chua_nop_hd') return d.trang_thai_hop_dong !== 'da_nop';
  if (loc === 'qua_han') return d.qua_han;
  return true;
}

function tongHop(ds: DongTienDoSoPhong[]): TongHopTienDo {
  const coGiaTri = ds.filter((d) => d.gia_tri !== null);
  return {
    so_truong: ds.length,
    so_da_xac_nhan_ds: ds.filter((d) => d.trang_thai_danh_sach === 'da_xac_nhan').length,
    so_bao_sai_lech: ds.filter((d) => d.trang_thai_danh_sach === 'bao_sai_lech').length,
    so_da_nop: ds.filter((d) => d.trang_thai_hop_dong === 'da_nop').length,
    so_qua_han: ds.filter((d) => d.qua_han).length,
    tong_nguoi: ds.reduce((t, d) => t + d.so_nguoi, 0),
    tong_suat: ds.reduce((t, d) => t + d.tong_suat * 2, 0) / 2,
    tong_gia_tri: coGiaTri.length ? coGiaTri.reduce((t, d) => t + (d.gia_tri as number), 0) : null,
  };
}

const loi = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

export const donViTienDoHandlers = [
  http.get('/cong-don-vi/don-vi/dot', () => {
    const the: TheDotSoPhong[] = Object.values(dbDonViTienDo.theoDot)
      .map(({ dot, dong }) => ({ dot, ...tongHop(dong) }))
      .sort((a, b) => b.dot.han_nop.localeCompare(a.dot.han_nop));
    return HttpResponse.json(the);
  }),

  http.get('/cong-don-vi/don-vi/dot/:dotId/tien-do', ({ params, request }) => {
    const loc = new URL(request.url).searchParams.get('loc') ?? 'tat_ca';
    if (!(LOC_TIEN_DO as readonly string[]).includes(loc)) return loi(400, 'VALIDATION_ERROR', 'loc không hợp lệ');
    const muc = dbDonViTienDo.theoDot[params.dotId as string];
    if (!muc) return loi(404, 'NOT_FOUND', 'Không tìm thấy đợt triển khai');
    const body: TienDoSoPhong = {
      dot: muc.dot,
      tong_hop: tongHop(muc.dong),
      dong: muc.dong.filter((d) => khopLoc(d, loc as LocTienDo)),
    };
    return HttpResponse.json(body);
  }),

  http.get('/cong-don-vi/don-vi/dot/:dotId/truong/:donViId/danh-sach', ({ params }) => {
    const ds = dbDonViTienDo.danhSach[`${params.dotId as string}/${params.donViId as string}`];
    if (!ds) return loi(404, 'NOT_FOUND', 'Không tìm thấy danh sách của trường cho đợt này');
    return HttpResponse.json(ds);
  }),
];
