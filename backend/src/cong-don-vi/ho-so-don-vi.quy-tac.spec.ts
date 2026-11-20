import {
  DON_VI_TIEP_NHAN,
  HoSoDonViDuLieu,
  LOI_EMAIL,
  LOI_KIEU,
  LOI_MST,
  LOI_QHNS,
  LOI_SDT,
  LOI_TRUONG_LA,
  NGAN_HANG_TIEP_NHAN,
  NHOM_HO_SO,
  TEN_TRUONG_HO_SO,
  TRUONG_HO_SO,
  chuanHoaHoSo,
  docDauVaoHoSo,
  kiemTraHoSo,
  stkChuyenKhoan,
  tinhTrangHoSo,
  truongThayDoi,
} from './ho-so-don-vi.quy-tac';

// Dữ liệu bịa hoàn toàn — không phải thông tin thật của trường/người nào.
const HO_SO_DU: HoSoDonViDuLieu = {
  ten_truong: 'Trường THCS Mẫu Thử',
  dia_chi: 'Ấp 1, xã Mẫu Thử, tỉnh Thử Nghiệm',
  ma_so_thue: '0000000001',
  nguoi_dai_dien: 'Người Đại Diện Giả',
  sdt_dai_dien: '0900000001',
  email_hoa_don: 'ketoan@mau-thu.test',
  so_tai_khoan: '0000111122223333',
  ngan_hang: 'Ngân hàng Giả',
  chi_nhanh: 'Chi nhánh Giả',
  kho_bac: 'Kho bạc Giả',
  mst_kho_bac: '0000000001-001',
  ma_qhns: '1234567',
  ma_nguon: '13',
  ht_ho_ten: 'Hiệu Trưởng Giả',
  ht_so_tai_khoan: '1111222233334444',
  ht_ngan_hang: 'Ngân hàng Giả – CN Thử',
  kt_ho_ten: 'Kế Toán Giả',
  kt_sdt: '0900000002',
  kt_so_tai_khoan: '5555666677778888',
  kt_ngan_hang: 'Ngân hàng Giả – CN Thử',
  dau_moi_csvc: null,
  muc_dap_ung_csvc: null,
  luu_tru: null,
  di_chuyen: null,
};

const BAT_BUOC = TRUONG_HO_SO.filter((t) => t.bat_buoc).map((t) => t.ma);

describe('TRUONG_HO_SO', () => {
  it('có đủ 24 trường, tên duy nhất, đúng tên cột DB', () => {
    expect(TEN_TRUONG_HO_SO).toHaveLength(24);
    expect(new Set(TEN_TRUONG_HO_SO).size).toBe(24);
    expect(Object.keys(HO_SO_DU).sort()).toEqual([...TEN_TRUONG_HO_SO].sort());
  });

  it('Phần 1, 2, 5 bắt buộc; 4 trường hậu cần không bắt buộc', () => {
    expect(BAT_BUOC).toHaveLength(20);
    const hauCan = TRUONG_HO_SO.filter((t) => t.nhom === 'hau_can');
    expect(hauCan.map((t) => t.ma)).toEqual([
      'dau_moi_csvc',
      'muc_dap_ung_csvc',
      'luu_tru',
      'di_chuyen',
    ]);
    expect(hauCan.every((t) => !t.bat_buoc)).toBe(true);
  });

  it('text tối đa 255, textarea tối đa 2000; mỗi trường thuộc 1 nhóm đã khai', () => {
    const maNhom = NHOM_HO_SO.map((n) => n.ma);
    for (const t of TRUONG_HO_SO) {
      expect(t.toi_da).toBe(t.kieu === 'textarea' ? 2000 : 255);
      expect(maNhom).toContain(t.nhom);
      expect(t.nhan.length).toBeGreaterThan(0);
    }
  });
});

