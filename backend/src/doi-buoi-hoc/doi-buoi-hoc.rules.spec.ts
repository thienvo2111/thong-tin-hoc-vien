import {
  HTTP_THEO_MA,
  LichTomTat,
  MaLoiDoiBuoi,
  chuanHoaLyDo,
  conChoChoDeNghi,
  daBatDau,
  kiemTraGui,
  laBuoiTuongDuong,
  quyetDinhDuyet,
  soLuotDaDung,
  thuTuHang,
  tinhSiSoBuoi,
} from './doi-buoi-hoc.rules';

const NOW = new Date('2026-10-20T08:00:00.000Z');
const NGAY = 24 * 60 * 60 * 1000;

type LichOver = Partial<Omit<LichTomTat, 'lop'>> & {
  lop?: Partial<LichTomTat['lop']>;
};

function lich(over: LichOver = {}): LichTomTat {
  const { lop, ...rest } = over;
  return {
    id: 'b1',
    lop_id: 'l1',
    giai_doan_id: 'G',
    buoi_so: 2,
    thoi_gian_bat_dau: new Date(NOW.getTime() + NGAY),
    ...rest,
    lop: {
      khoa_id: 'K',
      loai_lop: 'truc_tiep',
      muc_nang_luc: 'co_ban',
      trang_thai: 'active',
      si_so_toi_da: 30,
      ten_lop: 'Lớp A',
      ...lop,
    },
  };
}

const nguon = lich({ id: 'bn', lop_id: 'l1' });
const dich = lich({ id: 'bd', lop_id: 'l2' });

describe('laBuoiTuongDuong', () => {
  it.each<[string, LichTomTat, LichTomTat, boolean]>([
    ['cùng lớp', nguon, lich({ lop_id: 'l1' }), false],
    ['khác buoi_so', nguon, lich({ lop_id: 'l2', buoi_so: 3 }), false],
    [
      'khác giai_doan_id',
      nguon,
      lich({ lop_id: 'l2', giai_doan_id: 'H' }),
      false,
    ],
    [
      'khác khoa_id',
      nguon,
      lich({ lop_id: 'l2', lop: { khoa_id: 'K2' } }),
      false,
    ],
    [
      'khác loai_lop',
      nguon,
      lich({ lop_id: 'l2', lop: { loai_lop: 'zoom' } }),
      false,
    ],
    [
      'khác muc_nang_luc',
      nguon,
      lich({ lop_id: 'l2', lop: { muc_nang_luc: 'nang_cao' } }),
      false,
    ],
    [
      'null và null',
      lich({ lop: { muc_nang_luc: null } }),
      lich({ lop_id: 'l2', lop: { muc_nang_luc: null } }),
      true,
    ],
    [
      'nguồn null, đích co_ban',
      lich({ lop: { muc_nang_luc: null } }),
      lich({ lop_id: 'l2' }),
      false,
    ],
    [
      'đích ngưng',
      nguon,
      lich({ lop_id: 'l2', lop: { trang_thai: 'ngung' } }),
      false,
    ],
    ['hợp lệ', nguon, dich, true],
  ])('%s', (_ten, n, d, kq) => {
    expect(laBuoiTuongDuong(n, d)).toBe(kq);
  });
});

describe('daBatDau', () => {
  it.each<[string, number, boolean]>([
    ['now - 1ms', -1, true],
    ['đúng now', 0, true],
    ['now + 1 phút', 60_000, false],
  ])('%s', (_ten, lech, kq) => {
    expect(
      daBatDau({ thoi_gian_bat_dau: new Date(NOW.getTime() + lech) }, NOW),
    ).toBe(kq);
  });
});

describe('tinhSiSoBuoi', () => {
  it('phân lớp - đổi ra + đổi vào', () => {
    expect(tinhSiSoBuoi({ so_phan_lop: 28, so_doi_ra: 2, so_doi_vao: 3 })).toBe(
      29,
    );
  });
});

