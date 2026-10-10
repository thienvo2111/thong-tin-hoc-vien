import { DongDiemDanhBuoi, khoaBuoi, tinhChuyenCan } from './chuyen-can.util';

// ADR 0005 Z8: chuyên cần theo (giai_doan, buoi_so) khi học viên chuyển lớp.
const GD1 = 'gd-1';
const GD2 = 'gd-2';
const LOP_CU = 'lop-cu';
const LOP_MOI = 'lop-moi';
const LOP_KHAC = 'lop-khac';

const dong = (
  lop_id: string,
  buoi_so: number,
  trang_thai: DongDiemDanhBuoi['trang_thai'],
  giai_doan_id = GD1,
  loai_lop = 'zoom',
): DongDiemDanhBuoi => ({
  lop_id,
  loai_lop,
  giai_doan_id,
  buoi_so,
  trang_thai,
});

const hienTai = new Map([[GD1, LOP_MOI]]);

describe('tinhChuyenCan — theo_lop_hien_tai', () => {
  it('chỉ lấy dòng của lớp hiện tại', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [dong(LOP_CU, 1, 'co_mat'), dong(LOP_MOI, 1, 'vang')],
      'theo_lop_hien_tai',
    );
    expect(kq.get(khoaBuoi(GD1, 1))).toEqual({
      trang_thai: 'vang',
      lop_id: LOP_MOI,
      tu_lop_cu: false,
    });
  });

  it('buổi chỉ có dòng ở lớp cũ → không tính', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [dong(LOP_CU, 2, 'co_mat')],
      'theo_lop_hien_tai',
    );
    expect(kq.size).toBe(0);
  });

  it('không có lớp hiện tại ở giai đoạn → không tính dòng nào', () => {
    const kq = tinhChuyenCan(
      new Map(),
      [dong(LOP_CU, 1, 'co_mat')],
      'theo_lop_hien_tai',
    );
    expect(kq.size).toBe(0);
  });

  it('tách theo giai đoạn và buổi; lớp hiện tại riêng từng giai đoạn', () => {
    const kq = tinhChuyenCan(
      new Map([
        [GD1, LOP_MOI],
        [GD2, LOP_CU],
      ]),
      [
        dong(LOP_MOI, 1, 'co_mat'),
        dong(LOP_MOI, 2, 'vang_co_phep'),
        dong(LOP_CU, 1, 'vang', GD2),
        dong(LOP_MOI, 1, 'co_mat', GD2),
      ],
      'theo_lop_hien_tai',
    );
    expect(kq.size).toBe(3);
    expect(kq.get(khoaBuoi(GD1, 2))?.trang_thai).toBe('vang_co_phep');
    expect(kq.get(khoaBuoi(GD2, 1))).toEqual({
      trang_thai: 'vang',
      lop_id: LOP_CU,
      tu_lop_cu: false,
    });
  });

  it('danh sách rỗng → map rỗng', () => {
    expect(tinhChuyenCan(hienTai, [], 'theo_lop_hien_tai').size).toBe(0);
  });
});

// Z8 chỉ áp cho lớp Zoom — dòng trực tiếp luôn tính (gộp 1 lần mỗi buổi).
describe('tinhChuyenCan — lớp trực tiếp ở chế độ mặc định', () => {
  const tt = (lop_id: string, buoi_so: number, trang_thai: 'co_mat' | 'vang') =>
    dong(lop_id, buoi_so, trang_thai, GD1, 'truc_tiep');

  it('học bù ở lớp trực tiếp khác vẫn tính, lấy tốt nhất', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [tt(LOP_MOI, 2, 'vang'), tt(LOP_KHAC, 2, 'co_mat')],
      'theo_lop_hien_tai',
    );
    expect(kq.size).toBe(1);
    expect(kq.get(khoaBuoi(GD1, 2))).toEqual({
      trang_thai: 'co_mat',
      lop_id: LOP_KHAC,
      tu_lop_cu: true,
    });
  });

  it('không có phân lớp vẫn tính qua dòng trực tiếp', () => {
    const kq = tinhChuyenCan(
      new Map(),
      [tt(LOP_CU, 1, 'vang')],
      'theo_lop_hien_tai',
    );
    expect(kq.get(khoaBuoi(GD1, 1))).toEqual({
      trang_thai: 'vang',
      lop_id: LOP_CU,
      tu_lop_cu: true,
    });
  });

  it('dòng Zoom lớp cũ bị bỏ, dòng trực tiếp lớp khác vẫn giữ', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [dong(LOP_CU, 1, 'co_mat'), tt(LOP_KHAC, 2, 'co_mat')],
      'theo_lop_hien_tai',
    );
    expect(kq.has(khoaBuoi(GD1, 1))).toBe(false);
    expect(kq.get(khoaBuoi(GD1, 2))?.trang_thai).toBe('co_mat');
  });
});

