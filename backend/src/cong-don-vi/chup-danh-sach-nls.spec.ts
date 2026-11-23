import {
  DangKyChup,
  DonViHocVien,
  KhoaChup,
  LY_DO_KHONG_PHAI_TRUONG,
  LY_DO_NGOAI_SO,
  LY_DO_NGUNG_HOAT_DONG,
  QuaNhieuGiaiDoanHocError,
  giaiDoanThamGia,
  khoaQuaNhieuGiaiDoan,
  lapBanChup,
  lyDoNgoaiPhamVi,
  ngaySinhTuHocVien,
  noiTenLop,
  tongHopTheoTruong,
} from './chup-danh-sach-nls';

// Issue #68 / ADR 0015 S1, S3: giai đoạn tham gia + suất NLS từ phân lớp giai đoạn (không theo điểm danh).
describe('giaiDoanThamGia', () => {
  it('khóa 1 giai đoạn học: học → Cả 2', () => {
    expect(giaiDoanThamGia(1, [0])).toBe('ca_hai');
  });

  it('khóa 2 giai đoạn học: cả hai → Cả 2, chỉ GĐ1 / chỉ GĐ2 → nửa suất', () => {
    expect(giaiDoanThamGia(2, [0, 1])).toBe('ca_hai');
    expect(giaiDoanThamGia(2, [1, 0])).toBe('ca_hai');
    expect(giaiDoanThamGia(2, [0])).toBe('chi_gd1');
    expect(giaiDoanThamGia(2, [1])).toBe('chi_gd2');
  });

  it('không học giai đoạn nào → null (không thành dòng)', () => {
    expect(giaiDoanThamGia(2, [])).toBeNull();
    expect(giaiDoanThamGia(1, [])).toBeNull();
    expect(giaiDoanThamGia(0, [])).toBeNull();
  });

  it('chỉ số trùng / ngoài khoảng bị bỏ', () => {
    expect(giaiDoanThamGia(2, [0, 0])).toBe('chi_gd1');
    expect(giaiDoanThamGia(2, [1, 5, -1])).toBe('chi_gd2');
    expect(giaiDoanThamGia(1, [3])).toBeNull();
  });

  it('> 2 giai đoạn học → lỗi, không đoán', () => {
    expect(() => giaiDoanThamGia(3, [0, 1, 2])).toThrow(
      QuaNhieuGiaiDoanHocError,
    );
    expect(() => giaiDoanThamGia(3, [])).toThrow(QuaNhieuGiaiDoanHocError);
  });
});

describe('ngaySinhTuHocVien', () => {
  it('ngày hợp lệ → YYYY-MM-DD', () => {
    expect(ngaySinhTuHocVien(4, 3, 1991)).toBe('1991-03-04');
    expect(ngaySinhTuHocVien(29, 2, 2000)).toBe('2000-02-29');
  });

  it('ngày không có thật / rỗng → null', () => {
    expect(ngaySinhTuHocVien(30, 2, 1990)).toBeNull();
    expect(ngaySinhTuHocVien(0, 1, 1990)).toBeNull();
    expect(ngaySinhTuHocVien(1, 13, 1990)).toBeNull();
    expect(ngaySinhTuHocVien(1, 1, 0)).toBeNull();
  });
});

describe('noiTenLop', () => {
  it('nối theo thứ tự, bỏ trùng và rỗng', () => {
    expect(noiTenLop(['L1', 'L2'])).toBe('L1, L2');
    expect(noiTenLop(['L1', 'L1'])).toBe('L1');
    expect(noiTenLop([' ', ''])).toBeNull();
    expect(noiTenLop([])).toBeNull();
  });

  it('cắt vừa 100 ký tự', () => {
    const lop = noiTenLop(['A'.repeat(80), 'B'.repeat(40)]) as string;
    expect(lop).toHaveLength(100);
    expect(lop.endsWith('…')).toBe(true);
  });
});

