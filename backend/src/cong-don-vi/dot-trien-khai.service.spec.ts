import { ValidationException } from '../common/exceptions/app.exceptions';
import {
  chuoiSangNgay,
  hanNopTuNgay,
  kiemTraKhoangQd,
  ngaySangChuoi,
  ngayVietNam,
} from './dot-trien-khai.service';

function loiCua(fn: () => void) {
  try {
    fn();
  } catch (e) {
    return e as ValidationException;
  }
  throw new Error('Không ném lỗi');
}

// ADR 0015 T1: hạn nộp tính đến 23:59:59 giờ Việt Nam (UTC+7) của ngày chọn.
describe('hanNopTuNgay', () => {
  it('ngày thường → 23:59:59 +07 (16:59:59Z cùng ngày)', () => {
    expect(hanNopTuNgay('2026-11-20').toISOString()).toBe(
      '2026-11-20T16:59:59.000Z',
    );
  });

  it('ngày cuối năm không lấn sang năm sau theo UTC', () => {
    expect(hanNopTuNgay('2026-12-31').toISOString()).toBe(
      '2026-12-31T16:59:59.000Z',
    );
  });

  it('ngày nhuận 29/02', () => {
    expect(hanNopTuNgay('2028-02-29').toISOString()).toBe(
      '2028-02-29T16:59:59.000Z',
    );
  });
});

describe('ngayVietNam', () => {
  it('đảo ngược hanNopTuNgay', () => {
    expect(ngayVietNam(hanNopTuNgay('2026-12-31'))).toBe('2026-12-31');
  });

  it('17:00Z đã là ngày hôm sau ở Việt Nam', () => {
    expect(ngayVietNam(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
  });

  it('16:59:59Z vẫn là ngày hôm đó ở Việt Nam', () => {
    expect(ngayVietNam(new Date('2026-12-31T16:59:59Z'))).toBe('2026-12-31');
  });
});

describe('chuoiSangNgay / ngaySangChuoi (cột DATE)', () => {
  it('khứ hồi giữ nguyên ngày', () => {
    expect(ngaySangChuoi(chuoiSangNgay('2026-01-01'))).toBe('2026-01-01');
  });

  it('null giữ null', () => {
    expect(chuoiSangNgay(null)).toBeNull();
    expect(ngaySangChuoi(null)).toBeNull();
  });
});

// ADR 0015 S6: khoảng ngày QĐ — cùng trống hoặc cùng có, đến ≥ từ.
describe('kiemTraKhoangQd', () => {
  it('cả hai trống → hợp lệ', () => {
    expect(() => kiemTraKhoangQd(null, null)).not.toThrow();
  });

  it('đến == từ (biên) → hợp lệ', () => {
    expect(() => kiemTraKhoangQd('2026-03-01', '2026-03-01')).not.toThrow();
  });

  it('đến > từ → hợp lệ', () => {
    expect(() => kiemTraKhoangQd('2026-03-01', '2026-12-31')).not.toThrow();
  });

  it('đến < từ → 400 ở ngay_qd_den', () => {
    const loi = loiCua(() => kiemTraKhoangQd('2026-03-02', '2026-03-01'));
    expect(loi).toBeInstanceOf(ValidationException);
    expect(loi.getStatus()).toBe(400);
    expect(JSON.stringify(loi.getResponse())).toContain('ngay_qd_den');
  });

  it('chỉ có từ → 400 ở ngay_qd_den', () => {
    const loi = loiCua(() => kiemTraKhoangQd('2026-03-01', null));
    expect(loi).toBeInstanceOf(ValidationException);
    expect(JSON.stringify(loi.getResponse())).toContain('ngay_qd_den');
  });

  it('chỉ có đến → 400 ở ngay_qd_tu', () => {
    const loi = loiCua(() => kiemTraKhoangQd(null, '2026-03-01'));
    expect(loi).toBeInstanceOf(ValidationException);
    expect(JSON.stringify(loi.getResponse())).toContain('ngay_qd_tu');
  });
});
