import { http, HttpResponse } from 'msw';
import { LOC_TIEN_DO, type DongTienDo, type LocTienDo, type TienDoDot } from '@/api/tienDoDot';

// Issue #65: bảng Tiến độ đợt (Cổng đơn vị) — CSDL giả, reset sau mỗi test (setup.ts). Mọi giá trị đều BỊA.

export function dongTienDoMau(p: Partial<DongTienDo> = {}): DongTienDo {
  return {
    don_vi: { id: 'tr-1', ma: 'TR-MAU-001', ten: 'Trường THCS Mẫu Một', dia_ban: 'Xã Mẫu' },
    so_nguoi: 3,
    tong_suat: 2.5,
    gia_tri: 3_750_000,
    trang_thai_danh_sach: 'cho_xac_nhan',
    trang_thai_hop_dong: 'chua_nop',
    nop_luc: null,
    han_rieng: null,
    han_hieu_luc: '2026-12-31T16:59:59.000Z',
    han_hieu_luc_ngay: '2026-12-31',
    qua_han: false,
    so_de_nghi_cho: 0,
    ho_so_du: false,
    co_ho_so: true,
    thao_tac_cuoi_luc: null,
    thao_tac_cuoi_boi: null,
    ...p,
  };
}

/** 4 trường: Một chờ xác nhận, Hai báo sai lệch (2 đề nghị chờ), Ba đã xác nhận + hồ sơ đủ, Bốn đã nộp. */
export function dsTienDoMau(): DongTienDo[] {
  return [
    dongTienDoMau(),
    dongTienDoMau({
      don_vi: { id: 'tr-2', ma: 'TR-MAU-002', ten: 'Trường THCS Mẫu Hai', dia_ban: 'Xã Mẫu' },
      so_nguoi: 1,
      tong_suat: 0.5,
      gia_tri: 750_000,
      trang_thai_danh_sach: 'bao_sai_lech',
      so_de_nghi_cho: 2,
      co_ho_so: false,
    }),
    dongTienDoMau({
      don_vi: { id: 'tr-3', ma: 'TR-MAU-003', ten: 'Trường Tiểu học Mẫu Ba', dia_ban: 'Phường Thử' },
      so_nguoi: 2,
      tong_suat: 2,
      gia_tri: 3_000_000,
      trang_thai_danh_sach: 'da_xac_nhan',
      ho_so_du: true,
      thao_tac_cuoi_luc: '2026-11-18T02:30:00.000Z',
      thao_tac_cuoi_boi: { ho_ten: 'Quản Trị Bịa', ten_dang_nhap: 'quantri-bia@mau.test' },
    }),
    dongTienDoMau({
      don_vi: { id: 'tr-4', ma: 'TR-MAU-004', ten: 'Trường THPT Mẫu Bốn', dia_ban: 'Phường Thử' },
      so_nguoi: 7,
      tong_suat: 7.5,
      gia_tri: 11_250_000,
      trang_thai_danh_sach: 'da_xac_nhan',
      trang_thai_hop_dong: 'da_nop',
      nop_luc: '2026-11-19T03:04:00.000Z',
      ho_so_du: true,
      thao_tac_cuoi_luc: '2026-11-19T03:04:00.000Z',
    }),
  ];
}

export const dbTienDoDot = {
  /** Theo id đợt; đợt không có → 404. */
  theoDot: {} as Record<string, DongTienDo[]>,
  donGia: 1_500_000 as number | null,
  /** Issue #66: thân các lần PUT han-rieng đã nhận (để test kiểm). */
  hanRiengDaGui: [] as { dotId: string; donViId: string; body: unknown }[],
};

export function datLaiTienDoDotMock() {
  dbTienDoDot.theoDot = {};
  dbTienDoDot.donGia = 1_500_000;
  dbTienDoDot.hanRiengDaGui = [];
}

/** "Hôm nay" của mock gia hạn riêng (cố định, không đọc đồng hồ). */
export const HOM_NAY_MOCK = '2026-11-23';

function khopLoc(d: DongTienDo, loc: LocTienDo): boolean {
  if (loc === 'chua_xac_nhan_ds') return d.trang_thai_danh_sach !== 'da_xac_nhan';
  if (loc === 'bao_sai_lech') return d.trang_thai_danh_sach === 'bao_sai_lech';
  if (loc === 'chua_nop_hd') return d.trang_thai_hop_dong !== 'da_nop';
  if (loc === 'qua_han') return d.qua_han;
  return true;
}