const TRUONG_A: DonViHocVien = {
  id: 'tA',
  ten_don_vi: 'Trường A Bịa',
  loai_don_vi: 'truong',
  trang_thai: 'active',
};
const TRUONG_B: DonViHocVien = {
  ...TRUONG_A,
  id: 'tB',
  ten_don_vi: 'Trường B Bịa',
};
const PHONG: DonViHocVien = {
  id: 'phong',
  ten_don_vi: 'Phòng Bịa',
  loai_don_vi: 'phong_vhxh',
  trang_thai: 'active',
};
const PHAM_VI = new Set(['so', 'tA', 'tB', 'phong', 'tNgung']);

describe('lyDoNgoaiPhamVi (M6)', () => {
  it('trường đang hoạt động trong cây Sở → null', () => {
    expect(lyDoNgoaiPhamVi(TRUONG_A, PHAM_VI)).toBeNull();
  });

  it('không phải trường / ngưng hoạt động / ngoài Sở', () => {
    expect(lyDoNgoaiPhamVi(PHONG, PHAM_VI)).toBe(LY_DO_KHONG_PHAI_TRUONG);
    expect(
      lyDoNgoaiPhamVi(
        { ...TRUONG_A, id: 'tNgung', trang_thai: 'inactive' },
        PHAM_VI,
      ),
    ).toBe(LY_DO_NGUNG_HOAT_DONG);
    expect(lyDoNgoaiPhamVi({ ...TRUONG_A, id: 'khac' }, PHAM_VI)).toBe(
      LY_DO_NGOAI_SO,
    );
  });
});

const K1: KhoaChup = {
  id: 'k1',
  ma_khoa: 'K1',
  thoi_gian_bat_dau: '2026-03-01',
  giai_doan_hoc: ['g1', 'g2'],
};
const K2: KhoaChup = {
  id: 'k2',
  ma_khoa: 'K2',
  thoi_gian_bat_dau: '2026-05-01',
  giai_doan_hoc: ['h1'],
};
const K0: KhoaChup = {
  id: 'k0',
  ma_khoa: 'K0',
  thoi_gian_bat_dau: '2026-01-01',
  giai_doan_hoc: [],
};

function dk(
  hvId: string,
  khoa: KhoaChup,
  giaiDoan: string[],
  p: Partial<DangKyChup> & { don_vi?: DonViHocVien } = {},
): DangKyChup {
  const { don_vi = TRUONG_A, ...con } = p;
  return {
    khoa_id: khoa.id,
    trang_thai: 'da_phan_lop',
    hoc_vien: {
      id: hvId,
      ho_ten: `GV Bịa ${hvId}`,
      ngay_sinh: '1990-01-02',
      gioi_tinh: 'Nữ',
      ma_dinh_danh_moet: `MOET-${hvId}`,
      don_vi,
    },
    phan_lop: giaiDoan.map((g) => ({ giai_doan_id: g, ten_lop: `Lớp ${g}` })),
    ...con,
  };
}

describe('khoaQuaNhieuGiaiDoan', () => {
  it('liệt kê mã khóa > 2 giai đoạn học', () => {
    const k3: KhoaChup = {
      ...K1,
      id: 'k3',
      ma_khoa: 'K3',
      giai_doan_hoc: ['a', 'b', 'c'],
    };
    expect(khoaQuaNhieuGiaiDoan([K1, K2, k3, K0])).toEqual(['K3']);
    expect(khoaQuaNhieuGiaiDoan([K1, K2])).toEqual([]);
  });
});

