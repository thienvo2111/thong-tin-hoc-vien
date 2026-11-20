import { describe, expect, it } from 'vitest';
import { formSangNhap, hopDongSchema, type HopDongForm } from './hopDong';

const TRONG: HopDongForm = {
  nguoi_nhan: '',
  sdt_nguoi_nhan: '',
  dia_chi_nhan: '',
  ghi_chu: '',
  so_qd: '',
  ngay_qd: null,
  diem_hoc_truc_tiep: false,
};

describe('hopDongSchema (issue #64, X4)', () => {
  it('form trống → hợp lệ (lưu nháp được)', () => {
    expect(hopDongSchema.safeParse(TRONG).success).toBe(true);
  });

  it('SĐT sai → lỗi ở sdt_nguoi_nhan', () => {
    const kq = hopDongSchema.safeParse({ ...TRONG, sdt_nguoi_nhan: '12345' });
    expect(kq.success).toBe(false);
    expect(kq.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['sdt_nguoi_nhan', 'SĐT gồm 10 số, bắt đầu bằng 0'],
    ]);
  });

  it('số QĐ quá 100 ký tự → lỗi ở so_qd', () => {
    const kq = hopDongSchema.safeParse({ ...TRONG, so_qd: 'a'.repeat(101) });
    expect(kq.error?.issues[0].path).toEqual(['so_qd']);
  });
});

describe('formSangNhap', () => {
  it('ô trống → null, ngày giờ máy → YYYY-MM-DD, SĐT bỏ dấu cách', () => {
    expect(
      formSangNhap({
        ...TRONG,
        nguoi_nhan: ' Người Bịa ',
        sdt_nguoi_nhan: '0900 000 009',
        ngay_qd: new Date(2026, 10, 1),
        diem_hoc_truc_tiep: true,
      }),
    ).toEqual({
      nguoi_nhan: 'Người Bịa',
      sdt_nguoi_nhan: '0900000009',
      dia_chi_nhan: null,
      ghi_chu: null,
      so_qd: null,
      ngay_qd: '2026-11-01',
      diem_hoc_truc_tiep: true,
    });
  });
});
