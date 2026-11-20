import { describe, expect, it } from 'vitest';
import {
  DON_VI_TIEP_NHAN,
  LOI_EMAIL,
  LOI_MST,
  LOI_QHNS,
  LOI_SDT,
  NGAN_HANG_TIEP_NHAN,
  NHAN_TRUONG_HO_SO,
  TEN_TRUONG_HO_SO,
  TRUONG_HO_SO,
  cheStk,
  chuanHoaHoSo,
  kiemTraHoSo,
  stkChuyenKhoan,
  tinhTrangHoSo,
} from './hoSoDonVi';
import { hoSoMau } from '@/test/mocks/hoSoDonVi';

// Issue #63: cùng bộ ca với backend/src/cong-don-vi/ho-so-don-vi.quy-tac.spec.ts — 2 bên phải khớp.
const BAT_BUOC = TRUONG_HO_SO.filter((t) => t.bat_buoc).map((t) => t.ma);

describe('bộ trường hồ sơ', () => {
  it('24 trường đúng tên cột backend, 20 bắt buộc, 4 hậu cần không bắt buộc', () => {
    expect(TEN_TRUONG_HO_SO).toEqual([
      'ten_truong',
      'dia_chi',
      'ma_so_thue',
      'nguoi_dai_dien',
      'sdt_dai_dien',
      'email_hoa_don',
      'so_tai_khoan',
      'ngan_hang',
      'chi_nhanh',
      'kho_bac',
      'mst_kho_bac',
      'ma_qhns',
      'ma_nguon',
      'ht_ho_ten',
      'ht_so_tai_khoan',
      'ht_ngan_hang',
      'kt_ho_ten',
      'kt_sdt',
      'kt_so_tai_khoan',
      'kt_ngan_hang',
      'dau_moi_csvc',
      'muc_dap_ung_csvc',
      'luu_tru',
      'di_chuyen',
    ]);
    expect(BAT_BUOC).toHaveLength(20);
    expect(TRUONG_HO_SO.filter((t) => t.nhom === 'hau_can').every((t) => !t.bat_buoc)).toBe(true);
    expect(NHAN_TRUONG_HO_SO.ma_qhns).toBe('Mã QHNS');
  });
});

describe('chuanHoaHoSo', () => {
  it("trim, '' → null, khóa vắng → null, SĐT bỏ dấu cách/chấm", () => {
    const kq = chuanHoaHoSo({
      ten_truong: '  A  ',
      dia_chi: '  ',
      sdt_dai_dien: '090 000.0001',
      kt_sdt: ' 0900.000.002 ',
    });
    expect(kq.ten_truong).toBe('A');
    expect(kq.dia_chi).toBeNull();
    expect(kq.ma_qhns).toBeNull();
    expect(kq.sdt_dai_dien).toBe('0900000001');
    expect(kq.kt_sdt).toBe('0900000002');
    expect(Object.keys(kq)).toHaveLength(24);
  });
});

describe('kiemTraHoSo', () => {
  it('ô trống không lỗi (lưu nháp); hồ sơ mẫu hợp lệ', () => {
    expect(kiemTraHoSo({}).loi).toEqual({});
    expect(kiemTraHoSo(hoSoMau()).loi).toEqual({});
  });

  it.each(['0000000001', '0123456789-001'])('MST hợp lệ %s', (v) => {
    expect(kiemTraHoSo({ ma_so_thue: v, mst_kho_bac: v }).loi).toEqual({});
  });

  it.each(['012345678', '0123456789-01', '01234567890', 'abcdefghij'])('MST sai %s', (v) => {
    expect(kiemTraHoSo({ ma_so_thue: v, mst_kho_bac: v }).loi).toEqual({ ma_so_thue: LOI_MST, mst_kho_bac: LOI_MST });
  });

  it.each(['123456', '12345678', '12345a7'])('QHNS sai %s', (v) => {
    expect(kiemTraHoSo({ ma_qhns: v }).loi).toEqual({ ma_qhns: LOI_QHNS });
  });

  it.each(['1900000001', '090000000', '+84900000001'])('SĐT sai %s', (v) => {
    expect(kiemTraHoSo({ sdt_dai_dien: v, kt_sdt: v }).loi).toEqual({ sdt_dai_dien: LOI_SDT, kt_sdt: LOI_SDT });
  });

  it.each(['khong-email', 'a@b', 'a b@mau.test'])('email sai %s', (v) => {
    expect(kiemTraHoSo({ email_hoa_don: v }).loi).toEqual({ email_hoa_don: LOI_EMAIL });
  });

  it('độ dài: text 255/256, textarea 2000/2001', () => {
    expect(kiemTraHoSo({ dia_chi: 'a'.repeat(255), luu_tru: 'b'.repeat(2000) }).loi).toEqual({});
    expect(kiemTraHoSo({ dia_chi: 'a'.repeat(256), luu_tru: 'b'.repeat(2001) }).loi).toEqual({
      dia_chi: 'Tối đa 255 ký tự',
      luu_tru: 'Tối đa 2000 ký tự',
    });
  });

  it('thông điệp khớp backend', () => {
    expect([LOI_MST, LOI_QHNS, LOI_SDT, LOI_EMAIL]).toEqual([
      'Mã số thuế gồm 10 số, hoặc dạng 0123456789-001',
      'Mã QHNS gồm đúng 7 chữ số',
      'SĐT gồm 10 số, bắt đầu bằng 0',
      'Email không hợp lệ',
    ]);
  });
});

describe('tinhTrangHoSo', () => {
  it('null → thiếu mọi trường bắt buộc; mẫu đủ → đủ', () => {
    expect(tinhTrangHoSo(null)).toEqual({ du: false, thieu: BAT_BUOC });
    expect(tinhTrangHoSo(hoSoMau())).toEqual({ du: true, thieu: [] });
  });

  it('sai định dạng tính là thiếu', () => {
    expect(tinhTrangHoSo(hoSoMau({ ma_qhns: '123' }))).toEqual({ du: false, thieu: ['ma_qhns'] });
  });
});

describe('stkChuyenKhoan + cheStk', () => {
  it('7 số → HCMUE + QHNS; khác → null', () => {
    expect(stkChuyenKhoan('1234567')).toBe('HCMUE1234567');
    expect(stkChuyenKhoan(' 0012345 ')).toBe('HCMUE0012345');
    for (const v of [null, undefined, '', '123456', '12345678', '12a4567']) expect(stkChuyenKhoan(v)).toBeNull();
    expect(DON_VI_TIEP_NHAN).toBe('Trường Đại học Sư phạm Thành phố Hồ Chí Minh');
    expect(NGAN_HANG_TIEP_NHAN).toBe('Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)');
  });

  it('che STK còn 4 số cuối', () => {
    expect(cheStk('9999888877776666')).toBe('••••••••6666');
    expect(cheStk('123456')).toBe('••3456');
    expect(cheStk('1234')).toBe('1234');
    expect(cheStk(null)).toBeNull();
  });
});
