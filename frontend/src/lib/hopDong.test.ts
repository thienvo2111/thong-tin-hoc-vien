import { describe, expect, it } from 'vitest';
import { NGUONG_PHAN_4, canPhan4, chuanHoaNhapHopDong, kiemTraPhan3 } from './hopDong';

// Issue #64 / ADR 0015 S5, X4: bản sao quy tắc backend — cùng ngưỡng, cùng thông điệp.
describe('canPhan4 (S5)', () => {
  it('ngưỡng 50.000.000', () => {
    expect(NGUONG_PHAN_4).toBe(50_000_000);
  });
  it('50.000.000 → cần Phần 4; 49.999.999 → không; chưa có giá trị → không', () => {
    expect(canPhan4(50_000_000)).toBe(true);
    expect(canPhan4(49_999_999)).toBe(false);
    expect(canPhan4(null)).toBe(false);
  });
});

describe('chuanHoaNhapHopDong', () => {
  it('trim, trống → null, SĐT bỏ dấu cách/chấm, khóa vắng → null/false', () => {
    expect(chuanHoaNhapHopDong({ nguoi_nhan: '  Người Bịa ', sdt_nguoi_nhan: '0900 000.009', ghi_chu: '  ' })).toEqual({
      nguoi_nhan: 'Người Bịa',
      sdt_nguoi_nhan: '0900000009',
      dia_chi_nhan: null,
      ghi_chu: null,
      so_qd: null,
      ngay_qd: null,
      diem_hoc_truc_tiep: false,
    });
  });
});

describe('kiemTraPhan3 (X4)', () => {
  it('trống hết → không lỗi (nháp được)', () => {
    expect(kiemTraPhan3({})).toEqual({ loi: {} });
  });
  it('SĐT sai → thông báo SĐT', () => {
    expect(kiemTraPhan3({ sdt_nguoi_nhan: '1900000000' }).loi).toEqual({
      sdt_nguoi_nhan: 'SĐT gồm 10 số, bắt đầu bằng 0',
    });
  });
  it('quá độ dài → lỗi; đúng biên → hợp lệ', () => {
    expect(
      kiemTraPhan3({ nguoi_nhan: 'a'.repeat(256), dia_chi_nhan: 'a'.repeat(2001), so_qd: 'a'.repeat(101) }).loi,
    ).toEqual({ nguoi_nhan: 'Tối đa 255 ký tự', dia_chi_nhan: 'Tối đa 2000 ký tự', so_qd: 'Tối đa 100 ký tự' });
    expect(
      kiemTraPhan3({ nguoi_nhan: 'a'.repeat(255), ghi_chu: 'a'.repeat(2000), so_qd: 'a'.repeat(100) }).loi,
    ).toEqual({});
  });
  it.each(['2026-02-30', '15/11/2026'])('ngày QĐ "%s" sai → lỗi', (ngay_qd) => {
    expect(kiemTraPhan3({ ngay_qd }).loi).toEqual({ ngay_qd: 'Ngày QĐ phải là ngày dạng YYYY-MM-DD' });
  });
  it('ngày QĐ hợp lệ → không lỗi', () => {
    expect(kiemTraPhan3({ ngay_qd: '2026-11-30' }).loi).toEqual({});
  });
});