describe('conChoChoDeNghi', () => {
  it.each([
    [{ si_so: 28, si_so_toi_da: 30, so_truoc: 1 }, true],
    [{ si_so: 29, si_so_toi_da: 30, so_truoc: 1 }, false],
    [{ si_so: 30, si_so_toi_da: 30, so_truoc: 0 }, false],
    [{ si_so: 100, si_so_toi_da: null, so_truoc: 50 }, true],
  ])('%j', (x, kq) => {
    expect(conChoChoDeNghi(x)).toBe(kq);
  });
});

describe('soLuotDaDung', () => {
  it('chỉ đếm chờ duyệt + đã duyệt', () => {
    expect(
      soLuotDaDung([
        { trang_thai: 'cho_duyet', lich_nguon_id: 'n1' },
        { trang_thai: 'da_duyet', lich_nguon_id: 'n2' },
        { trang_thai: 'tu_choi', lich_nguon_id: 'n3' },
        { trang_thai: 'da_huy', lich_nguon_id: 'n4' },
      ]),
    ).toBe(2);
  });

  it('đổi lại (đã duyệt + chờ cùng buổi nguồn) = 1 lượt', () => {
    expect(
      soLuotDaDung([
        { trang_thai: 'da_duyet', lich_nguon_id: 'n1' },
        { trang_thai: 'cho_duyet', lich_nguon_id: 'n1' },
        { trang_thai: 'da_huy', lich_nguon_id: 'n1' },
      ]),
    ).toBe(1);
  });

  it('rỗng → 0', () => {
    expect(soLuotDaDung([])).toBe(0);
  });
});

describe('chuanHoaLyDo', () => {
  it.each<[string | undefined, string | null]>([
    ['  abcd ', null],
    ['a'.repeat(501), null],
    [undefined, null],
    [' Bận họp ', 'Bận họp'],
    ['a'.repeat(500), 'a'.repeat(500)],
  ])('%s', (s, kq) => {
    expect(chuanHoaLyDo(s)).toBe(kq);
  });

  it('chuẩn hóa NFC', () => {
    expect(chuanHoaLyDo('Bận họp'.normalize('NFD'))).toBe(
      'Bận họp'.normalize('NFC'),
    );
  });
});

