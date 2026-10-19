import { http, HttpResponse } from 'msw';
import type {
  BuoiDiHoc,
  ChiTietDiHoc,
  DiemDanhBoSungDto,
  DongTinhHinhDiHoc,
  KhoaLocDiHoc,
  TrangThaiDiemDanh,
} from '@/api/tinhHinhDiHoc';

// ADR 0010: Tình hình đi học — 25 học viên giả để thử phân trang (20/trang); "Nguyễn Văn An" có 1 buổi vắng,
// 1 buổi đổi sang lớp khác, 1 buổi tương lai, 1 buổi có mặt nhờ học bù ở lớp khác (ADR 0010 T7).
const KHOA: KhoaLocDiHoc[] = [
  {
    khoa_id: 'khoa-1',
    ma_khoa: 'KBD-AG-01',
    ten_khoa: 'Khóa An Giang',
    cum: [{ id: 'cum-1', ten_cum: 'Cụm Long Xuyên' }],
    lop: [
      { id: 'lop-zoom-1', ten_lop: 'Zoom 01', loai_lop: 'zoom' },
      { id: 'lop-zoom-2', ten_lop: 'Zoom 02', loai_lop: 'zoom' },
    ],
  },
  { khoa_id: 'khoa-2', ma_khoa: 'KBD-AG-02', ten_khoa: 'Khóa An Giang 2', cum: [], lop: [] },
];

function taoDong(i: number): DongTinhHinhDiHoc {
  const an = i === 0;
  return {
    hoc_vien_id: `hv-dh-${i}`,
    dang_ky_hoc_id: `dk-dh-${i}`,
    ho_ten: an ? 'Nguyễn Văn An' : `Học viên ${String(i).padStart(2, '0')}`,
    ma_dinh_danh_moet: `0${1000 + i}`,
    don_vi_cong_tac_ten: 'Trường THCS Mỹ Hòa',
    cum: 'Cụm Long Xuyên',
    lop_theo_giai_doan: [
      { giai_doan_id: 'gd-1', thu_tu: 1, ten_giai_doan: 'Học Zoom', lop_id: 'lop-zoom-1', ten_lop: 'Zoom 01' },
    ],
    tong: an
      ? { da_dien_ra: 3, co_mat: 1, vang: 1, vang_co_phep: 0, da_bao_vang: 0, chua_diem_danh: 1 }
      : { da_dien_ra: 2, co_mat: 2, vang: 0, vang_co_phep: 0, da_bao_vang: 0, chua_diem_danh: 0 },
  };
}

function taoBuoi(): BuoiDiHoc[] {
  const lop1 = { id: 'lop-zoom-1', ten_lop: 'Zoom 01' };
  const dd = (
    ma: BuoiDiHoc['diem_danh']['ma'],
    nhan: string,
    trang_thai: TrangThaiDiemDanh | null = null,
  ): BuoiDiHoc['diem_danh'] => ({
    ma,
    nhan,
    nguon_tinh: trang_thai ? 'lop_hien_tai' : null,
    lop_tinh: trang_thai ? lop1 : null,
    trang_thai,
    nguon: trang_thai ? 'zoom' : null,
    ghi_chu: null,
    nguoi_sua: null,
    cap_nhat_luc: null,
    tu_diem_danh_luc: null,
  });
  const gd = { id: 'gd-1', thu_tu: 1, ten_giai_doan: 'Học Zoom' };
  return [
    {
      lich_hoc_id: 'l-1',
      lich_nguon_id: 'l-1',
      giai_doan: gd,
      buoi_so: 1,
      lop: lop1,
      doi_buoi: null,
      thoi_gian_bat_dau: '2026-10-01T00:30:00.000Z',
      thoi_gian_ket_thuc: '2026-10-01T03:30:00.000Z',
      diem_danh: dd('vang', 'Vắng', 'vang'),
      bo_sung_duoc: true,
      ly_do_khong: null,
    },
    {
      lich_hoc_id: 'l-chot',
      lich_nguon_id: 'l-2',
      giai_doan: gd,
      buoi_so: 2,
      lop: { id: 'lop-zoom-2', ten_lop: 'Zoom 02' },
      doi_buoi: { tu_lop: lop1, sang_lop: { id: 'lop-zoom-2', ten_lop: 'Zoom 02' } },
      thoi_gian_bat_dau: '2026-10-08T00:30:00.000Z',
      thoi_gian_ket_thuc: '2026-10-08T03:30:00.000Z',
      diem_danh: dd('chua_diem_danh', 'Chưa điểm danh'),
      bo_sung_duoc: true,
      ly_do_khong: null,
    },
    {
      lich_hoc_id: 'l-3',
      lich_nguon_id: 'l-3',
      giai_doan: gd,
      buoi_so: 3,
      lop: lop1,
      doi_buoi: null,
      thoi_gian_bat_dau: '2099-10-20T00:30:00.000Z',
      thoi_gian_ket_thuc: '2099-10-20T03:30:00.000Z',
      diem_danh: dd('chua_den_gio', 'Chưa đến giờ'),
      bo_sung_duoc: false,
      ly_do_khong: 'Buổi học chưa diễn ra',
    },
    {
      lich_hoc_id: 'l-4',
      lich_nguon_id: 'l-4',
      giai_doan: gd,
      buoi_so: 4,
      lop: lop1,
      doi_buoi: null,
      thoi_gian_bat_dau: '2026-10-10T00:30:00.000Z',
      thoi_gian_ket_thuc: '2026-10-10T03:30:00.000Z',
      diem_danh: {
        ...dd('co_mat', 'Có mặt – ở lớp Trực tiếp 05'),
        nguon_tinh: 'lop_khac',
        lop_tinh: { id: 'lop-tt-5', ten_lop: 'Trực tiếp 05' },
      },
      bo_sung_duoc: false,
      ly_do_khong: 'Đã có mặt ở lớp Trực tiếp 05 (học bù/lớp cũ)',
    },
  ];
}