describe('lapBanChup', () => {
  it('đủ / chỉ GĐ1 / chỉ GĐ2 → suất 1 / 0,5 / 0,5, giữ thông tin cá nhân và mã lớp', () => {
    const { dong, bo_qua } = lapBanChup(
      [K1],
      [
        dk('hv1', K1, ['g1', 'g2']),
        dk('hv2', K1, ['g1']),
        dk('hv3', K1, ['g2'], { don_vi: TRUONG_B }),
      ],
      PHAM_VI,
    );
    expect(bo_qua).toEqual({
      chua_phan_lop: 0,
      ngoai_pham_vi: [],
      trung_khoa: 0,
    });
    expect(dong).toEqual([
      {
        hoc_vien_id: 'hv1',
        don_vi_id: 'tA',
        ho_ten: 'GV Bịa hv1',
        ngay_sinh: '1990-01-02',
        gioi_tinh: 'Nữ',
        ma_goc: 'MOET-hv1',
        lop: 'Lớp g1, Lớp g2',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
        y_kien_truong: null,
      },
      expect.objectContaining({
        hoc_vien_id: 'hv2',
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        lop: 'Lớp g1',
      }),
      expect.objectContaining({
        hoc_vien_id: 'hv3',
        don_vi_id: 'tB',
        giai_doan: 'chi_gd2',
        ty_le_suat: 0.5,
        lop: 'Lớp g2',
      }),
    ]);
  });

  it('phân lớp ở giai đoạn không phải giai đoạn học bị bỏ qua', () => {
    const { dong, bo_qua } = lapBanChup(
      [K1],
      [dk('hv1', K1, ['gDanhGia', 'g2']), dk('hv2', K1, ['gDanhGia'])],
      PHAM_VI,
    );
    expect(dong).toEqual([
      expect.objectContaining({
        hoc_vien_id: 'hv1',
        giai_doan: 'chi_gd2',
        lop: 'Lớp g2',
      }),
    ]);
    expect(bo_qua.chua_phan_lop).toBe(1);
  });

  it('chưa phân lớp → bỏ qua, đếm theo người', () => {
    const { dong, bo_qua } = lapBanChup(
      [K1, K0],
      [dk('hv4', K1, []), dk('hv5', K0, []), dk('hv5', K1, [])],
      PHAM_VI,
    );
    expect(dong).toEqual([]);
    expect(bo_qua.chua_phan_lop).toBe(2);
  });

  it('ghi danh tu_choi bị bỏ kể cả còn phân lớp; không đếm vào chưa phân lớp', () => {
    const { dong, bo_qua } = lapBanChup(
      [K1],
      [dk('hv5', K1, ['g1', 'g2'], { trang_thai: 'tu_choi' })],
      PHAM_VI,
    );
    expect(dong).toEqual([]);
    expect(bo_qua.chua_phan_lop).toBe(0);
  });

  it('ghi danh cho_duyet / da_duyet có phân lớp vẫn thành dòng', () => {
    const { dong } = lapBanChup(
      [K1],
      [
        dk('hv1', K1, ['g1', 'g2'], { trang_thai: 'cho_duyet' }),
        dk('hv2', K1, ['g1'], { trang_thai: 'da_duyet' }),
      ],
      PHAM_VI,
    );
    expect(dong.map((d) => d.hoc_vien_id)).toEqual(['hv1', 'hv2']);
  });

  it('ghi danh khóa không thuộc đợt bị bỏ', () => {
    const { dong } = lapBanChup([K1], [dk('hv1', K2, ['h1'])], PHAM_VI);
    expect(dong).toEqual([]);
  });

  it('ngoài phạm vi (M6) → không thành dòng, có tên + lý do, sắp theo đơn vị rồi họ tên', () => {
    const { dong, bo_qua } = lapBanChup(
      [K1],
      [
        dk('hv7', K1, ['g1'], {
          don_vi: { ...TRUONG_A, id: 'khac', ten_don_vi: 'Trường Ngoài Bịa' },
        }),
        dk('hv6', K1, ['g1', 'g2'], { don_vi: PHONG }),
      ],
      PHAM_VI,
    );
    expect(dong).toEqual([]);
    expect(bo_qua.ngoai_pham_vi).toEqual([
      {
        hoc_vien_id: 'hv6',
        ho_ten: 'GV Bịa hv6',
        don_vi_ten: 'Phòng Bịa',
        ly_do: LY_DO_KHONG_PHAI_TRUONG,
      },
      {
        hoc_vien_id: 'hv7',
        ho_ten: 'GV Bịa hv7',
        don_vi_ten: 'Trường Ngoài Bịa',
        ly_do: LY_DO_NGOAI_SO,
      },
    ]);
  });

  it('người chưa phân lớp ở ngoài phạm vi chỉ tính chưa phân lớp', () => {
    const { bo_qua } = lapBanChup(
      [K1],
      [dk('hv6', K1, [], { don_vi: PHONG })],
      PHAM_VI,
    );
    expect(bo_qua).toEqual({
      chua_phan_lop: 1,
      ngoai_pham_vi: [],
      trung_khoa: 0,
    });
  });

  describe('trùng khóa trong đợt → 1 dòng', () => {
    it('giữ ghi danh suất cao hơn, ghi chú khóa còn lại', () => {
      const { dong, bo_qua } = lapBanChup(
        [K1, K2],
        [dk('hv7', K1, ['g1']), dk('hv7', K2, ['h1'])],
        PHAM_VI,
      );
      expect(dong).toEqual([
        expect.objectContaining({
          hoc_vien_id: 'hv7',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          lop: 'Lớp h1',
          ghi_chu: 'Cũng ghi danh khóa K1',
        }),
      ]);
      expect(bo_qua.trung_khoa).toBe(1);
    });

    it('bằng suất → khóa bắt đầu sớm hơn', () => {
      const { dong } = lapBanChup(
        [K2, K1],
        [dk('hv7', K2, ['h1']), dk('hv7', K1, ['g1', 'g2'])],
        PHAM_VI,
      );
      expect(dong).toEqual([
        expect.objectContaining({
          giai_doan: 'ca_hai',
          lop: 'Lớp g1, Lớp g2',
          ghi_chu: 'Cũng ghi danh khóa K2',
        }),
      ]);
    });

    it('bằng suất, cùng ngày bắt đầu → mã khóa nhỏ hơn; ghi chú liệt kê mọi khóa khác theo ngày', () => {
      const kA: KhoaChup = { ...K2, id: 'kA', ma_khoa: 'KA' };
      const kB: KhoaChup = { ...K2, id: 'kB', ma_khoa: 'KB' };
      const { dong, bo_qua } = lapBanChup(
        [kB, K1, kA],
        [dk('hv', kB, ['h1']), dk('hv', K1, ['g1']), dk('hv', kA, ['h1'])],
        PHAM_VI,
      );
      expect(dong).toHaveLength(1);
      expect(dong[0].lop).toBe('Lớp h1');
      expect(dong[0].ghi_chu).toBe('Cũng ghi danh khóa K1, KB');
      expect(bo_qua.trung_khoa).toBe(1);
    });

    it('khóa còn lại chưa phân lớp / bị từ chối không vào ghi chú', () => {
      const { dong, bo_qua } = lapBanChup(
        [K1, K2],
        [dk('hv', K1, ['g1']), dk('hv', K2, [])],
        PHAM_VI,
      );
      expect(dong[0]).toEqual(
        expect.objectContaining({ giai_doan: 'chi_gd1', ghi_chu: null }),
      );
      expect(bo_qua).toEqual({
        chua_phan_lop: 0,
        ngoai_pham_vi: [],
        trung_khoa: 0,
      });
    });
  });

  it('danh sách rỗng', () => {
    expect(lapBanChup([], [], PHAM_VI)).toEqual({
      dong: [],
      bo_qua: { chua_phan_lop: 0, ngoai_pham_vi: [], trung_khoa: 0 },
    });
  });

  it('9.000 ghi danh chạy nhanh', () => {
    const ds = Array.from({ length: 9000 }, (_, i) =>
      dk(`hv${i}`, K1, i % 3 === 0 ? ['g1'] : ['g1', 'g2']),
    );
    const bd = Date.now();
    const { dong } = lapBanChup([K1], ds, PHAM_VI);
    expect(dong).toHaveLength(9000);
    expect(Date.now() - bd).toBeLessThan(2000);
    expect(tongHopTheoTruong(dong).get('tA')).toEqual({
      so_dong: 9000,
      tong_suat: 7500,
    });
  });
});

describe('tongHopTheoTruong', () => {
  it('số dòng + tổng suất chính xác theo trường', () => {
    const m = tongHopTheoTruong([
      { don_vi_id: 'tA', ty_le_suat: 1 },
      { don_vi_id: 'tA', ty_le_suat: 0.5 },
      { don_vi_id: 'tB', ty_le_suat: 0.5 },
      { don_vi_id: 'tA', ty_le_suat: 0.5 },
    ]);
    expect(m.get('tA')).toEqual({ so_dong: 3, tong_suat: 2 });
    expect(m.get('tB')).toEqual({ so_dong: 1, tong_suat: 0.5 });
    expect(tongHopTheoTruong([]).size).toBe(0);
  });
});