describe('kiemTraGui', () => {
  const base = {
    so_buoi_doi_toi_da: 2,
    so_luot_da_dung: 0,
    buoi_nguon: nguon,
    buoi_dich: dich,
    lop_phan_hien_tai: 'l1' as string | null,
    si_so_dich: 10,
    ly_do: 'Bận họp đột xuất' as string | undefined,
  };

  it.each<[MaLoiDoiBuoi, Partial<typeof base>, string]>([
    [
      'KHOA_TAT',
      { so_buoi_doi_toi_da: 0 },
      'Khóa học chưa mở đề nghị đổi buổi',
    ],
    [
      'HET_LUOT',
      { so_luot_da_dung: 2 },
      'Bạn đã dùng hết 2 lượt đổi buổi của khóa',
    ],
    [
      'KHONG_THUOC_LOP',
      { lop_phan_hien_tai: 'lx' },
      'Buổi này không thuộc lớp của bạn',
    ],
    [
      'KHONG_TUONG_DUONG',
      { buoi_dich: lich({ lop_id: 'l2', buoi_so: 5 }) },
      'Buổi chọn không tương đương với buổi của bạn',
    ],
    [
      'DA_BAT_DAU',
      { buoi_nguon: lich({ lop_id: 'l1', thoi_gian_bat_dau: NOW }) },
      'Buổi đã bắt đầu, không thể đổi',
    ],
    [
      'DA_BAT_DAU',
      {
        buoi_dich: lich({
          lop_id: 'l2',
          thoi_gian_bat_dau: new Date(NOW.getTime() - 1),
        }),
      },
      'Buổi đã bắt đầu, không thể đổi',
    ],
    ['BUOI_DAY', { si_so_dich: 30 }, 'Buổi đã đủ sĩ số, hãy chọn buổi khác'],
    ['LY_DO', { ly_do: 'abc' }, 'Lý do phải từ 5 đến 500 ký tự'],
  ])('%s', (ma, over, thong_diep) => {
    expect(kiemTraGui({ ...base, ...over }, NOW)).toEqual({
      ok: false,
      ma,
      thong_diep,
    });
  });

  it('thứ tự kiểm: KHOA_TAT thắng HET_LUOT', () => {
    const kq = kiemTraGui(
      { ...base, so_buoi_doi_toi_da: 0, so_luot_da_dung: 5 },
      NOW,
    );
    expect(kq).toMatchObject({ ok: false, ma: 'KHOA_TAT' });
  });

  it('đích không giới hạn sĩ số thì không BUOI_DAY', () => {
    const d = lich({ lop_id: 'l2', lop: { si_so_toi_da: null } });
    expect(kiemTraGui({ ...base, buoi_dich: d, si_so_dich: 999 }, NOW)).toEqual(
      { ok: true },
    );
  });

  it('hợp lệ', () => {
    expect(kiemTraGui(base, NOW)).toEqual({ ok: true });
  });

  describe('đổi lại (đã có bản đã duyệt)', () => {
    const chotCu = lich({ id: 'bc', lop_id: 'l3' });

    it('buổi đích trùng buổi chốt hiện tại → TRUNG_BUOI_CHOT (400)', () => {
      expect(
        kiemTraGui(
          { ...base, buoi_dich: chotCu, buoi_chot_hien_tai: chotCu },
          NOW,
        ),
      ).toEqual({
        ok: false,
        ma: 'TRUNG_BUOI_CHOT',
        thong_diep: 'Thầy/Cô đang học buổi này rồi',
      });
      expect(HTTP_THEO_MA.TRUNG_BUOI_CHOT).toBe(400);
    });

    it('buổi chốt hiện tại đã bắt đầu → DA_BAT_DAU', () => {
      const daQua = lich({
        id: 'bc',
        lop_id: 'l3',
        thoi_gian_bat_dau: new Date(NOW.getTime() - 1),
      });
      expect(
        kiemTraGui({ ...base, buoi_chot_hien_tai: daQua }, NOW),
      ).toMatchObject({ ok: false, ma: 'DA_BAT_DAU' });
    });

    it('buổi đích khác buổi chốt, chưa bắt đầu → hợp lệ', () => {
      expect(kiemTraGui({ ...base, buoi_chot_hien_tai: chotCu }, NOW)).toEqual({
        ok: true,
      });
    });

    it('null → như đề nghị thường', () => {
      expect(kiemTraGui({ ...base, buoi_chot_hien_tai: null }, NOW)).toEqual({
        ok: true,
      });
    });
  });
});

