import { http, HttpResponse } from 'msw';
import type { HocVienTinhHinhKhaoSat, TinhTrangBaiKhaoSat } from '@/api/ketQuaKhaoSat';

// Mock POST /sso/cap-ma (2026-10-02) — tách khỏi handlers.ts. Ghi lại target đã yêu cầu để test kiểm.
export const ssoDaYeuCau: (string | undefined)[] = [];

// GET /sso/tinh-trang (2026-10-04) — test gán qua datTinhTrangBai; setup.ts đặt lại sau mỗi test.
export const tinhTrangKhaoSatMock: { value: TinhTrangBaiKhaoSat[] } = { value: [] };

function tinhTrangMacDinh(): TinhTrangBaiKhaoSat[] {
  return (['khao-sat', 'danh-gia', 'dau-ra'] as const).map((loai) => ({
    loai,
    trang_thai: 'chua_lam',
    can_kiem_tra: false,
    mo_gan_nhat_luc: null,
    hoan_thanh_luc: null,
    muc: null,
    muc_goc: null,
    nhan_muc_goc: null,
    url_ket_qua: null,
  }));
}

export function datLaiTinhTrangKhaoSatMock() {
  tinhTrangKhaoSatMock.value = tinhTrangMacDinh();
}
datLaiTinhTrangKhaoSatMock();

/** Gộp bản ghi 1 bài vào trạng thái mặc định (các bài khác "chưa làm"). */
export function datTinhTrangBai(bai: Partial<TinhTrangBaiKhaoSat> & Pick<TinhTrangBaiKhaoSat, 'loai'>) {
  tinhTrangKhaoSatMock.value = tinhTrangKhaoSatMock.value.map((t) => (t.loai === bai.loai ? { ...t, ...bai } : t));
}

export const hocVienTinhHinhMock: HocVienTinhHinhKhaoSat[] = [
  {
    id: 'hv-1',
    ho_ten: 'Hà Thị Thanh',
    ma_dinh_danh_moet: '9115131060',
    doi_tuong: 'giao_vien',
    ten_don_vi: 'Trường TH A',
    // Sửa 2026-10-07: "khao-sat" (Phiếu khảo sát kĩ năng số) chỉ theo dõi đã làm/chưa làm, không có
    // mức/điểm trên UI -> ví dụ đầy đủ mức/điểm/link đặt ở "danh-gia"; "khao-sat" dùng ví dụ đơn giản.
    ket_qua: [
      {
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        can_kiem_tra: false,
        so_lan_mo: 1,
        mo_gan_nhat_luc: '2026-10-04T01:00:00.000Z',
        hoan_thanh_luc: '2026-10-04T01:30:00.000Z',
        muc: 'thanh_thao',
        muc_goc: 'M3',
        nhan_muc_goc: 'M3 – Thành thạo',
        url_ket_qua: 'https://khaosat.test/ket-qua/hv-1',
        diem: 72.5,
        diem_toi_da: 100,
        nguon: 'api',
        cap_nhat_luc: '2026-10-04T01:30:00.000Z',
      },
      {
        loai: 'khao-sat',
        trang_thai: 'da_mo',
        can_kiem_tra: true,
        so_lan_mo: 2,
        mo_gan_nhat_luc: '2026-10-02T01:00:00.000Z',
        hoan_thanh_luc: null,
        muc: null,
        muc_goc: null,
        nhan_muc_goc: null,
        url_ket_qua: null,
        diem: null,
        diem_toi_da: null,
        nguon: 'sso',
        cap_nhat_luc: '2026-10-02T01:00:00.000Z',
      },
    ],
  },
  {
    id: 'hv-2',
    ho_ten: 'Lê Văn Bình',
    ma_dinh_danh_moet: '9115131061',
    doi_tuong: 'can_bo_quan_ly',
    ten_don_vi: 'Trường THCS B',
    ket_qua: [],
  },
];

// GET/PUT /sso/thang-muc (2026-10-05).
export const thangMucMock: { value: { ma: string; nhan: string }[] } = { value: [] };
export function datLaiThangMucMock() {
  thangMucMock.value = [
    { ma: 'M1', nhan: 'Chưa đạt' },
    { ma: 'M2', nhan: 'Cơ bản' },
    { ma: 'M3', nhan: 'Thành thạo' },
    { ma: 'M4', nhan: 'Nâng cao' },
  ];
}
datLaiThangMucMock();

