import { http, HttpResponse } from 'msw';
import type { DotTrienKhai, KhoaCoTheGan, SuaDotTrienKhaiDto, TaoDotTrienKhaiDto } from '@/api/dotTrienKhai';
import { DON_VI } from './db';

// Issue #56: đợt triển khai (Cổng đơn vị) — CSDL giả trong bộ nhớ, reset sau mỗi test (setup.ts).
// Sở dùng dv-so-1 trong DON_VI của db.ts.
export function dotMau(p: Partial<DotTrienKhai> = {}): DotTrienKhai {
  return {
    id: 'dtk-1',
    chuong_trinh: 'hsg',
    ten: 'HSG An Giang 2026',
    don_gia: 1500000,
    ngay_qd_tu: '2026-03-01',
    ngay_qd_den: '2026-12-31',
    han_nop: '2026-12-31T16:59:59.000Z',
    han_nop_ngay: '2026-12-31',
    so_gddt: { id: 'dv-so-1', ten_don_vi: 'Sở GD&ĐT An Giang' },
    khoa: [],
    created_at: '2026-11-19T01:00:00.000Z',
    updated_at: '2026-11-19T01:00:00.000Z',
    ...p,
  };
}

// Issue #68: khóa NLS trong phạm vi Sở (mã/tên bịa). KNLS-03 đang gắn đợt khác.
export function khoaCoTheGanMau(): KhoaCoTheGan[] {
  const khoa = (id: string, ma: string, ten: string, dot: [string, string] | null = null): KhoaCoTheGan => ({
    id,
    ma_khoa: ma,
    ten_khoa: ten,
    thoi_gian_bat_dau: '2026-03-01',
    thoi_gian_ket_thuc: '2026-06-30',
    trang_thai: 'da_duyet',
    dot_trien_khai_id: dot?.[0] ?? null,
    dot_trien_khai_ten: dot?.[1] ?? null,
  });
  return [
    khoa('k-1', 'KNLS-01', 'Khóa NLS Bịa Một'),
    khoa('k-2', 'KNLS-02', 'Khóa NLS Bịa Hai'),
    khoa('k-3', 'KNLS-03', 'Khóa NLS Bịa Ba', ['dtk-khac', 'NLS đợt khác']),
  ];
}

export const dbDotTrienKhai = { ds: [] as DotTrienKhai[], khoaCoTheGan: khoaCoTheGanMau() };

export function datLaiDotTrienKhaiMock() {
  dbDotTrienKhai.ds = [];
  dbDotTrienKhai.khoaCoTheGan = khoaCoTheGanMau();
}

const hanNop = (ngay: string) => new Date(`${ngay}T23:59:59+07:00`).toISOString();

function soGddt(id: string) {
  const dv = DON_VI.find((d) => d.id === id);
  return { id, ten_don_vi: dv?.ten_don_vi ?? id };
}

export const dotTrienKhaiHandlers = [
  http.get('/cong-don-vi/dot-trien-khai', () => HttpResponse.json(dbDotTrienKhai.ds)),

  http.post('/cong-don-vi/dot-trien-khai', async ({ request }) => {
    const b = (await request.json()) as TaoDotTrienKhaiDto;
    const { so_gddt_id, ...con } = b;
    const dot = dotMau({
      ...con,
      id: `dtk-${dbDotTrienKhai.ds.length + 1}`,
      han_nop: hanNop(b.han_nop_ngay),
      so_gddt: soGddt(so_gddt_id),
    });
    dbDotTrienKhai.ds = [dot, ...dbDotTrienKhai.ds];
    return HttpResponse.json(dot, { status: 201 });
  }),

  http.patch('/cong-don-vi/dot-trien-khai/:id', async ({ params, request }) => {
    const b = (await request.json()) as SuaDotTrienKhaiDto;
    const cu = dbDotTrienKhai.ds.find((d) => d.id === params.id);
    if (!cu) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Không tìm thấy đợt triển khai' } },
        { status: 404 },
      );
    }
    const { so_gddt_id, ...con } = b;
    const moi: DotTrienKhai = {
      ...cu,
      ...con,
      ...(b.han_nop_ngay ? { han_nop: hanNop(b.han_nop_ngay) } : {}),
      ...(so_gddt_id ? { so_gddt: soGddt(so_gddt_id) } : {}),
    };
    dbDotTrienKhai.ds = dbDotTrienKhai.ds.map((d) => (d.id === cu.id ? moi : d));
    return HttpResponse.json(moi);
  }),

  // Issue #68: gắn khóa NLS vào đợt.
  http.get('/cong-don-vi/dot-trien-khai/:id/khoa-co-the-gan', () => HttpResponse.json(dbDotTrienKhai.khoaCoTheGan)),

  http.put('/cong-don-vi/dot-trien-khai/:id/khoa', async ({ params, request }) => {
    const { khoa_ids } = (await request.json()) as { khoa_ids: string[] };
    const cu = dbDotTrienKhai.ds.find((d) => d.id === params.id);
    if (!cu) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Không tìm thấy đợt triển khai' } },
        { status: 404 },
      );
    }
    const chon = dbDotTrienKhai.khoaCoTheGan.filter((k) => khoa_ids.includes(k.id));
    const khac = chon.filter((k) => k.dot_trien_khai_id !== null && k.dot_trien_khai_id !== cu.id);
    if (khac.length > 0) {
      const moTa = khac.map((k) => `${k.ma_khoa} (đợt ${k.dot_trien_khai_ten})`).join(', ');
      return HttpResponse.json(
        { error: { code: 'CONFLICT', message: `Khóa đã gắn đợt khác — gỡ ở đợt đó trước: ${moTa}` } },
        { status: 409 },
      );
    }
    const moi: DotTrienKhai = {
      ...cu,
      khoa: chon.map(({ id, ma_khoa, ten_khoa, thoi_gian_bat_dau, thoi_gian_ket_thuc }) => ({
        id,
        ma_khoa,
        ten_khoa,
        thoi_gian_bat_dau,
        thoi_gian_ket_thuc,
      })),
    };
    dbDotTrienKhai.ds = dbDotTrienKhai.ds.map((d) => (d.id === cu.id ? moi : d));
    return HttpResponse.json(moi);
  }),
];
