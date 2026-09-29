import { parseVnDateTime } from './vn-datetime.util';

// T6 (mo-rong-nls-an-giang.md): parse dd/mm/yyyy hh:mm giờ Việt Nam (UTC+7,
// không DST) -> Date UTC, dùng cho cột bat_dau/ket_thuc của import
// lop_va_lich_hoc (quy tắc chung #4).
describe('parseVnDateTime (T6)', () => {
  it('parse đúng giờ VN -> UTC (trừ 7 giờ)', () => {
    const d = parseVnDateTime('08/10/2026 09:00');
    expect(d?.toISOString()).toBe('2026-10-08T02:00:00.000Z');
  });

  it('hỗ trợ ngày/tháng/giờ 1 chữ số (vd "8/1/2026 9:05")', () => {
    const d = parseVnDateTime('8/1/2026 9:05');
    expect(d?.toISOString()).toBe('2026-01-08T02:05:00.000Z');
  });

  it('giờ VN 00:00-06:59 lùi sang ngày trước theo UTC', () => {
    const d = parseVnDateTime('08/10/2026 03:00');
    expect(d?.toISOString()).toBe('2026-10-07T20:00:00.000Z');
  });

  it('sai định dạng (thiếu giờ) -> undefined', () => {
    expect(parseVnDateTime('08/10/2026')).toBeUndefined();
  });

  it('sai định dạng (yyyy/mm/dd) -> undefined', () => {
    expect(parseVnDateTime('2026/10/08 09:00')).toBeUndefined();
  });

  it('tháng > 12 -> undefined', () => {
    expect(parseVnDateTime('08/13/2026 09:00')).toBeUndefined();
  });

  it('giờ > 23 hoặc phút > 59 -> undefined', () => {
    expect(parseVnDateTime('08/10/2026 24:00')).toBeUndefined();
    expect(parseVnDateTime('08/10/2026 09:60')).toBeUndefined();
  });

  it('ngày không hợp lệ trong tháng (31/02) -> undefined', () => {
    expect(parseVnDateTime('31/02/2026 09:00')).toBeUndefined();
  });

  it('chuỗi rỗng/khoảng trắng -> undefined', () => {
    expect(parseVnDateTime('')).toBeUndefined();
    expect(parseVnDateTime('   ')).toBeUndefined();
  });
});
