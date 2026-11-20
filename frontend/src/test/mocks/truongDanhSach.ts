import { http, HttpResponse } from 'msw';
import type {
  DanhSachCuaTruong,
  DeNghiCuaTruong,
  GuiDeNghi,
  TheDotTruong,
  TrangThaiDanhSachTruong,
  YKienTruong,
} from '@/api/truongDanhSach';

// Issue #60: trường xem đợt + danh sách của mình (Cổng đơn vị) — CSDL giả, reset sau mỗi test (setup.ts).
// Tên người/đợt đều bịa.
export function theDotMau(p: Partial<TheDotTruong> = {}): TheDotTruong {
  return {
    dot: {
      id: 'dot-hsg-1',
      ten: 'HSG Đợt Bịa 2026',
      chuong_trinh: 'hsg',
      han_nop: '2026-12-31T16:59:59.000Z',
      han_nop_ngay: '2026-12-31',
    },
    so_nguoi: 3,
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri_tam_tinh: 3_086_418,
    trang_thai_danh_sach: 'cho_xac_nhan',
    trang_thai_hop_dong: 'chua_nop',
    ...p,
  };
}

/** co_the_xac_nhan / ly_do_khong_xac_nhan tự tính từ dong nếu không truyền. */
export function danhSachMau(p: Partial<DanhSachCuaTruong> = {}): DanhSachCuaTruong {
  const ds: DanhSachCuaTruong = {
    dot: theDotMau().dot,
    dong: [
      {
        id: 'd-1',
        ho_ten: 'GV Bịa An',
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nữ',
        lop: 'Toán 9',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
        y_kien_truong: null,
      },
      {
        id: 'd-2',
        ho_ten: 'GV Bịa Bình',
        ngay_sinh: null,
        gioi_tinh: null,
        lop: null,
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        ghi_chu: 'chỉ học GĐ1 (bịa)',
        y_kien_truong: null,
      },
      {
        id: 'd-3',
        ho_ten: 'GV Bịa Chi',
        ngay_sinh: '1985-11-20',
        gioi_tinh: 'Nam',
        lop: 'Văn 8',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
        y_kien_truong: null,
      },
    ],
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri_tam_tinh: 3_086_418,
    trang_thai_danh_sach: 'cho_xac_nhan',
    co_the_xac_nhan: false,
    ly_do_khong_xac_nhan: null,
    de_nghi: [],
    so_de_nghi_cho: 0,
    ...p,
  };
  return 'co_the_xac_nhan' in p ? ds : tinhLai(ds);
}

/** Issue #62: 1 đề nghị mẫu (bịa); mặc định sửa họ tên dòng d-1, đang chờ. */
export function deNghiMau(p: Partial<DeNghiCuaTruong> = {}): DeNghiCuaTruong {
  return {
    id: 'dn-1',
    loai: 'sua',
    dong_id: 'd-1',
    gia_tri: { ho_ten: 'GV Bịa An Sửa' },
    gia_tri_cu: {
      ho_ten: 'GV Bịa An',
      ngay_sinh: '1990-02-01',
      gioi_tinh: 'Nữ',
      lop: 'Toán 9',
      giai_doan: 'ca_hai',
      ty_le_suat: 1,
    },
    ly_do: null,
    trang_thai: 'cho',
    ly_do_tu_choi: null,
    gui_luc: '2026-11-20T02:00:00.000Z',
    xu_ly_luc: null,
    ...p,
  };
}

const soCho = (ds: DanhSachCuaTruong) => ds.de_nghi.filter((d) => d.trang_thai === 'cho').length;

// Issue #61, #62: bản rút gọn quy tắc X1/X2 của backend (quy-tac-hop-dong.ts) để mock trả đúng trạng thái.
function trangThaiSauYKien(ds: DanhSachCuaTruong): TrangThaiDanhSachTruong {
  const yKien = ds.dong.map((d) => d.y_kien_truong);
  if (yKien.includes('khong_dong_y') || soCho(ds) > 0) return 'bao_sai_lech';
  if (ds.trang_thai_danh_sach === 'bao_sai_lech') return 'cho_xac_nhan';
  if (ds.trang_thai_danh_sach === 'da_xac_nhan' && !yKien.every((y) => y === 'dong_y')) return 'cho_xac_nhan';
  return ds.trang_thai_danh_sach;
}