export const tinhHinhDiHocMock = {
  dong: Array.from({ length: 25 }, (_, i) => taoDong(i)),
  buoi: taoBuoi(),
  /** Body các lần PUT điểm danh bổ sung (để test kiểm tra). */
  daGhi: [] as { url: string; body: DiemDanhBoSungDto }[],
};

export function datLaiTinhHinhDiHocMock() {
  tinhHinhDiHocMock.dong = Array.from({ length: 25 }, (_, i) => taoDong(i));
  tinhHinhDiHocMock.buoi = taoBuoi();
  tinhHinhDiHocMock.daGhi = [];
}

function handlersCho(goc: string, trangThaiDuoc: TrangThaiDiemDanh[]) {
  return [
    http.get(`${goc}/khoa`, () => HttpResponse.json(KHOA)),
    http.get(`${goc}/xuat`, () => new HttpResponse(new Blob(['xlsx']))),
    http.get(goc, ({ request }) => {
      const sp = new URL(request.url).searchParams;
      const page = Number(sp.get('page') ?? 1);
      const pageSize = Number(sp.get('page_size') ?? 20);
      const q = sp.get('q')?.toLowerCase();
      let ds = sp.get('khoa_id') === 'khoa-1' ? tinhHinhDiHocMock.dong : [];
      if (q) ds = ds.filter((d) => d.ho_ten.toLowerCase().includes(q) || d.ma_dinh_danh_moet?.includes(q));
      if (sp.get('co_vang') === 'true') ds = ds.filter((d) => d.tong.vang > 0);
      return HttpResponse.json({
        data: ds.slice((page - 1) * pageSize, page * pageSize),
        total: ds.length,
        page,
        page_size: pageSize,
      });
    }),
    http.get(`${goc}/:dangKyHocId`, ({ params }) => {
      const dong = tinhHinhDiHocMock.dong.find((d) => d.dang_ky_hoc_id === params.dangKyHocId);
      if (!dong) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ học viên' } },
          { status: 404 },
        );
      }
      const ct: ChiTietDiHoc = {
        ...dong,
        khoa: { id: 'khoa-1', ma_khoa: 'KBD-AG-01', ten_khoa: 'Khóa An Giang' },
        trang_thai_duoc: trangThaiDuoc,
        buoi: tinhHinhDiHocMock.buoi,
      };
      return HttpResponse.json(ct);
    }),
    http.put(`${goc}/:dangKyHocId/diem-danh`, async ({ request }) => {
      const body = (await request.json()) as DiemDanhBoSungDto;
      tinhHinhDiHocMock.daGhi.push({ url: new URL(request.url).pathname, body });
      const b = tinhHinhDiHocMock.buoi.find((x) => x.lich_hoc_id === body.lich_hoc_id);
      if (b) {
        b.diem_danh = {
          ...b.diem_danh,
          ma: body.trang_thai,
          nhan:
            body.trang_thai === 'co_mat' ? 'Có mặt (Thủ công)' : body.trang_thai === 'vang' ? 'Vắng' : 'Vắng có phép',
          nguon_tinh: 'lop_hien_tai',
          lop_tinh: b.lop,
          trang_thai: body.trang_thai,
          nguon: 'thu_cong',
          ghi_chu: body.ly_do ?? null,
          nguoi_sua: 'Người hỗ trợ',
          cap_nhat_luc: new Date().toISOString(),
        };
      }
      return HttpResponse.json({ dang_ky_hoc_id: 'dk', lich_hoc_id: body.lich_hoc_id, trang_thai: body.trang_thai });
    }),
  ];
}

export const tinhHinhDiHocHandlers = [
  ...handlersCho('/ho-tro-hoc-vien/di-hoc', ['co_mat', 'vang_co_phep']),
  ...handlersCho('/thong-ke/di-hoc', ['co_mat', 'vang', 'vang_co_phep']),
];
