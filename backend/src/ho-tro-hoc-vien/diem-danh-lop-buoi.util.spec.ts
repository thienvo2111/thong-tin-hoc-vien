import {
  tinhChuyenCanLop,
  tinhDiemDanhDong,
  tongDiemDanh,
} from './diem-danh-lop-buoi.util';

// ADR 0008 L8: nhãn điểm danh 1 buổi + chuyên cần "có mặt / đã diễn ra".
// Buổi 2026-10-20 08:00 giờ VN = 01:00Z.
const BAT_DAU = new Date('2026-10-20T01:00:00Z');
const SAU = new Date('2026-10-20T05:00:00Z');
const TRUOC = new Date('2026-10-19T05:00:00Z');

const dd = (
  trang_thai: 'co_mat' | 'vang' | 'vang_co_phep',
  nguon = 'zoom',
  tu_diem_danh_luc: Date | null = null,
) => ({ trang_thai, nguon, tu_diem_danh_luc });

describe('tinhDiemDanhDong', () => {
  it('có mặt tự điểm danh -> giờ VN HH:mm, giữ tu_diem_danh_luc ISO', () => {
    const luc = new Date('2026-10-20T01:05:00Z');
    expect(
      tinhDiemDanhDong({
        diem_danh: dd('co_mat', 'zoom', luc),
        bao_vang: null,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt – tự điểm danh 08:05',
      tu_diem_danh_luc: luc.toISOString(),
    });
  });

  it.each([
    ['zoom', 'Có mặt (Zoom)'],
    ['ky_ten', 'Có mặt (Ký tên)'],
    ['qr', 'Có mặt (QR)'],
    ['thu_cong', 'Có mặt (Thủ công)'],
  ])('có mặt không tự điểm danh, nguồn %s -> %s', (nguon, nhan) => {
    expect(
      tinhDiemDanhDong({
        diem_danh: dd('co_mat', nguon),
        bao_vang: null,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({ ma: 'co_mat', nhan, tu_diem_danh_luc: null });
  });

  it('vắng / vắng có phép; dòng điểm danh thắng báo vắng', () => {
    const bv = { ly_do: 'Ốm' };
    expect(
      tinhDiemDanhDong({
        diem_danh: dd('vang', 'thu_cong'),
        bao_vang: bv,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({ ma: 'vang', nhan: 'Vắng', tu_diem_danh_luc: null });
    expect(
      tinhDiemDanhDong({
        diem_danh: dd('vang_co_phep', 'thu_cong'),
        bao_vang: bv,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({
      ma: 'vang_co_phep',
      nhan: 'Vắng có phép',
      tu_diem_danh_luc: null,
    });
  });

  it('chưa có điểm danh nhưng đã báo vắng -> "Đã báo vắng: <lý do>" (cả trước giờ học)', () => {
    for (const now of [TRUOC, SAU]) {
      expect(
        tinhDiemDanhDong({
          diem_danh: null,
          bao_vang: { ly_do: 'Đi công tác' },
          bat_dau: BAT_DAU,
          now,
        }),
      ).toEqual({
        ma: 'da_bao_vang',
        nhan: 'Đã báo vắng: Đi công tác',
        tu_diem_danh_luc: null,
      });
    }
  });

  it('không có gì: trước giờ -> Chưa đến giờ; đúng/sau giờ -> Chưa điểm danh', () => {
    const v = { diem_danh: null, bao_vang: null, bat_dau: BAT_DAU };
    expect(tinhDiemDanhDong({ ...v, now: TRUOC }).ma).toBe('chua_den_gio');
    expect(tinhDiemDanhDong({ ...v, now: TRUOC }).nhan).toBe('Chưa đến giờ');
    expect(tinhDiemDanhDong({ ...v, now: BAT_DAU }).nhan).toBe(
      'Chưa điểm danh',
    );
    expect(tinhDiemDanhDong({ ...v, now: SAU }).ma).toBe('chua_diem_danh');
  });
});

describe('tongDiemDanh', () => {
  it('đếm theo mã, đủ 6 khóa kể cả 0', () => {
    expect(
      tongDiemDanh([
        { ma: 'co_mat' },
        { ma: 'co_mat' },
        { ma: 'vang' },
        { ma: 'da_bao_vang' },
        { ma: 'chua_diem_danh' },
      ]),
    ).toEqual({
      co_mat: 2,
      vang: 1,
      vang_co_phep: 0,
      da_bao_vang: 1,
      chua_diem_danh: 1,
      chua_den_gio: 0,
    });
    expect(tongDiemDanh([])).toEqual({
      co_mat: 0,
      vang: 0,
      vang_co_phep: 0,
      da_bao_vang: 0,
      chua_diem_danh: 0,
      chua_den_gio: 0,
    });
  });
});

describe('tinhChuyenCanLop', () => {
  const NOW = new Date('2026-10-25T00:00:00Z');
  const ngay = (d: string) => new Date(`${d}T01:00:00Z`);
  // G1: 3 buổi (2 đã qua, 1 tương lai); G2: 1 buổi đã qua.
  const lich = [
    { id: 'L1', giai_doan_id: 'G1', thoi_gian_bat_dau: ngay('2026-10-10') },
    { id: 'L2', giai_doan_id: 'G1', thoi_gian_bat_dau: ngay('2026-10-17') },
    { id: 'L3', giai_doan_id: 'G1', thoi_gian_bat_dau: ngay('2026-10-31') },
    { id: 'L4', giai_doan_id: 'G2', thoi_gian_bat_dau: ngay('2026-10-20') },
  ];
  const base = {
    lich,
    giai_doan_ids: new Set(['G1', 'G2']),
    chot_cua_nguon: new Map<string, { id: string; thoi_gian_bat_dau: Date }>(),
    now: NOW,
  };

  it('học viên thường: có mặt / buổi đã diễn ra, bỏ buổi tương lai', () => {
    expect(
      tinhChuyenCanLop({ ...base, co_mat: new Set(['L1', 'L4']) }),
    ).toEqual({ co_mat: 2, da_dien_ra: 3 });
  });

  it('điểm danh có mặt ở buổi tương lai (dữ liệu lệch) không tính', () => {
    expect(tinhChuyenCanLop({ ...base, co_mat: new Set(['L3']) })).toEqual({
      co_mat: 0,
      da_dien_ra: 3,
    });
  });

  it('đổi ra khỏi L2 -> tính theo điểm danh ở buổi chốt, không theo L2', () => {
    const chot = new Map([
      ['L2', { id: 'X9', thoi_gian_bat_dau: ngay('2026-10-18') }],
    ]);
    expect(
      tinhChuyenCanLop({
        ...base,
        chot_cua_nguon: chot,
        co_mat: new Set(['L1', 'L2']),
      }),
    ).toEqual({ co_mat: 1, da_dien_ra: 3 });
    expect(
      tinhChuyenCanLop({
        ...base,
        chot_cua_nguon: chot,
        co_mat: new Set(['L1', 'X9']),
      }),
    ).toEqual({ co_mat: 2, da_dien_ra: 3 });
  });

  it('buổi chốt chưa diễn ra -> buổi nguồn chưa tính vào đã diễn ra', () => {
    const chot = new Map([
      ['L1', { id: 'X9', thoi_gian_bat_dau: ngay('2026-11-01') }],
    ]);
    expect(
      tinhChuyenCanLop({ ...base, chot_cua_nguon: chot, co_mat: new Set() }),
    ).toEqual({ co_mat: 0, da_dien_ra: 2 });
  });

  it('chỉ phân vào lớp ở 1 trong 2 giai đoạn -> chỉ tính buổi giai đoạn đó', () => {
    expect(
      tinhChuyenCanLop({
        ...base,
        giai_doan_ids: new Set(['G2']),
        co_mat: new Set(['L1', 'L4']),
      }),
    ).toEqual({ co_mat: 1, da_dien_ra: 1 });
  });
});
