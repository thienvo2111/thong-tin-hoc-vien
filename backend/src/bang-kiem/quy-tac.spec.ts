import { DotLop } from '../trang-lop/trang-lop.service';
import { mauDot, NguCanhDot, QUY_TAC, tinhHan, trangThaiMuc } from './quy-tac';

// ADR 0004 G5b — K12: mỗi quy tắc đạt/không đạt + lý do; màu theo hạn.
function dot(chinh: Partial<DotLop> = {}): DotLop {
  const gv = {
    id: 'gv1',
    ho_ten: 'GV A',
    vai_tro: 'giang_vien',
    so_dien_thoai: '0900000001',
    email: 'a@x.vn',
    so_gio: 3,
    da_xac_nhan_gio: false,
    nhac: 'da_nhac' as const,
  };
  return {
    lop: {
      id: 'l1',
      ten_lop: 'L1',
      loai_lop: 'truc_tiep',
      si_so_toi_da: 2,
      khoa: { id: 'k1', ma_khoa: 'K1', ten_khoa: 'K' },
    },
    giai_doan: {
      id: 'g1',
      thu_tu: 1,
      ten_giai_doan: 'TT',
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
        phong: null,
        trang_thai: 'chua_dien_ra',
        cap_nhat_luc: new Date(),
        diem_hoc: {
          id: 'd1',
          ma_diem_hoc: 'D',
          ten: 'D',
          dia_chi: 'x',
          nguoi_lien_he: null,
          sdt_lien_he: null,
          so_phong: 2,
          ghi_chu_csvc: null,
        },
        giang_vien: [gv],
      },
    ],
    hoc_vien: [
      {
        dang_ky_hoc_id: 'dk',
        hoc_vien_id: 'hv',
        ho_ten: 'HV',
        gioi_tinh: null,
        don_vi: 'X',
        doi_tuong: null,
        chuc_vu: null,
        muc_dau_vao: null,
        muc_hoc_chon: null,
        so_dien_thoai: null,
        email: null,
        cum: null,
        diem_danh: {},
        bao_vang: {},
        ket_qua: null,
      },
    ],
    nhom_ho_tro_gv: [],
    hau_can: [
      {
        id: 'h',
        lop_id: 'l1',
        giai_doan_id: 'g1',
        giang_vien_id: 'gv1',
        noi_o_ten: null,
        noi_o_dia_chi: null,
        nhan_phong: null,
        tra_phong: null,
        phuong_tien: null,
        don_luc: null,
        diem_don: null,
        lien_he_don: null,
        ghi_chu: null,
        da_xac_nhan_noi_o: true,
        da_xac_nhan_di_chuyen: true,
        cap_nhat_boi: null,
        cap_nhat_luc: new Date(),
        nguoi_sua: null,
      },
    ],
    de_nghi_cho: [],
    thuc_dia: [
      {
        id: 't',
        ho_ten: 'T',
        so_dien_thoai: '0911111111',
        nhiem_vu: null,
        ghi_chu: null,
      },
    ],
    ...chinh,
  };
}

const ctx = (d: DotLop, canhBaoSoPhong: string[] = []): NguCanhDot => ({
  dot: d,
  canhBaoSoPhong,
});

describe('QUY_TAC — đợt đủ điều kiện thì mọi quy tắc đạt', () => {
  for (const [ma, q] of Object.entries(QUY_TAC)) {
    it(`${ma} đạt`, () =>
      expect(q.kiemTra(ctx(dot()))).toEqual({ dat: true, ly_do: null }));
  }
});

