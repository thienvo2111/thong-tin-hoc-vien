import {
  buoiHieuDung,
  KetQuaBuoiDiemDanh,
  lyDoDaCoMatLopKhac,
  tinhChuyenCanLop,
  tongDiHoc,
  tinhDiemDanhDong,
  tongDiemDanh,
} from './diem-danh-lop-buoi.util';
import { khoaBuoi } from '../common/utils/chuyen-can.util';

// ADR 0008 L8: nhãn điểm danh 1 buổi + chuyên cần "có mặt / đã diễn ra".
// ADR 0010 T7: đầu vào là kết quả tinhChuyenCan của (giai đoạn, buổi số).
// Buổi 2026-10-20 08:00 giờ VN = 01:00Z.
const BAT_DAU = new Date('2026-10-20T01:00:00Z');
const SAU = new Date('2026-10-20T05:00:00Z');
const TRUOC = new Date('2026-10-19T05:00:00Z');

// Kết quả tinhChuyenCan của buổi (dòng ở lớp hiện tại, trừ khi tu_lop_cu).
const dd = (
  trang_thai: 'co_mat' | 'vang' | 'vang_co_phep',
  nguon = 'zoom',
  tu_diem_danh_luc: Date | null = null,
  tu_lop_cu = false,
): KetQuaBuoiDiemDanh => ({
  trang_thai,
  tu_lop_cu,
  dong: {
    lop_id: tu_lop_cu ? 'lop-x' : 'lop-a',
    ten_lop: tu_lop_cu ? 'Lớp X' : 'Lớp A',
    nguon,
    tu_diem_danh_luc,
  },
});
const HIEN_TAI = {
  nguon_tinh: 'lop_hien_tai',
  lop_tinh: { id: 'lop-a', ten_lop: 'Lớp A' },
};
const LOP_X = {
  nguon_tinh: 'lop_khac',
  lop_tinh: { id: 'lop-x', ten_lop: 'Lớp X' },
};
const CHUA_CO = { nguon_tinh: null, lop_tinh: null };