const THEO_MUC_GOC_RONG = [
  { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
  { ma: 'M2', nhan: 'Cơ bản', so_luong: 0 },
  { ma: 'M3', nhan: 'Thành thạo', so_luong: 0 },
  { ma: 'M4', nhan: 'Nâng cao', so_luong: 0 },
];

export const ssoHandlers = [
  http.get('/sso/thang-muc', () => HttpResponse.json({ thang: thangMucMock.value, cap_nhat_luc: null })),
  http.put('/sso/thang-muc', async ({ request }) => {
    const body = (await request.json()) as { muc: { ma: string; nhan: string }[] };
    thangMucMock.value = body.muc;
    return HttpResponse.json({ thang: body.muc, cap_nhat_luc: '2026-10-05T08:00:00.000Z' });
  }),
  http.get('/sso/tinh-trang', () => HttpResponse.json(tinhTrangKhaoSatMock.value)),
  http.get('/sso/ket-qua/thong-ke', () =>
    HttpResponse.json({
      tong_hoc_vien: 2,
      theo_loai: [
        {
          loai: 'khao-sat',
          chua_lam: 1,
          da_mo: 1,
          dang_lam: 0,
          hoan_thanh: 0,
          can_kiem_tra: 1,
          theo_muc_goc: THEO_MUC_GOC_RONG,
          chua_xep_muc: 0,
        },
        {
          loai: 'danh-gia',
          chua_lam: 1,
          da_mo: 0,
          dang_lam: 0,
          hoan_thanh: 1,
          can_kiem_tra: 0,
          theo_muc_goc: THEO_MUC_GOC_RONG.map((m) => (m.ma === 'M3' ? { ...m, so_luong: 1 } : m)),
          chua_xep_muc: 0,
        },
        {
          loai: 'dau-ra',
          chua_lam: 2,
          da_mo: 0,
          dang_lam: 0,
          hoan_thanh: 0,
          can_kiem_tra: 0,
          theo_muc_goc: THEO_MUC_GOC_RONG,
          chua_xep_muc: 0,
        },
      ],
    }),
  ),
  http.get('/sso/ket-qua', ({ request }) => {
    const url = new URL(request.url);
    const trangThai = url.searchParams.get('trang_thai');
    const loai = url.searchParams.get('loai') ?? 'khao-sat';
    const data = hocVienTinhHinhMock.filter((hv) => {
      if (!trangThai) return true;
      const kq = hv.ket_qua.find((k) => k.loai === loai);
      if (trangThai === 'chua_lam') return !kq;
      if (trangThai === 'can_kiem_tra') return !!kq?.can_kiem_tra;
      return kq?.trang_thai === trangThai;
    });
    return HttpResponse.json({ data, total: data.length, page: 1, page_size: 20 });
  }),
  http.post('/sso/cap-ma', async ({ request }) => {
    const body = (await request.json()) as { target?: string };
    ssoDaYeuCau.push(body.target);
    const url = new URL('https://khaosat.test/sso/start');
    url.searchParams.set('code', 'ma-gia-lap-dung-mot-lan');
    if (body.target) url.searchParams.set('target', body.target);
    return HttpResponse.json({ url: url.toString(), het_han: new Date(Date.now() + 300000).toISOString() }, { status: 201 });
  }),
  http.post('/sso/ma-thu', async ({ request }) => {
    const body = (await request.json()) as { ma_dinh_danh_moet: string; target?: string };
    if (body.ma_dinh_danh_moet !== '9115131060') {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Không tìm thấy học viên có mã định danh này' } },
        { status: 404 },
      );
    }
    const url = new URL('https://khaosat.test/sso/start');
    url.searchParams.set('code', 'ma-thu-gia-lap');
    if (body.target) url.searchParams.set('target', body.target);
    return HttpResponse.json(
      {
        url: url.toString(),
        code: 'ma-thu-gia-lap',
        het_han: '2026-10-02T05:00:00.000Z',
        hoc_vien: { id: 'hv-1', ho_ten: 'Hà Thị Thanh', ma_dinh_danh_moet: '9115131060', doi_tuong: null },
      },
      { status: 201 },
    );
  }),
];