describe('tinhChuyenCan — cong_nhan_lop_cu', () => {
  it('có mặt ở lớp cũ thắng vắng ở lớp mới', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [dong(LOP_MOI, 1, 'vang'), dong(LOP_CU, 1, 'co_mat')],
      'cong_nhan_lop_cu',
    );
    expect(kq.get(khoaBuoi(GD1, 1))).toEqual({
      trang_thai: 'co_mat',
      lop_id: LOP_CU,
      tu_lop_cu: true,
    });
  });

  it('thứ hạng co_mat > vang_co_phep > vang, không phụ thuộc thứ tự', () => {
    const ds = [
      dong(LOP_KHAC, 1, 'vang'),
      dong(LOP_CU, 1, 'vang_co_phep'),
      dong(LOP_MOI, 2, 'vang'),
      dong(LOP_CU, 2, 'vang_co_phep'),
    ];
    for (const thuTu of [ds, [...ds].reverse()]) {
      const kq = tinhChuyenCan(hienTai, thuTu, 'cong_nhan_lop_cu');
      expect(kq.get(khoaBuoi(GD1, 1))?.trang_thai).toBe('vang_co_phep');
      expect(kq.get(khoaBuoi(GD1, 2))).toEqual({
        trang_thai: 'vang_co_phep',
        lop_id: LOP_CU,
        tu_lop_cu: true,
      });
    }
  });

  it('hòa hạng → ưu tiên lớp hiện tại', () => {
    for (const ds of [
      [dong(LOP_CU, 1, 'co_mat'), dong(LOP_MOI, 1, 'co_mat')],
      [dong(LOP_MOI, 1, 'co_mat'), dong(LOP_CU, 1, 'co_mat')],
    ]) {
      const kq = tinhChuyenCan(hienTai, ds, 'cong_nhan_lop_cu');
      expect(kq.get(khoaBuoi(GD1, 1))).toEqual({
        trang_thai: 'co_mat',
        lop_id: LOP_MOI,
        tu_lop_cu: false,
      });
    }
  });

  it('buổi chỉ có ở lớp cũ → tính, đánh dấu tu_lop_cu', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [dong(LOP_CU, 3, 'vang')],
      'cong_nhan_lop_cu',
    );
    expect(kq.get(khoaBuoi(GD1, 3))).toEqual({
      trang_thai: 'vang',
      lop_id: LOP_CU,
      tu_lop_cu: true,
    });
  });

  it('không có lớp hiện tại → vẫn lấy tốt nhất, mọi dòng là lớp cũ', () => {
    const kq = tinhChuyenCan(
      new Map(),
      [dong(LOP_CU, 1, 'vang'), dong(LOP_KHAC, 1, 'co_mat')],
      'cong_nhan_lop_cu',
    );
    expect(kq.get(khoaBuoi(GD1, 1))).toEqual({
      trang_thai: 'co_mat',
      lop_id: LOP_KHAC,
      tu_lop_cu: true,
    });
  });

  it('không gộp buổi khác giai đoạn dù cùng buoi_so', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [dong(LOP_MOI, 1, 'vang'), dong(LOP_CU, 1, 'co_mat', GD2)],
      'cong_nhan_lop_cu',
    );
    expect(kq.size).toBe(2);
    expect(kq.get(khoaBuoi(GD1, 1))?.trang_thai).toBe('vang');
    expect(kq.get(khoaBuoi(GD2, 1))?.tu_lop_cu).toBe(true);
  });

  it('mỗi (giai_doan, buoi_so) đúng 1 kết quả dù có dòng ở 3 lớp', () => {
    const kq = tinhChuyenCan(
      hienTai,
      [
        dong(LOP_CU, 1, 'vang'),
        dong(LOP_KHAC, 1, 'vang'),
        dong(LOP_MOI, 1, 'vang'),
      ],
      'cong_nhan_lop_cu',
    );
    expect(kq.size).toBe(1);
    expect(kq.get(khoaBuoi(GD1, 1))?.tu_lop_cu).toBe(false);
  });
});