describe('chuanHoaHoSo', () => {
  it('trim, chuỗi rỗng/chỉ khoảng trắng → null, khóa vắng → null', () => {
    const kq = chuanHoaHoSo({ ten_truong: '  Trường A  ', dia_chi: '   ' });
    expect(kq.ten_truong).toBe('Trường A');
    expect(kq.dia_chi).toBeNull();
    expect(kq.ma_qhns).toBeNull();
    expect(Object.keys(kq)).toHaveLength(24);
  });

  it('SĐT bỏ dấu cách và dấu chấm', () => {
    const kq = chuanHoaHoSo({
      sdt_dai_dien: ' 090 000.0001 ',
      kt_sdt: '0900.000.002',
    });
    expect(kq.sdt_dai_dien).toBe('0900000001');
    expect(kq.kt_sdt).toBe('0900000002');
  });

  it('chỉ SĐT bị bỏ dấu cách — trường khác giữ khoảng trắng bên trong', () => {
    expect(chuanHoaHoSo({ dia_chi: ' Ấp 1  xã A ' }).dia_chi).toBe(
      'Ấp 1  xã A',
    );
  });

  it('MST / QHNS chỉ trim', () => {
    const kq = chuanHoaHoSo({
      ma_so_thue: ' 0000000001 ',
      ma_qhns: ' 1234567',
    });
    expect(kq.ma_so_thue).toBe('0000000001');
    expect(kq.ma_qhns).toBe('1234567');
  });

  it('null / undefined → null', () => {
    const kq = chuanHoaHoSo({ ten_truong: null, dia_chi: undefined });
    expect(kq.ten_truong).toBeNull();
    expect(kq.dia_chi).toBeNull();
  });

  it('chuẩn hóa NFC tiếng Việt', () => {
    const nfd = 'Trường'.normalize('NFD');
    expect(chuanHoaHoSo({ ten_truong: nfd }).ten_truong).toBe(
      'Trường'.normalize('NFC'),
    );
  });
});

describe('kiemTraHoSo', () => {
  it('hồ sơ hợp lệ → không lỗi', () => {
    expect(kiemTraHoSo(HO_SO_DU).loi).toEqual({});
  });

  it('ô trống không báo lỗi (cho lưu nháp)', () => {
    expect(kiemTraHoSo({}).loi).toEqual({});
    expect(kiemTraHoSo(chuanHoaHoSo({})).loi).toEqual({});
  });

  it.each(['0000000001', '0123456789-001'])('MST hợp lệ: %s', (v) => {
    expect(kiemTraHoSo({ ma_so_thue: v, mst_kho_bac: v }).loi).toEqual({});
  });

  it.each([
    '012345678',
    '01234567890',
    '0123456789-01',
    '0123456789-0001',
    '0123456789001',
    'abcdefghij',
    '0123456789 -001',
  ])('MST sai: %s', (v) => {
    expect(kiemTraHoSo({ ma_so_thue: v, mst_kho_bac: v }).loi).toEqual({
      ma_so_thue: LOI_MST,
      mst_kho_bac: LOI_MST,
    });
  });

  it.each(['123456', '12345678', '12345a7', 'abcdefg', '123 456'])(
    'QHNS sai: %s',
    (v) => {
      expect(kiemTraHoSo({ ma_qhns: v }).loi).toEqual({ ma_qhns: LOI_QHNS });
    },
  );

  it('QHNS 7 số hợp lệ (kể cả bắt đầu bằng 0)', () => {
    expect(kiemTraHoSo({ ma_qhns: '0012345' }).loi).toEqual({});
  });

  it.each([
    '1900000001',
    '090000000',
    '09000000011',
    '09000000ab',
    '+84900000001',
  ])('SĐT sai: %s', (v) => {
    expect(kiemTraHoSo({ sdt_dai_dien: v, kt_sdt: v }).loi).toEqual({
      sdt_dai_dien: LOI_SDT,
      kt_sdt: LOI_SDT,
    });
  });

  it.each(['khong-email', 'a@b', '@mau.test', 'a b@mau.test', 'a@@mau.test'])(
    'email sai: %s',
    (v) => {
      expect(kiemTraHoSo({ email_hoa_don: v }).loi).toEqual({
        email_hoa_don: LOI_EMAIL,
      });
    },
  );

  it('độ dài: text 255 được, 256 lỗi; textarea 2000 được, 2001 lỗi', () => {
    expect(
      kiemTraHoSo({ dia_chi: 'a'.repeat(255), luu_tru: 'b'.repeat(2000) }).loi,
    ).toEqual({});
    expect(
      kiemTraHoSo({ dia_chi: 'a'.repeat(256), luu_tru: 'b'.repeat(2001) }).loi,
    ).toEqual({ dia_chi: 'Tối đa 255 ký tự', luu_tru: 'Tối đa 2000 ký tự' });
  });

  it('quá dài báo lỗi độ dài trước lỗi định dạng', () => {
    expect(kiemTraHoSo({ ma_qhns: '1'.repeat(300) }).loi).toEqual({
      ma_qhns: 'Tối đa 255 ký tự',
    });
  });
});

