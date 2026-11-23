import {
  daHetHan,
  hanHieuLuc,
  hanNopTuNgay,
  hanRiengTuNgay,
  ngayVietNam,
  soNgayConLai,
  thongDiepHetHan,
  thongTinHan,
} from './han-nop';
import * as quyTac from './quy-tac-hop-dong';

// Issue #66 / ADR 0015 T1–T3: hạn hiệu lực, hết hạn (đúng mốc 23:59:59 giờ VN), số ngày còn lại.
// Quy tắc mốc: hết hạn khi now > hạn (so mili giây); hạn lưu 23:59:59.000 giờ VN = 16:59:59.000Z.

const HAN_05_12 = new Date('2026-12-05T16:59:59.000Z');

describe('hanNopTuNgay / hanRiengTuNgay (T1, T3)', () => {
  it('ngày chọn → 23:59:59 giờ Việt Nam = 16:59:59Z cùng ngày', () => {
    expect(hanNopTuNgay('2026-12-05').toISOString()).toBe(
      '2026-12-05T16:59:59.000Z',
    );
  });

  it('hạn riêng dùng cùng mốc với hạn đợt', () => {
    expect(hanRiengTuNgay('2026-12-05')).toEqual(hanNopTuNgay('2026-12-05'));
  });

  it('ngày cuối năm / nhuận vẫn đúng mốc', () => {
    expect(hanNopTuNgay('2026-12-31').toISOString()).toBe(
      '2026-12-31T16:59:59.000Z',
    );
    expect(hanNopTuNgay('2028-02-29').toISOString()).toBe(
      '2028-02-29T16:59:59.000Z',
    );
  });
});

describe('hanHieuLuc (T1, T3)', () => {
  const hanDot = hanNopTuNgay('2026-12-05');

  it('không có hạn riêng → hạn của đợt', () => {
    expect(hanHieuLuc(hanDot, null)).toBe(hanDot);
  });

  it('hạn riêng muộn hơn hạn đợt → hạn riêng', () => {
    const rieng = hanNopTuNgay('2026-12-20');
    expect(hanHieuLuc(hanDot, rieng)).toBe(rieng);
  });

  it('hạn riêng sớm hơn hạn đợt vẫn là hạn hiệu lực của trường', () => {
    const rieng = hanNopTuNgay('2026-12-01');
    expect(hanHieuLuc(hanDot, rieng)).toBe(rieng);
  });
});

describe('daHetHan (T2) — đúng mốc', () => {
  it.each<[string, boolean]>([
    ['2026-12-05T10:00:00.000Z', false], // 17:00 giờ VN ngày hạn
    ['2026-12-05T16:59:58.999Z', false],
    ['2026-12-05T16:59:59.000Z', false], // đúng 23:59:59 giờ VN: còn hạn
    ['2026-12-05T16:59:59.001Z', true], // sau mốc 1 ms: hết hạn
    ['2026-12-05T17:00:00.000Z', true], // 00:00 giờ VN ngày 06/12
    ['2027-01-01T00:00:00.000Z', true],
  ])('now = %s → %s', (now, mongDoi) => {
    expect(daHetHan(HAN_05_12, new Date(now))).toBe(mongDoi);
  });

  it('kết hợp hạn hiệu lực: hạn đợt đã qua nhưng hạn riêng còn → chưa hết hạn', () => {
    const now = new Date('2026-12-10T03:00:00Z');
    expect(daHetHan(hanHieuLuc(HAN_05_12, null), now)).toBe(true);
    expect(
      daHetHan(hanHieuLuc(HAN_05_12, hanNopTuNgay('2026-12-15')), now),
    ).toBe(false);
  });

  it('hạn riêng sớm hơn hạn đợt → hết hạn theo hạn riêng dù hạn đợt còn', () => {
    const now = new Date('2026-12-03T03:00:00Z');
    expect(daHetHan(hanHieuLuc(HAN_05_12, null), now)).toBe(false);
    expect(
      daHetHan(hanHieuLuc(HAN_05_12, hanNopTuNgay('2026-12-02')), now),
    ).toBe(true);
  });
});

describe('soNgayConLai (giờ Việt Nam)', () => {
  it.each<[string, number]>([
    ['2026-12-01T03:00:00Z', 4], // 01/12 10:00 VN
    ['2026-12-04T16:59:59Z', 1], // 04/12 23:59:59 VN
    ['2026-12-04T17:30:00Z', 0], // qua nửa đêm UTC+7: 05/12 00:30 VN → hạn cuối hôm nay
    ['2026-12-05T16:59:59Z', 0],
    ['2026-12-05T17:00:00Z', -1], // 06/12 00:00 VN
    ['2026-12-10T03:00:00Z', -5],
  ])('now = %s → %d', (now, mongDoi) => {
    expect(soNgayConLai(HAN_05_12, new Date(now))).toBe(mongDoi);
  });

  it('đếm theo ngày lịch VN, không theo 24 giờ: 04/12 23:00 VN tới 05/12 23:59:59 vẫn là 1 ngày', () => {
    expect(soNgayConLai(HAN_05_12, new Date('2026-12-04T16:00:00Z'))).toBe(1);
  });

  it('qua ranh giới tháng / năm', () => {
    const han = hanNopTuNgay('2027-01-02');
    expect(soNgayConLai(han, new Date('2026-12-30T05:00:00Z'))).toBe(3);
  });
});

describe('ngayVietNam / thongDiepHetHan / thongTinHan', () => {
  it('ngày VN của 16:59:59Z là cùng ngày, của 17:00Z là ngày hôm sau', () => {
    expect(ngayVietNam(new Date('2026-12-05T16:59:59Z'))).toBe('2026-12-05');
    expect(ngayVietNam(new Date('2026-12-05T17:00:00Z'))).toBe('2026-12-06');
  });

  it('thông điệp hết hạn theo ngày VN dd/mm/yyyy', () => {
    expect(thongDiepHetHan(HAN_05_12)).toBe(
      'Đã hết hạn ngày 05/12/2026 — liên hệ HCMUE để được gia hạn',
    );
  });

  it('thongTinHan: không hạn riêng', () => {
    expect(
      thongTinHan(HAN_05_12, null, new Date('2026-12-06T01:00:00Z')),
    ).toEqual({
      han_rieng: null,
      han_hieu_luc: '2026-12-05T16:59:59.000Z',
      han_hieu_luc_ngay: '2026-12-05',
      da_het_han: true,
    });
  });

  it('thongTinHan: có hạn riêng → hạn hiệu lực = hạn riêng', () => {
    const rieng = hanNopTuNgay('2026-12-20');
    expect(
      thongTinHan(HAN_05_12, rieng, new Date('2026-12-06T01:00:00Z')),
    ).toEqual({
      han_rieng: '2026-12-20T16:59:59.000Z',
      han_hieu_luc: '2026-12-20T16:59:59.000Z',
      han_hieu_luc_ngay: '2026-12-20',
      da_het_han: false,
    });
  });

  it('quy-tac-hop-dong xuất lại đúng các hàm hạn nộp', () => {
    expect(quyTac.hanHieuLuc).toBe(hanHieuLuc);
    expect(quyTac.daHetHan).toBe(daHetHan);
    expect(quyTac.soNgayConLai).toBe(soNgayConLai);
    expect(quyTac.hanRiengTuNgay).toBe(hanRiengTuNgay);
  });
});
