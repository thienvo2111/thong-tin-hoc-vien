import { bienNgayVietNam } from './gio-viet-nam.util';

describe('bienNgayVietNam', () => {
  it('giữa ngày (17h VN = 10h UTC) -> tuNgay/denNgay đúng mốc 00h VN', () => {
    const { tuNgay, denNgay } = bienNgayVietNam(
      new Date('2026-10-01T10:00:00Z'),
    );
    expect(tuNgay.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(denNgay.toISOString()).toBe('2026-10-01T17:00:00.000Z');
  });

  it('đúng lúc 00h00 VN (17h00 UTC hôm trước) -> tuNgay = chính thời điểm đó', () => {
    const { tuNgay, denNgay } = bienNgayVietNam(
      new Date('2026-09-30T17:00:00Z'),
    );
    expect(tuNgay.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(denNgay.toISOString()).toBe('2026-10-01T17:00:00.000Z');
  });

  it('23h59 VN hôm qua (16h59 UTC cùng ngày UTC) KHÔNG rơi vào khoảng của "hôm nay"', () => {
    // "hôm nay" = 2026-10-01 theo giờ VN, now lúc 15h VN (08h UTC).
    const { tuNgay } = bienNgayVietNam(new Date('2026-10-01T08:00:00Z'));
    const guiLucHomQua = new Date('2026-09-30T16:59:00Z');
    expect(guiLucHomQua.getTime()).toBeLessThan(tuNgay.getTime());
  });
});