describe('tinhTrangHoSo', () => {
  it('null (chưa khai) → thiếu mọi trường bắt buộc', () => {
    expect(tinhTrangHoSo(null)).toEqual({ du: false, thieu: BAT_BUOC });
  });

  it('đủ mọi trường bắt buộc, hậu cần trống → đủ', () => {
    expect(tinhTrangHoSo(HO_SO_DU)).toEqual({ du: true, thieu: [] });
  });

  it('chỉ Phần 1 → thiếu Phần 2 và 5, theo thứ tự form', () => {
    const phan1 = chuanHoaHoSo({
      ten_truong: 'A',
      dia_chi: 'B',
      ma_so_thue: '0000000001',
      nguoi_dai_dien: 'C',
      sdt_dai_dien: '0900000001',
      email_hoa_don: 'a@mau.test',
    });
    const { du, thieu } = tinhTrangHoSo(phan1);
    expect(du).toBe(false);
    expect(thieu).toEqual(BAT_BUOC.slice(6));
  });

  it('ô bắt buộc chỉ có khoảng trắng tính là thiếu', () => {
    const { du, thieu } = tinhTrangHoSo({ ...HO_SO_DU, ma_nguon: '  ' });
    expect(du).toBe(false);
    expect(thieu).toEqual(['ma_nguon']);
  });

  it('đủ ô nhưng sai định dạng → chưa đủ, ô sai nằm trong thieu', () => {
    const { du, thieu } = tinhTrangHoSo({ ...HO_SO_DU, ma_qhns: '123' });
    expect(du).toBe(false);
    expect(thieu).toEqual(['ma_qhns']);
  });

  it('ô hậu cần sai độ dài cũng làm chưa đủ', () => {
    const { du, thieu } = tinhTrangHoSo({
      ...HO_SO_DU,
      luu_tru: 'x'.repeat(2001),
    });
    expect(du).toBe(false);
    expect(thieu).toEqual(['luu_tru']);
  });
});

describe('stkChuyenKhoan (U2)', () => {
  it('7 số → HCMUE + QHNS', () => {
    expect(stkChuyenKhoan('1234567')).toBe('HCMUE1234567');
    expect(stkChuyenKhoan(' 0012345 ')).toBe('HCMUE0012345');
  });

  it.each([
    null,
    undefined,
    '',
    '123456',
    '12345678',
    '12a4567',
    'HCMUE1234567',
  ])('không đủ/không hợp lệ → null: %s', (v) => {
    expect(stkChuyenKhoan(v)).toBeNull();
  });

  it('hằng đơn vị tiếp nhận + ngân hàng', () => {
    expect(DON_VI_TIEP_NHAN).toBe(
      'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
    );
    expect(NGAN_HANG_TIEP_NHAN).toBe(
      'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)',
    );
  });
});

describe('docDauVaoHoSo', () => {
  it('nhận chuỗi / null / thiếu khóa', () => {
    const { duLieu, loi } = docDauVaoHoSo({ ten_truong: 'A', dia_chi: null });
    expect(loi).toEqual({});
    expect(duLieu).toEqual({ ten_truong: 'A', dia_chi: null });
  });

  it('khóa lạ → lỗi theo đúng tên khóa', () => {
    const { loi } = docDauVaoHoSo({ ten_truong: 'A', stk_chuyen_khoan: 'x' });
    expect(loi).toEqual({ stk_chuyen_khoan: LOI_TRUONG_LA });
  });

  it('giá trị không phải chuỗi → lỗi kiểu', () => {
    const { loi } = docDauVaoHoSo({ ma_qhns: 1234567, ten_truong: ['A'] });
    expect(loi).toEqual({ ma_qhns: LOI_KIEU, ten_truong: LOI_KIEU });
  });

  it.each([null, 'chuoi', 5, [1, 2]])('thân không phải đối tượng: %p', (b) => {
    expect(Object.keys(docDauVaoHoSo(b).loi)).toEqual(['body']);
  });

  it('đối tượng rỗng hợp lệ', () => {
    expect(docDauVaoHoSo({})).toEqual({ duLieu: {}, loi: {} });
  });
});

describe('truongThayDoi', () => {
  it('chưa có hồ sơ → mọi ô có giá trị là thay đổi', () => {
    expect(truongThayDoi(null, chuanHoaHoSo({ ten_truong: 'A' }))).toEqual([
      'ten_truong',
    ]);
  });

  it('chưa có hồ sơ + bản toàn null → không thay đổi', () => {
    expect(truongThayDoi(null, chuanHoaHoSo({}))).toEqual([]);
  });

  it('chỉ liệt kê tên trường thay đổi, không giá trị', () => {
    const moi = { ...HO_SO_DU, so_tai_khoan: '9999', kt_sdt: null };
    expect(truongThayDoi(HO_SO_DU, moi)).toEqual(['so_tai_khoan', 'kt_sdt']);
  });

  it('giống hệt → rỗng', () => {
    expect(truongThayDoi(HO_SO_DU, { ...HO_SO_DU })).toEqual([]);
  });
});