describe('quyetDinhDuyet', () => {
  const base = {
    vai_tro: 'ho_tro_hoc_vien' as 'quan_tri' | 'ho_tro_hoc_vien',
    trang_thai: 'cho_duyet' as const,
    buoi_nguon: nguon,
    buoi_chot: dich,
    lop_phan_hien_tai: 'l1' as string | null,
    si_so: 10,
    so_truoc: 0,
  };

  it.each<[MaLoiDoiBuoi, Record<string, unknown>]>([
    ['DA_XU_LY', { trang_thai: 'da_duyet' }],
    [
      'DA_BAT_DAU',
      { buoi_nguon: lich({ lop_id: 'l1', thoi_gian_bat_dau: NOW }) },
    ],
    [
      'DA_BAT_DAU',
      { buoi_chot: lich({ lop_id: 'l2', thoi_gian_bat_dau: NOW }) },
    ],
    ['KHONG_TUONG_DUONG', { buoi_chot: lich({ lop_id: 'l2', buoi_so: 5 }) }],
    [
      'KHONG_TUONG_DUONG',
      { buoi_chot: lich({ lop_id: 'l2', lop: { trang_thai: 'ngung' } }) },
    ],
    ['PHAN_LOP_DOI', { lop_phan_hien_tai: 'lx' }],
    ['PHAN_LOP_DOI', { lop_phan_hien_tai: null }],
  ])('chặn %s', (ma, over) => {
    const kq = quyetDinhDuyet({ ...base, ...over } as typeof base, NOW);
    expect(kq.ket_qua).toBe('chan');
    expect(kq.ma).toBe(ma);
    expect(kq.thong_diep).toBeTruthy();
  });

  it('thông điệp cố định của mã đơn giản', () => {
    expect(
      quyetDinhDuyet({ ...base, trang_thai: 'tu_choi' } as never, NOW)
        .thong_diep,
    ).toBe('Đề nghị đã được xử lý');
    expect(
      quyetDinhDuyet({ ...base, lop_phan_hien_tai: 'lx' }, NOW).thong_diep,
    ).toBe('Phân lớp của học viên đã thay đổi — hãy từ chối');
  });

  it('hỗ trợ: đầy sĩ số -> BUOI_DAY', () => {
    expect(quyetDinhDuyet({ ...base, si_so: 30, so_truoc: 0 }, NOW)).toEqual({
      ket_qua: 'chan',
      ma: 'BUOI_DAY',
      thong_diep: 'Buổi đã đủ sĩ số 30/30 — chọn buổi khác',
      canh_bao: [],
    });
  });

  it('hỗ trợ: còn 1 chỗ nhưng có 1 đề nghị trước -> GIU_CHO', () => {
    expect(quyetDinhDuyet({ ...base, si_so: 29, so_truoc: 1 }, NOW)).toEqual({
      ket_qua: 'chan',
      ma: 'GIU_CHO',
      thong_diep:
        'Còn 1 chỗ, có 1 đề nghị gửi trước đang chờ — cần xử lý trước',
      canh_bao: [],
    });
  });

  it('quản trị: đầy sĩ số -> duyệt kèm 1 cảnh báo', () => {
    const kq = quyetDinhDuyet(
      { ...base, vai_tro: 'quan_tri', si_so: 30, so_truoc: 0 },
      NOW,
    );
    expect(kq).toEqual({ ket_qua: 'duyet', canh_bao: ['Vượt sĩ số 31/30'] });
  });

  it('quản trị: vượt thứ tự -> duyệt kèm 1 cảnh báo', () => {
    const kq = quyetDinhDuyet(
      { ...base, vai_tro: 'quan_tri', si_so: 29, so_truoc: 1 },
      NOW,
    );
    expect(kq).toEqual({
      ket_qua: 'duyet',
      canh_bao: ['Vượt thứ tự: 1 đề nghị gửi trước đang chờ'],
    });
  });

  it('hỗ trợ: sĩ số không giới hạn -> duyệt', () => {
    const chot = lich({ lop_id: 'l2', lop: { si_so_toi_da: null } });
    expect(
      quyetDinhDuyet({ ...base, buoi_chot: chot, si_so: 99, so_truoc: 5 }, NOW),
    ).toEqual({
      ket_qua: 'duyet',
      canh_bao: [],
    });
  });

  it('hợp lệ', () => {
    expect(quyetDinhDuyet(base, NOW)).toEqual({
      ket_qua: 'duyet',
      canh_bao: [],
    });
    expect(quyetDinhDuyet({ ...base, vai_tro: 'quan_tri' }, NOW)).toEqual({
      ket_qua: 'duyet',
      canh_bao: [],
    });
  });
});

describe('thuTuHang', () => {
  const t = (n: number) => new Date(NOW.getTime() + n * 1000);
  const ds = [
    { id: 'a', tao_luc: t(1) },
    { id: 'b', tao_luc: t(2) },
    { id: 'c', tao_luc: t(3) },
  ];

  it('đề nghị thứ 2 trong 3', () => {
    expect(thuTuHang(ds[1], ds)).toEqual({ k: 2, n: 3 });
  });

  it('không phụ thuộc thứ tự mảng', () => {
    expect(thuTuHang(ds[2], [ds[2], ds[0], ds[1]])).toEqual({ k: 3, n: 3 });
  });
});

describe('HTTP_THEO_MA', () => {
  it.each<[MaLoiDoiBuoi, number]>([
    ['KHOA_TAT', 403],
    ['DA_XU_LY', 409],
    ['PHAN_LOP_DOI', 409],
    ['BUOI_DAY', 409],
    ['GIU_CHO', 409],
    ['HET_LUOT', 400],
    ['KHONG_THUOC_LOP', 400],
    ['KHONG_TUONG_DUONG', 400],
    ['DA_BAT_DAU', 400],
    ['LY_DO', 400],
  ])('%s -> %i', (ma, http) => {
    expect(HTTP_THEO_MA[ma]).toBe(http);
  });
});