describe('QUY_TAC — từng trường hợp thiếu', () => {
  const d = dot();
  const b0 = d.buoi[0];

  it('co_diem_hoc: buổi thiếu điểm học → nêu buổi số', () => {
    const kq = QUY_TAC.co_diem_hoc.kiemTra(
      ctx(dot({ buoi: [{ ...b0, diem_hoc: null }] })),
    );
    expect(kq).toEqual({ dat: false, ly_do: 'Buổi 1 chưa có điểm học' });
  });

  it('co_diem_hoc / co_giang_vien: đợt chưa có buổi → không đạt', () => {
    expect(QUY_TAC.co_diem_hoc.kiemTra(ctx(dot({ buoi: [] }))).dat).toBe(false);
    expect(QUY_TAC.co_giang_vien.kiemTra(ctx(dot({ buoi: [] }))).dat).toBe(
      false,
    );
  });

  it('co_giang_vien: buổi không có giảng viên', () => {
    expect(
      QUY_TAC.co_giang_vien.kiemTra(
        ctx(dot({ buoi: [{ ...b0, giang_vien: [] }] })),
      ).ly_do,
    ).toContain('Buổi 1');
  });

  it('khong_vuot_so_phong: có cảnh báo → không đạt, lý do là cảnh báo', () => {
    expect(QUY_TAC.khong_vuot_so_phong.kiemTra(ctx(d, ['vượt phòng']))).toEqual(
      { dat: false, ly_do: 'vượt phòng' },
    );
  });

  it('co_hoc_vien: 0 học viên / vượt sĩ số tối đa', () => {
    expect(QUY_TAC.co_hoc_vien.kiemTra(ctx(dot({ hoc_vien: [] }))).dat).toBe(
      false,
    );
    const h = d.hoc_vien[0];
    expect(
      QUY_TAC.co_hoc_vien.kiemTra(ctx(dot({ hoc_vien: [h, h, h] }))).ly_do,
    ).toContain('vượt tối đa 2');
  });

  it('giang_vien_co_tai_khoan: theo trạng thái tài khoản thật', () => {
    const kt = (g: object) =>
      QUY_TAC.giang_vien_co_tai_khoan.kiemTra(
        ctx(
          dot({
            buoi: [{ ...b0, giang_vien: [{ ...b0.giang_vien[0], ...g }] }],
          }),
        ),
      );
    expect(kt({ tai_khoan: 'chua_co' }).ly_do).toBe('Chưa cấp tài khoản: GV A');
    expect(kt({ tai_khoan: 'chua_co', email: null }).ly_do).toBe(
      'Chưa có email: GV A',
    );
    expect(kt({ tai_khoan: 'bi_khoa' }).ly_do).toBe('Tài khoản bị khóa: GV A');
    expect(kt({ tai_khoan: 'chua_kich_hoat' }).dat).toBe(true);
    expect(kt({ tai_khoan: 'hoat_dong' }).dat).toBe(true);
  });

  it('hau_can_da_xac_nhan: thiếu bản ghi hoặc chưa xác nhận đủ 2 mục', () => {
    expect(
      QUY_TAC.hau_can_da_xac_nhan.kiemTra(ctx(dot({ hau_can: [] }))).dat,
    ).toBe(false);
    const h = { ...d.hau_can[0], da_xac_nhan_di_chuyen: false };
    expect(
      QUY_TAC.hau_can_da_xac_nhan.kiemTra(ctx(dot({ hau_can: [h] }))).dat,
    ).toBe(false);
  });

  it('da_nhac_giang_vien: chưa nhắc / cần nhắc lại theo giảng viên', () => {
    const kt = (nhac: 'chua_nhac' | 'can_nhac_lai') =>
      QUY_TAC.da_nhac_giang_vien.kiemTra(
        ctx(
          dot({
            buoi: [{ ...b0, giang_vien: [{ ...b0.giang_vien[0], nhac }] }],
          }),
        ),
      ).ly_do;
    expect(kt('chua_nhac')).toBe('Chưa nhắc: GV A');
    expect(kt('can_nhac_lai')).toBe('Cần nhắc lại (lịch đã đổi): GV A');
    expect(QUY_TAC.da_nhac_giang_vien.kiemTra(ctx(dot({ buoi: [] }))).dat).toBe(
      false,
    );
  });

  it('khong_de_nghi_cho: còn đề nghị chờ → chưa đạt, hết → đạt', () => {
    const cho = {
      id: 'dn',
      ho_ten: 'HV',
      chieu: 'vao' as const,
      tu_lop: null,
      den_lop: 'L1',
      ly_do: 'x',
      tao_luc: new Date(),
    };
    const kq = QUY_TAC.khong_de_nghi_cho.kiemTra(
      ctx(dot({ de_nghi_cho: [cho] })),
    );
    expect(kq).toEqual({
      dat: false,
      ly_do: '1 đề nghị đổi lớp đang chờ duyệt',
    });
    expect(QUY_TAC.khong_de_nghi_cho.kiemTra(ctx(dot())).dat).toBe(true);
  });

  it('co_thuc_dia: chưa có người thực địa', () => {
    expect(QUY_TAC.co_thuc_dia.kiemTra(ctx(dot({ thuc_dia: [] }))).dat).toBe(
      false,
    );
  });
});

describe('hạn + màu', () => {
  const buoiDau = new Date('2026-11-10T01:00:00Z');

  it('tinhHan = buổi đầu − N ngày; không hạn / chưa có buổi → null', () => {
    expect(tinhHan(buoiDau, 3)?.toISOString()).toBe('2026-11-07T01:00:00.000Z');
    expect(tinhHan(buoiDau, null)).toBeNull();
    expect(tinhHan(null, 3)).toBeNull();
  });

  it('trangThaiMuc: đạt → dat; chưa đạt quá hạn → qua_han; chưa tới hạn / không hạn → chua_dat', () => {
    const han = new Date('2026-11-07T00:00:00Z');
    expect(trangThaiMuc(true, han, new Date('2026-11-09'))).toBe('dat');
    expect(trangThaiMuc(false, han, new Date('2026-11-08'))).toBe('qua_han');
    expect(trangThaiMuc(false, han, new Date('2026-11-06'))).toBe('chua_dat');
    expect(trangThaiMuc(false, null, new Date('2027-01-01'))).toBe('chua_dat');
  });

  it('mauDot: có quá hạn → đỏ; có chưa đạt → vàng; đạt hết (hoặc rỗng) → xanh', () => {
    expect(mauDot(['dat', 'qua_han', 'chua_dat'])).toBe('do');
    expect(mauDot(['dat', 'chua_dat'])).toBe('vang');
    expect(mauDot(['dat'])).toBe('xanh');
    expect(mauDot([])).toBe('xanh');
  });
});