function lyDoKhongXacNhan(ds: DanhSachCuaTruong): string | null {
  if (ds.dong.length === 0) return 'Danh sách trống';
  const con = ds.dong.filter((d) => d.y_kien_truong !== 'dong_y').length;
  if (con > 0) return `Còn ${con} dòng chưa Đồng ý`;
  return soCho(ds) > 0 ? 'Còn đề nghị sửa đang chờ' : null;
}

function tinhLai(ds: DanhSachCuaTruong): DanhSachCuaTruong {
  const ly_do_khong_xac_nhan = lyDoKhongXacNhan(ds);
  return { ...ds, co_the_xac_nhan: ly_do_khong_xac_nhan === null, ly_do_khong_xac_nhan, so_de_nghi_cho: soCho(ds) };
}

const xungDot = (message: string) => HttpResponse.json({ error: { code: 'CONFLICT', message } }, { status: 409 });

const khongThay = () =>
  HttpResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Không tìm thấy danh sách của trường cho đợt này' } },
    { status: 404 },
  );

export const dbTruongDanhSach = {
  the: [] as TheDotTruong[],
  danhSach: {} as Record<string, DanhSachCuaTruong>,
};

export function datLaiTruongDanhSachMock() {
  dbTruongDanhSach.the = [];
  dbTruongDanhSach.danhSach = {};
}

export const truongDanhSachHandlers = [
  http.get('/cong-don-vi/truong/dot', () => HttpResponse.json(dbTruongDanhSach.the)),
  http.get('/cong-don-vi/truong/dot/:dotId/danh-sach', ({ params }) => {
    const ds = dbTruongDanhSach.danhSach[params.dotId as string];
    return ds ? HttpResponse.json(ds) : khongThay();
  }),
  http.put('/cong-don-vi/truong/dot/:dotId/danh-sach/:dongId/y-kien', async ({ params, request }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const { y_kien } = (await request.json()) as { y_kien: YKienTruong | null };
    if (ds.de_nghi.some((d) => d.dong_id === params.dongId && d.trang_thai === 'cho')) {
      return xungDot('Dòng đang có đề nghị chờ HCMUE xử lý');
    }
    const dong = ds.dong.map((d) => (d.id === params.dongId ? { ...d, y_kien_truong: y_kien } : d));
    const moi = { ...ds, dong };
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...moi, trang_thai_danh_sach: trangThaiSauYKien(moi) });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId]);
  }),
  http.post('/cong-don-vi/truong/dot/:dotId/danh-sach/dong-y-tat-ca', ({ params }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const dong = ds.dong.map((d) => (d.y_kien_truong === null ? { ...d, y_kien_truong: 'dong_y' as const } : d));
    const moi = { ...ds, dong };
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...moi, trang_thai_danh_sach: trangThaiSauYKien(moi) });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId]);
  }),
  http.post('/cong-don-vi/truong/dot/:dotId/danh-sach/xac-nhan', ({ params }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const lyDo = lyDoKhongXacNhan(ds);
    if (lyDo) return HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: lyDo } }, { status: 400 });
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...ds, trang_thai_danh_sach: 'da_xac_nhan' });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId]);
  }),
  // Issue #62: gửi đề nghị — chỉ kiểm các lỗi màn hình cần hiển thị (bớt thiếu lý do, dòng đã có đề nghị chờ).
  http.post('/cong-don-vi/truong/dot/:dotId/de-nghi', async ({ params, request }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const body = (await request.json()) as GuiDeNghi;
    if (body.loai === 'bot' && !body.ly_do) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Nhập lý do bớt người',
            fields: [{ field: 'ly_do', message: 'Nhập lý do bớt người' }],
          },
        },
        { status: 400 },
      );
    }
    if (body.dong_id && ds.de_nghi.some((d) => d.dong_id === body.dong_id && d.trang_thai === 'cho')) {
      return xungDot('Dòng này đã có đề nghị đang chờ HCMUE xử lý');
    }
    const cu = ds.dong.find((d) => d.id === body.dong_id) ?? null;
    const moi = deNghiMau({
      id: `dn-${ds.de_nghi.length + 1}`,
      loai: body.loai,
      dong_id: body.dong_id ?? null,
      gia_tri: body.gia_tri ?? {},
      gia_tri_cu: cu && { ...cu },
      ly_do: body.ly_do ?? null,
    });
    const dong = ds.dong.map((d) => (d.id === body.dong_id ? { ...d, y_kien_truong: 'khong_dong_y' as const } : d));
    const sau = { ...ds, dong, de_nghi: [moi, ...ds.de_nghi] };
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...sau, trang_thai_danh_sach: trangThaiSauYKien(sau) });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId], { status: 201 });
  }),
];
