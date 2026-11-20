import { http, HttpResponse } from 'msw';
import type { MucDeNghi } from '@/api/deNghiSua';
import type { TrangThaiDeNghi } from '@/api/truongDanhSach';

// Issue #62: hàng đợi đề nghị của trường (Quản trị) — CSDL giả, reset sau mỗi test (setup.ts). Dữ liệu bịa.
export function mucDeNghiMau(p: Partial<MucDeNghi> = {}): MucDeNghi {
  return {
    id: 'dn-1',
    don_vi: { id: 'tr-1', ten: 'Trường THCS Mẫu Một' },
    loai: 'sua',
    dong_id: 'd1',
    dong_hien_tai: {
      ho_ten: 'GV Bịa Một',
      ngay_sinh: '1990-02-01',
      gioi_tinh: 'Nam',
      lop: 'Lớp A',
      giai_doan: 'ca_hai',
      ty_le_suat: 1,
      y_kien_truong: 'khong_dong_y',
    },
    gia_tri: { ho_ten: 'GV Bịa Một Sửa', giai_doan: 'chi_gd2' },
    gia_tri_cu: null,
    ly_do: 'Sai chính tả (bịa)',
    trang_thai: 'cho',
    ly_do_tu_choi: null,
    gui_luc: '2026-11-20T02:00:00.000Z',
    gui_boi: { id: 'u-truong', ho_ten: 'Tài khoản trường bịa', ten_dang_nhap: 'truong-bia@test.local' },
    xu_ly_luc: null,
    xu_ly_boi: null,
    ...p,
  };
}

export const dbDeNghiSua = { ds: [] as MucDeNghi[] };

export function datLaiDeNghiSuaMock() {
  dbDeNghiSua.ds = [];
}

function xuLy(id: string, trang_thai: TrangThaiDeNghi, ly_do_tu_choi: string | null) {
  const dn = dbDeNghiSua.ds.find((d) => d.id === id);
  if (!dn)
    return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đề nghị' } }, { status: 404 });
  if (dn.trang_thai !== 'cho') {
    return HttpResponse.json({ error: { code: 'CONFLICT', message: 'Đề nghị đã được xử lý' } }, { status: 409 });
  }
  Object.assign(dn, {
    trang_thai,
    ly_do_tu_choi,
    xu_ly_luc: '2026-11-20T03:00:00.000Z',
    xu_ly_boi: { id: 'u-qt', ho_ten: 'Quản trị bịa' },
  });
  return HttpResponse.json(dn);
}

export const deNghiSuaHandlers = [
  http.get('/cong-don-vi/dot-trien-khai/:id/de-nghi', ({ request }) => {
    const qs = new URL(request.url).searchParams;
    const trangThai = qs.get('trang_thai') ?? 'cho';
    const donVi = qs.get('don_vi_id');
    const items = dbDeNghiSua.ds.filter((d) => d.trang_thai === trangThai && (!donVi || d.don_vi.id === donVi));
    return HttpResponse.json({ items, so_cho: dbDeNghiSua.ds.filter((d) => d.trang_thai === 'cho').length });
  }),
  http.post('/cong-don-vi/de-nghi-sua/:id/ap-dung', ({ params }) => xuLy(params.id as string, 'da_ap_dung', null)),
  http.post('/cong-don-vi/de-nghi-sua/:id/tu-choi', async ({ params, request }) => {
    const { ly_do } = (await request.json()) as { ly_do?: string };
    if (!ly_do?.trim()) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Nhập lý do (tối đa 500 ký tự)' } },
        { status: 400 },
      );
    }
    return xuLy(params.id as string, 'tu_choi', ly_do.trim());
  }),
];