describe('tinhDiemDanhDong', () => {
  it('có mặt tự điểm danh -> giờ VN HH:mm, giữ tu_diem_danh_luc ISO', () => {
    const luc = new Date('2026-10-20T01:05:00Z');
    expect(
      tinhDiemDanhDong({
        ket_qua: dd('co_mat', 'zoom', luc),
        bao_vang: null,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt – tự điểm danh 08:05',
      tu_diem_danh_luc: luc.toISOString(),
      ...HIEN_TAI,
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
        ket_qua: dd('co_mat', nguon),
        bao_vang: null,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({ ma: 'co_mat', nhan, tu_diem_danh_luc: null, ...HIEN_TAI });
  });

  it('vắng / vắng có phép; kết quả điểm danh thắng báo vắng', () => {
    const bv = { ly_do: 'Ốm' };
    expect(
      tinhDiemDanhDong({
        ket_qua: dd('vang', 'thu_cong'),
        bao_vang: bv,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({
      ma: 'vang',
      nhan: 'Vắng',
      tu_diem_danh_luc: null,
      ...HIEN_TAI,
    });
    expect(
      tinhDiemDanhDong({
        ket_qua: dd('vang_co_phep', 'thu_cong'),
        bao_vang: bv,
        bat_dau: BAT_DAU,
        now: SAU,
      }),
    ).toEqual({
      ma: 'vang_co_phep',
      nhan: 'Vắng có phép',
      tu_diem_danh_luc: null,
      ...HIEN_TAI,
    });
  });

  it('chưa có điểm danh nhưng đã báo vắng -> "Đã báo vắng: <lý do>" (cả trước giờ học)', () => {
    for (const now of [TRUOC, SAU]) {
      expect(
        tinhDiemDanhDong({
          ket_qua: null,
          bao_vang: { ly_do: 'Đi công tác' },
          bat_dau: BAT_DAU,
          now,
        }),
      ).toEqual({
        ma: 'da_bao_vang',
        nhan: 'Đã báo vắng: Đi công tác',
        tu_diem_danh_luc: null,
        ...CHUA_CO,
      });
    }
  });

  it('không có gì: trước giờ -> Chưa đến giờ; đúng/sau giờ -> Chưa điểm danh', () => {
    const v = { ket_qua: undefined, bao_vang: null, bat_dau: BAT_DAU };
    expect(tinhDiemDanhDong({ ...v, now: TRUOC }).ma).toBe('chua_den_gio');
    expect(tinhDiemDanhDong({ ...v, now: TRUOC }).nhan).toBe('Chưa đến giờ');
    expect(tinhDiemDanhDong({ ...v, now: BAT_DAU }).nhan).toBe(
      'Chưa điểm danh',
    );
    expect(tinhDiemDanhDong({ ...v, now: SAU })).toEqual({
      ma: 'chua_diem_danh',
      nhan: 'Chưa điểm danh',
      tu_diem_danh_luc: null,
      ...CHUA_CO,
    });
  });

  it('kết quả từ lớp khác: có mặt / vắng có phép kèm tên lớp, vắng chỉ "Vắng"', () => {
    const v = { bao_vang: null, bat_dau: BAT_DAU, now: SAU };
    expect(
      tinhDiemDanhDong({ ...v, ket_qua: dd('co_mat', 'thu_cong', null, true) }),
    ).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt – ở lớp Lớp X',
      tu_diem_danh_luc: null,
      ...LOP_X,
    });
    expect(
      tinhDiemDanhDong({
        ...v,
        ket_qua: dd('vang_co_phep', 'thu_cong', null, true),
      }),
    ).toMatchObject({
      ma: 'vang_co_phep',
      nhan: 'Vắng có phép – ở lớp Lớp X',
      ...LOP_X,
    });
    expect(
      tinhDiemDanhDong({ ...v, ket_qua: dd('vang', 'zoom', null, true) }),
    ).toMatchObject({ ma: 'vang', nhan: 'Vắng', ...LOP_X });
  });

  it('kết quả từ lớp khác thắng báo vắng và "chưa đến giờ" của buổi hiệu dụng', () => {
    expect(
      tinhDiemDanhDong({
        ket_qua: dd('co_mat', 'thu_cong', null, true),
        bao_vang: { ly_do: 'Ốm' },
        bat_dau: BAT_DAU,
        now: TRUOC,
      }).ma,
    ).toBe('co_mat');
  });
});

describe('lyDoDaCoMatLopKhac (chặn điểm danh bổ sung)', () => {
  const v = { bao_vang: null, bat_dau: BAT_DAU, now: SAU };
  it('có mặt nhờ lớp khác -> lý do', () => {
    expect(
      lyDoDaCoMatLopKhac(
        tinhDiemDanhDong({
          ...v,
          ket_qua: dd('co_mat', 'thu_cong', null, true),
        }),
      ),
    ).toBe('Đã có mặt ở lớp Lớp X (học bù/lớp cũ)');
  });

  it('có mặt ở lớp hiện tại / vắng ở lớp khác / chưa điểm danh -> không chặn', () => {
    for (const ket_qua of [
      dd('co_mat'),
      dd('vang', 'zoom', null, true),
      dd('vang_co_phep', 'thu_cong', null, true),
      null,
    ]) {
      expect(lyDoDaCoMatLopKhac(tinhDiemDanhDong({ ...v, ket_qua }))).toBe(
        null,
      );
    }
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
  const buoi = (id: string, gd: string, so: number, d: string) => ({
    id,
    giai_doan_id: gd,
    buoi_so: so,
    thoi_gian_bat_dau: ngay(d),
  });
  // G1: 3 buổi (2 đã qua, 1 tương lai); G2: 1 buổi đã qua.
  const lich = [
    buoi('L1', 'G1', 1, '2026-10-10'),
    buoi('L2', 'G1', 2, '2026-10-17'),
    buoi('L3', 'G1', 3, '2026-10-31'),
    buoi('L4', 'G2', 1, '2026-10-20'),
  ];
  const SLOT: Record<string, string> = Object.fromEntries(
    lich.map((l) => [l.id, khoaBuoi(l.giai_doan_id, l.buoi_so)]),
  );
  type TT = 'co_mat' | 'vang' | 'vang_co_phep';
  /** Kết quả tinhChuyenCan theo (giai đoạn, buổi số) của buổi lớp. */
  const kq = (coMat: string[], khac: Record<string, TT> = {}) =>
    new Map<string, { trang_thai: TT }>([
      ...coMat.map((l): [string, { trang_thai: TT }] => [
        SLOT[l],
        { trang_thai: 'co_mat' },
      ]),
      ...Object.entries(khac).map(([l, t]): [string, { trang_thai: TT }] => [
        SLOT[l],
        { trang_thai: t },
      ]),
    ]);
  const base = {
    lich,
    giai_doan_ids: new Set(['G1', 'G2']),
    chot_cua_nguon: new Map<string, { id: string; thoi_gian_bat_dau: Date }>(),
    now: NOW,
  };

  it('có mặt / buổi đã diễn ra, bỏ buổi tương lai; vắng có phép không tính có mặt', () => {
    expect(
      tinhChuyenCanLop({
        ...base,
        ket_qua: kq(['L1', 'L4'], { L2: 'vang_co_phep' }),
      }),
    ).toEqual({ co_mat: 2, da_dien_ra: 3 });
  });

  it('có mặt ở buổi tương lai (học bù trước, dữ liệu lệch) chưa tính', () => {
    expect(tinhChuyenCanLop({ ...base, ket_qua: kq(['L3']) })).toEqual({
      co_mat: 0,
      da_dien_ra: 3,
    });
  });

  it('đổi ra khỏi L2 -> có mặt theo kết quả của (G1, buổi 2) (đổi buổi tính thay buổi nguồn)', () => {
    const chot = new Map([
      ['L2', { id: 'X9', thoi_gian_bat_dau: ngay('2026-10-18') }],
    ]);
    expect(
      tinhChuyenCanLop({ ...base, chot_cua_nguon: chot, ket_qua: kq(['L2']) }),
    ).toEqual({ co_mat: 1, da_dien_ra: 3 });
  });

  it('buổi chốt chưa diễn ra -> buổi nguồn chưa tính vào đã diễn ra', () => {
    const chot = new Map([
      ['L1', { id: 'X9', thoi_gian_bat_dau: ngay('2026-11-01') }],
    ]);
    expect(
      tinhChuyenCanLop({ ...base, chot_cua_nguon: chot, ket_qua: kq([]) }),
    ).toEqual({ co_mat: 0, da_dien_ra: 2 });
  });

  it('chỉ phân vào lớp ở 1 trong 2 giai đoạn -> chỉ tính buổi giai đoạn đó', () => {
    expect(
      tinhChuyenCanLop({
        ...base,
        giai_doan_ids: new Set(['G2']),
        ket_qua: kq(['L1', 'L4']),
      }),
    ).toEqual({ co_mat: 1, da_dien_ra: 1 });
  });
});

// ADR 0010 T3: hàm buổi hiệu dụng dùng chung + tổng tình hình đi học.
describe('buoiHieuDung', () => {
  const l = (id: string, gd: string, ngay: string) => ({
    id,
    giai_doan_id: gd,
    buoi_so: 1,
    thoi_gian_bat_dau: new Date(ngay),
  });
  it('chỉ buổi thuộc giai đoạn được phân; đổi ra -> E là buổi chốt, cờ doi_buoi', () => {
    const chot = { id: 'c2', thoi_gian_bat_dau: new Date('2026-10-04') };
    const kq = buoiHieuDung({
      lich: [
        l('a1', 'g1', '2026-10-01'),
        l('a2', 'g1', '2026-10-03'),
        l('a9', 'g2', '2026-10-05'),
      ],
      giai_doan_ids: new Set(['g1']),
      chot_cua_nguon: new Map([['a2', chot]]),
    });
    expect(kq.map((c) => [c.nguon.id, c.hieu_dung.id, c.doi_buoi])).toEqual([
      ['a1', 'a1', false],
      ['a2', 'c2', true],
    ]);
  });
});

describe('tongDiHoc', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const qua = new Date('2026-10-01T00:00:00Z');
  const toi = new Date('2026-10-20T00:00:00Z');
  it('chỉ đếm buổi đã bắt đầu; đủ 6 khóa; báo vắng tính riêng', () => {
    expect(
      tongDiHoc(
        [
          { ma: 'co_mat', bat_dau: qua },
          { ma: 'vang', bat_dau: qua },
          { ma: 'vang_co_phep', bat_dau: qua },
          { ma: 'da_bao_vang', bat_dau: qua },
          { ma: 'chua_diem_danh', bat_dau: qua },
          { ma: 'chua_den_gio', bat_dau: toi },
          // Dữ liệu lệch: có dòng điểm danh ở buổi tương lai -> không tính.
          { ma: 'co_mat', bat_dau: toi },
        ],
        now,
      ),
    ).toEqual({
      da_dien_ra: 5,
      co_mat: 1,
      vang: 1,
      vang_co_phep: 1,
      da_bao_vang: 1,
      chua_diem_danh: 1,
    });
  });
  it('rỗng -> toàn 0', () => {
    expect(tongDiHoc([], now)).toEqual({
      da_dien_ra: 0,
      co_mat: 0,
      vang: 0,
      vang_co_phep: 0,
      da_bao_vang: 0,
      chua_diem_danh: 0,
    });
  });
});
