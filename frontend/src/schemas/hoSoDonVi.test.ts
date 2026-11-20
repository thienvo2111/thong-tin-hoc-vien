import { describe, expect, it } from 'vitest';
import { hoSoDonViSchema, hoSoFormTrong } from './hoSoDonVi';

// Issue #63: schema form chỉ chặn sai định dạng; ô bắt buộc trống vẫn qua (lưu nháp, X4).
describe('hoSoDonViSchema', () => {
  it('form trống hợp lệ (nháp)', () => {
    expect(hoSoDonViSchema.safeParse(hoSoFormTrong()).success).toBe(true);
  });

  it('báo lỗi đúng ô theo quy tắc dùng chung; SĐT có dấu cách vẫn hợp lệ', () => {
    const kq = hoSoDonViSchema.safeParse({
      ...hoSoFormTrong(),
      ma_so_thue: '123',
      ma_qhns: '12345',
      sdt_dai_dien: '0900 000 001',
      kt_sdt: '1900000002',
      email_hoa_don: 'sai',
    });
    expect(kq.success).toBe(false);
    const loi = Object.fromEntries((kq.error?.issues ?? []).map((i) => [i.path[0], i.message]));
    expect(loi).toEqual({
      ma_so_thue: 'Mã số thuế gồm 10 số, hoặc dạng 0123456789-001',
      ma_qhns: 'Mã QHNS gồm đúng 7 chữ số',
      kt_sdt: 'SĐT gồm 10 số, bắt đầu bằng 0',
      email_hoa_don: 'Email không hợp lệ',
    });
  });
});
