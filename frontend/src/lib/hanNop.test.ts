import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import {
  daHetHan,
  laLoiHetHan,
  nhanHan,
  nhanHetHanNgan,
  ngayVietNam,
  sdtHoTro,
  soNgayConLai,
  thongBaoChiXemHetHan,
  trangThaiHan,
} from './hanNop';

// Issue #66: nhãn hạn nộp — `now` cố định, không đọc đồng hồ thật. Hạn 05/12/2026 = 16:59:59Z.
const HAN = '2026-12-05T16:59:59.000Z';
const NGAY = '2026-12-05';
const t = (iso: string) => new Date(iso);

describe('ngayVietNam / soNgayConLai', () => {
  it('ngày VN đổi lúc 17:00Z', () => {
    expect(ngayVietNam(t('2026-12-04T16:59:59Z'))).toBe('2026-12-04');
    expect(ngayVietNam(t('2026-12-04T17:00:00Z'))).toBe('2026-12-05');
  });

  it.each([
    ['2026-12-01T03:00:00Z', 4],
    ['2026-12-04T16:59:59Z', 1],
    ['2026-12-04T17:30:00Z', 0], // 05/12 00:30 giờ VN
    ['2026-12-05T17:00:00Z', -1],
  ])('now %s → %d ngày', (now, mong) => {
    expect(soNgayConLai(NGAY, t(now))).toBe(mong);
  });
});

describe('daHetHan (đối chiếu backend)', () => {
  it('đúng mốc còn hạn, sau 1 ms hết hạn', () => {
    expect(daHetHan(HAN, t('2026-12-05T16:59:59.000Z'))).toBe(false);
    expect(daHetHan(HAN, t('2026-12-05T16:59:59.001Z'))).toBe(true);
  });
});

describe('trangThaiHan / nhanHan — theo da_het_han của server', () => {
  const con = { da_het_han: false, han_hieu_luc_ngay: NGAY };

  it('còn nhiều ngày → "Còn N ngày"', () => {
    expect(nhanHan(con, t('2026-12-01T03:00:00Z'))).toBe('Còn 4 ngày');
    expect(trangThaiHan(con, t('2026-12-01T03:00:00Z'))).toEqual({ loai: 'con_han', soNgay: 4 });
  });

  it('ngày hạn = hôm nay (giờ VN) → "Hạn cuối hôm nay"', () => {
    expect(nhanHan(con, t('2026-12-04T17:30:00Z'))).toBe('Hạn cuối hôm nay');
  });

  it('server chưa báo hết hạn nhưng máy lệch giờ qua ngày → vẫn "hôm nay", không tự khóa', () => {
    expect(trangThaiHan(con, t('2026-12-06T01:00:00Z'))).toEqual({ loai: 'hom_nay' });
  });

  it('server báo hết hạn → "Đã hết hạn ngày dd/mm/yyyy" dù máy còn trước hạn', () => {
    const het = { da_het_han: true, han_hieu_luc_ngay: NGAY };
    expect(nhanHan(het, t('2026-12-01T03:00:00Z'))).toBe('Đã hết hạn ngày 05/12/2026');
  });
});

describe('SĐT hỗ trợ + thông điệp hết hạn', () => {
  it('chỉ nhận chuỗi có chữ số; trống / chuỗi tạm → null', () => {
    expect(sdtHoTro('(chưa cập nhật)')).toBeNull();
    expect(sdtHoTro('')).toBeNull();
    expect(sdtHoTro(undefined)).toBeNull();
    expect(sdtHoTro(' 0900 000 000 ')).toBe('0900 000 000');
  });

  it('nhãn ngắn trang chủ có / không SĐT', () => {
    expect(nhanHetHanNgan(NGAY, '0900 000 000')).toBe('Đã hết hạn ngày 05/12 – liên hệ HCMUE (0900 000 000)');
    expect(nhanHetHanNgan(NGAY, null)).toBe('Đã hết hạn ngày 05/12 – liên hệ HCMUE');
  });

  it('banner chỉ xem có / không SĐT', () => {
    expect(thongBaoChiXemHetHan(NGAY, '0900 000 000')).toBe(
      'Đã hết hạn ngày 05/12/2026 — chỉ xem. Liên hệ HCMUE (0900 000 000) để được gia hạn.',
    );
    expect(thongBaoChiXemHetHan(NGAY, null)).toBe(
      'Đã hết hạn ngày 05/12/2026 — chỉ xem. Liên hệ HCMUE để được gia hạn.',
    );
  });

  it('laLoiHetHan: chỉ 403 HET_HAN_DOT', () => {
    expect(laLoiHetHan(new ApiError(403, { code: 'HET_HAN_DOT', message: 'Đã hết hạn' }))).toBe(true);
    expect(laLoiHetHan(new ApiError(403, { code: 'FORBIDDEN', message: 'x' }))).toBe(false);
    expect(laLoiHetHan(new Error('x'))).toBe(false);
  });
});
