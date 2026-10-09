import { tinhCuaSoDiemDanh } from './cua-so-diem-danh.util';

// Giờ Việt Nam -> Date (UTC+7).
const gioVn = (iso: string) => new Date(`${iso}:00.000+07:00`);
const lech = (d: Date, ms: number) => new Date(d.getTime() + ms);

const MAC_DINH = { diem_danh_mo_truoc_phut: 30, diem_danh_dong_sau_phut: 120 };
const buoi = { thoi_gian_bat_dau: gioVn('2026-10-15T07:30') };

describe('tinhCuaSoDiemDanh', () => {
  it('mặc định 30/120: mo = bắt đầu − 30 phút, dong = bắt đầu + 120 phút', () => {
    const { mo, dong } = tinhCuaSoDiemDanh(
      buoi,
      MAC_DINH,
      buoi.thoi_gian_bat_dau,
    );
    expect(mo.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(dong.toISOString()).toBe('2026-10-15T02:30:00.000Z');
  });

  it('giờ bắt đầu VN được so bằng thời điểm UTC tương ứng', () => {
    const now = new Date('2026-10-15T00:29:59.000Z'); // 07:29:59 VN
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, now).pha).toBe('dang_mo');
    // 06:59 VN = 23:59 UTC hôm trước -> chưa mở.
    const som = new Date('2026-10-14T23:59:00.000Z');
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, som).pha).toBe('chua_mo');
  });

  it('biên mở: 1 ms trước -> chua_mo, đúng mốc -> dang_mo', () => {
    const { mo } = tinhCuaSoDiemDanh(buoi, MAC_DINH, new Date(0));
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, lech(mo, -1)).pha).toBe('chua_mo');
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, mo).pha).toBe('dang_mo');
  });

  it('biên đóng: đúng mốc -> dang_mo, 1 ms sau -> da_dong', () => {
    const { dong } = tinhCuaSoDiemDanh(buoi, MAC_DINH, new Date(0));
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, dong).pha).toBe('dang_mo');
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, lech(dong, 1)).pha).toBe(
      'da_dong',
    );
  });

  it('cấu hình tối thiểu 0/15: mở đúng giờ bắt đầu', () => {
    const khoa = { diem_danh_mo_truoc_phut: 0, diem_danh_dong_sau_phut: 15 };
    const r = tinhCuaSoDiemDanh(buoi, khoa, buoi.thoi_gian_bat_dau);
    expect(r.mo.getTime()).toBe(buoi.thoi_gian_bat_dau.getTime());
    expect(r.dong.toISOString()).toBe('2026-10-15T00:45:00.000Z');
    expect(r.pha).toBe('dang_mo');
    expect(tinhCuaSoDiemDanh(buoi, khoa, lech(r.mo, -1)).pha).toBe('chua_mo');
    expect(tinhCuaSoDiemDanh(buoi, khoa, lech(r.dong, 1)).pha).toBe('da_dong');
  });

  it('cấu hình tối đa 180/720', () => {
    const khoa = { diem_danh_mo_truoc_phut: 180, diem_danh_dong_sau_phut: 720 };
    const r = tinhCuaSoDiemDanh(buoi, khoa, gioVn('2026-10-15T19:30'));
    expect(r.mo.toISOString()).toBe('2026-10-14T21:30:00.000Z');
    expect(r.dong.toISOString()).toBe('2026-10-15T12:30:00.000Z');
    expect(r.pha).toBe('dang_mo');
    expect(tinhCuaSoDiemDanh(buoi, khoa, gioVn('2026-10-15T04:29')).pha).toBe(
      'chua_mo',
    );
  });

  it('buổi ngắn hơn cửa sổ: vẫn dang_mo sau giờ kết thúc buổi (không cắt)', () => {
    // Buổi 07:30–08:30 VN, cửa sổ đóng 09:30 VN.
    const now = gioVn('2026-10-15T09:00');
    expect(tinhCuaSoDiemDanh(buoi, MAC_DINH, now).pha).toBe('dang_mo');
    expect(
      tinhCuaSoDiemDanh(buoi, MAC_DINH, gioVn('2026-10-15T09:31')).pha,
    ).toBe('da_dong');
  });
});
