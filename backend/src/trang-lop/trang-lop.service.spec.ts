import { DotLop, locTheoVaiTro, VaiTroXemLop } from './trang-lop.service';

// ADR 0004 G9 / đặc tả §3 — test K6: mỗi vai trò thấy đúng tập trường.
const dot: DotLop = {
  lop: {
    id: 'lop-1',
    ten_lop: 'Lớp 1',
    loai_lop: 'truc_tiep',
    si_so_toi_da: 40,
    khoa: { id: 'k1', ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
  },
  giai_doan: {
    id: 'gd-1',
    thu_tu: 1,
    ten_giai_doan: 'Trực tiếp',
    hinh_thuc: 'truc_tiep',
    thoi_gian_bat_dau: new Date('2026-11-01'),
    thoi_gian_ket_thuc: new Date('2026-11-03'),
  },
  buoi: [
    {
      id: 'b1',
      buoi_so: 1,
      thoi_gian_bat_dau: new Date('2026-11-01T01:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-11-01T04:00:00Z'),
      dia_diem_hoac_link: null,
      phong: 'P.1',
      trang_thai: 'chua_dien_ra',
      cap_nhat_luc: new Date('2026-10-01'),
      diem_hoc: null,
      giang_vien: [
        {
          id: 'gv1',
          ho_ten: 'GV A',
          vai_tro: 'giang_vien',
          so_dien_thoai: '0900000001',
          email: 'a@x.vn',
          so_gio: 4,
          da_xac_nhan_gio: true,
        },
      ],
    },
  ],
  hoc_vien: [
    {
      dang_ky_hoc_id: 'dk1',
      hoc_vien_id: 'hv1',
      ho_ten: 'Học viên 1',
      gioi_tinh: 'Nữ',
      don_vi: 'THPT A',
      doi_tuong: 'giao_vien',
      chuc_vu: null,
      muc_dau_vao: 'co_ban',
      so_dien_thoai: '0911111111',
      email: 'hv1@x.vn',
      cum: {
        id: 'c1',
        ten_cum: 'Cụm 1',
        nguoi_ho_tro: [{ ho_ten: 'HT', email: 'ht@x.vn' }],
      },
      diem_danh: { b1: 'co_mat' },
      ket_qua: null,
    },
  ],
  nhom_ho_tro_gv: [{ ho_ten: 'Nhóm GV', email: 'nhom@x.vn' }],
};

const COT: {
  truong: string;
  lay: (d: DotLop) => unknown;
  thay: Record<VaiTroXemLop, boolean>;
}[] = [
  {
    truong: 'lịch buổi + phòng',
    lay: (d) => d.buoi[0].phong,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: true },
  },
  {
    truong: 'họ tên giảng viên',
    lay: (d) => d.buoi[0].giang_vien[0].ho_ten,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: true },
  },
  {
    truong: 'SĐT giảng viên',
    lay: (d) => d.buoi[0].giang_vien[0].so_dien_thoai,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: false },
  },
  {
    truong: 'email giảng viên',
    lay: (d) => d.buoi[0].giang_vien[0].email,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: false },
  },
  {
    truong: 'họ tên + đơn vị học viên',
    lay: (d) => d.hoc_vien[0].don_vi,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: true },
  },
  {
    truong: 'mức đầu vào học viên',
    lay: (d) => d.hoc_vien[0].muc_dau_vao,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: true },
  },
  {
    truong: 'SĐT học viên',
    lay: (d) => d.hoc_vien[0].so_dien_thoai,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: false },
  },
  {
    truong: 'email học viên',
    lay: (d) => d.hoc_vien[0].email,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: false },
  },
  {
    truong: 'cụm + người hỗ trợ HV',
    lay: (d) => d.hoc_vien[0].cum,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: false },
  },
  {
    truong: 'điểm danh',
    lay: (d) => d.hoc_vien[0].diem_danh.b1,
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: true },
  },
  {
    truong: 'nhóm hỗ trợ GV',
    lay: (d) => d.nhom_ho_tro_gv[0],
    thay: { quan_tri: true, ho_tro_giang_vien: true, giang_vien: true },
  },
];

describe('locTheoVaiTro — ma trận liên thông §3', () => {
  for (const vaiTro of [
    'quan_tri',
    'ho_tro_giang_vien',
    'giang_vien',
  ] as VaiTroXemLop[]) {
    for (const c of COT) {
      it(`${vaiTro} ${c.thay[vaiTro] ? 'THẤY' : 'KHÔNG thấy'} ${c.truong}`, () => {
        const giaTri = c.lay(locTheoVaiTro(dot, vaiTro));
        if (c.thay[vaiTro]) expect(giaTri).toBeDefined();
        else expect(giaTri).toBeUndefined();
      });
    }
  }

  it('không làm thay đổi dữ liệu gốc', () => {
    locTheoVaiTro(dot, 'giang_vien');
    expect(dot.hoc_vien[0].so_dien_thoai).toBe('0911111111');
  });
});