function tienDoCua(dotId: string, loc: LocTienDo): TienDoDot {
  const ds = dbTienDoDot.theoDot[dotId];
  const coGiaTri = ds.filter((d) => d.gia_tri !== null);
  return {
    dot: {
      id: dotId,
      ten: 'HSG An Giang 2026',
      chuong_trinh: 'hsg',
      don_gia: dbTienDoDot.donGia,
      han_nop: '2026-12-31T16:59:59.000Z',
      han_nop_ngay: '2026-12-31',
    },
    tong_hop: {
      so_truong: ds.length,
      so_da_xac_nhan_ds: ds.filter((d) => d.trang_thai_danh_sach === 'da_xac_nhan').length,
      so_bao_sai_lech: ds.filter((d) => d.trang_thai_danh_sach === 'bao_sai_lech').length,
      so_da_nop: ds.filter((d) => d.trang_thai_hop_dong === 'da_nop').length,
      so_qua_han: ds.filter((d) => d.qua_han).length,
      tong_nguoi: ds.reduce((t, d) => t + d.so_nguoi, 0),
      tong_suat: ds.reduce((t, d) => t + d.tong_suat * 2, 0) / 2,
      tong_gia_tri: coGiaTri.length ? coGiaTri.reduce((t, d) => t + (d.gia_tri as number), 0) : null,
    },
    dong: ds.filter((d) => khopLoc(d, loc)),
  };
}

const loi = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

function docLoc(request: Request): LocTienDo | null {
  const loc = new URL(request.url).searchParams.get('loc') ?? 'tat_ca';
  return (LOC_TIEN_DO as readonly string[]).includes(loc) ? (loc as LocTienDo) : null;
}

export const tienDoDotHandlers = [
  http.get('/cong-don-vi/dot-trien-khai/:id/tien-do', ({ params, request }) => {
    const loc = docLoc(request);
    if (!loc) return loi(400, 'VALIDATION_ERROR', 'loc không hợp lệ');
    if (!dbTienDoDot.theoDot[params.id as string]) return loi(404, 'NOT_FOUND', 'Không tìm thấy đợt triển khai');
    return HttpResponse.json(tienDoCua(params.id as string, loc));
  }),

  http.get('/cong-don-vi/dot-trien-khai/:id/tien-do/xuat-excel', ({ params, request }) => {
    if (!docLoc(request)) return loi(400, 'VALIDATION_ERROR', 'loc không hợp lệ');
    if (!dbTienDoDot.theoDot[params.id as string]) return loi(404, 'NOT_FOUND', 'Không tìm thấy đợt triển khai');
    return new HttpResponse(new Blob(['xlsx-gia']), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    });
  }),

  // Issue #66 / T3: gia hạn riêng 1 trường — kiểm như backend (lý do bắt buộc, ngày hợp lệ ≥ HOM_NAY_MOCK).
  http.put('/cong-don-vi/dot-trien-khai/:dotId/hop-dong/:donViId/han-rieng', async ({ params, request }) => {
    const dotId = params.dotId as string;
    const donViId = params.donViId as string;
    const body = (await request.json()) as { han_rieng?: string | null; ly_do?: string };
    dbTienDoDot.hanRiengDaGui.push({ dotId, donViId, body });
    const fields: { field: string; message: string }[] = [];
    if (!body.ly_do?.trim()) fields.push({ field: 'ly_do', message: 'Nhập lý do (tối đa 500 ký tự)' });
    if (body.han_rieng !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.han_rieng ?? '')) {
      fields.push({ field: 'han_rieng', message: 'han_rieng phải là ngày dạng YYYY-MM-DD hoặc null' });
    } else if (body.han_rieng && body.han_rieng < HOM_NAY_MOCK) {
      fields.push({ field: 'han_rieng', message: 'Hạn riêng phải từ hôm nay trở đi' });
    }
    if (fields.length) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: fields[0].message, fields } },
        { status: 400 },
      );
    }
    const dong = (dbTienDoDot.theoDot[dotId] ?? []).find((d) => d.don_vi.id === donViId);
    if (!dong) return loi(404, 'NOT_FOUND', 'Không tìm thấy danh sách của trường cho đợt này');
    const ngay = body.han_rieng ?? '2026-12-31';
    Object.assign(dong, {
      han_rieng: body.han_rieng ? `${body.han_rieng}T16:59:59.000Z` : null,
      han_hieu_luc: `${ngay}T16:59:59.000Z`,
      han_hieu_luc_ngay: ngay,
      qua_han: false,
    });
    return HttpResponse.json({
      han_rieng: dong.han_rieng,
      han_hieu_luc: dong.han_hieu_luc,
      han_hieu_luc_ngay: dong.han_hieu_luc_ngay,
      da_het_han: false,
    });
  }),
];
