import {
  cacMucNhuCauDuocChon,
  chonLopDangPhanCong,
  duocChonNhuCau,
  GiaiDoanPhanLop,
  homNayVN,
  tinhMocNhuCau,
} from './moc-nhu-cau.util';

const HOM_NAY = '2026-10-20';

function gd(
  id: string,
  thu_tu: number,
  bat_dau: string,
  ket_thuc: string,
  muc: 'co_ban' | 'thanh_thao' | 'nang_cao' | null | 'khong_lop',
): GiaiDoanPhanLop {
  return {
    giai_doan_id: id,
    ten_giai_doan: `GD ${id}`,
    thu_tu,
    bat_dau,
    ket_thuc,
    lop:
      muc === 'khong_lop'
        ? null
        : { id: `lop-${id}`, ten_lop: `Lop ${id}`, muc_nang_luc: muc },
  };
}

describe('chonLopDangPhanCong', () => {
  it('chọn giai đoạn đang diễn ra khi có đã qua, đang diễn ra, sắp tới', () => {
    const r = chonLopDangPhanCong(
      [
        gd('qua', 1, '2026-09-01', '2026-09-30', 'co_ban'),
        gd('nay', 2, '2026-10-15', '2026-10-25', 'thanh_thao'),
        gd('toi', 3, '2026-11-01', '2026-11-30', 'nang_cao'),
      ],
      HOM_NAY,
    );
    expect(r?.giai_doan_id).toBe('nay');
  });

  it('nhiều giai đoạn đang diễn ra: lấy thu_tu nhỏ nhất', () => {
    const r = chonLopDangPhanCong(
      [
        gd('b', 2, '2026-10-01', '2026-10-30', 'co_ban'),
        gd('a', 1, '2026-10-10', '2026-10-21', 'co_ban'),
      ],
      HOM_NAY,
    );
    expect(r?.giai_doan_id).toBe('a');
  });

  it('biên: bat_dau = homNay và ket_thuc = homNay đều tính là đang diễn ra', () => {
    expect(
      chonLopDangPhanCong([gd('x', 1, HOM_NAY, HOM_NAY, 'co_ban')], HOM_NAY)
        ?.giai_doan_id,
    ).toBe('x');
  });

  it('chưa tới giai đoạn nào: chọn sắp tới gần nhất', () => {
    const r = chonLopDangPhanCong(
      [
        gd('xa', 2, '2026-12-01', '2026-12-31', 'co_ban'),
        gd('gan', 1, '2026-11-01', '2026-11-30', 'thanh_thao'),
      ],
      HOM_NAY,
    );
    expect(r?.giai_doan_id).toBe('gan');
  });

  it('mọi giai đoạn đã kết thúc: chọn giai đoạn đã qua gần nhất', () => {
    const r = chonLopDangPhanCong(
      [
        gd('cu', 1, '2026-08-01', '2026-08-31', 'co_ban'),
        gd('moi', 2, '2026-09-01', '2026-10-10', 'thanh_thao'),
      ],
      HOM_NAY,
    );
    expect(r?.giai_doan_id).toBe('moi');
  });

  it('bỏ qua giai đoạn không có lớp', () => {
    const r = chonLopDangPhanCong(
      [
        gd('khong', 1, '2026-10-15', '2026-10-25', 'khong_lop'),
        gd('co', 2, '2026-11-01', '2026-11-30', 'co_ban'),
      ],
      HOM_NAY,
    );
    expect(r?.giai_doan_id).toBe('co');
  });

  it('mảng rỗng hoặc toàn giai đoạn không lớp: null', () => {
    expect(chonLopDangPhanCong([], HOM_NAY)).toBeNull();
    expect(
      chonLopDangPhanCong(
        [gd('k', 1, '2026-10-15', '2026-10-25', 'khong_lop')],
        HOM_NAY,
      ),
    ).toBeNull();
  });
});

describe('tinhMocNhuCau', () => {
  it('lớp có mức: nguồn lop, bỏ qua mucDauVao', () => {
    const r = tinhMocNhuCau(
      [gd('a', 1, '2026-10-15', '2026-10-25', 'thanh_thao')],
      'nang_cao',
      HOM_NAY,
    );
    expect(r).toEqual({
      muc: 'thanh_thao',
      nguon: 'lop',
      lop: { id: 'lop-a', ten_lop: 'Lop a' },
      giai_doan: { id: 'a', ten_giai_doan: 'GD a' },
    });
  });

  it('lớp không có mức + có mucDauVao: nguồn muc_chot, giữ lớp', () => {
    const r = tinhMocNhuCau(
      [gd('a', 1, '2026-10-15', '2026-10-25', null)],
      'co_ban',
      HOM_NAY,
    );
    expect(r).toEqual({
      muc: 'co_ban',
      nguon: 'muc_chot',
      lop: { id: 'lop-a', ten_lop: 'Lop a' },
      giai_doan: { id: 'a', ten_giai_doan: 'GD a' },
    });
  });

  it('không có lớp + có mucDauVao: muc_chot, lop null, giai_doan null', () => {
    expect(tinhMocNhuCau([], 'thanh_thao', HOM_NAY)).toEqual({
      muc: 'thanh_thao',
      nguon: 'muc_chot',
      lop: null,
      giai_doan: null,
    });
  });

  it('không có lớp và không có mucDauVao: null', () => {
    expect(tinhMocNhuCau([], null, HOM_NAY)).toBeNull();
  });

  it('mọi giai đoạn đã kết thúc: vẫn có mốc từ lớp gần nhất đã qua', () => {
    const r = tinhMocNhuCau(
      [
        gd('cu', 1, '2026-08-01', '2026-08-31', 'co_ban'),
        gd('moi', 2, '2026-09-01', '2026-10-10', 'nang_cao'),
      ],
      null,
      HOM_NAY,
    );
    expect(r?.muc).toBe('nang_cao');
    expect(r?.nguon).toBe('lop');
    expect(r?.giai_doan?.id).toBe('moi');
  });
});

describe('cacMucNhuCauDuocChon', () => {
  it('thấp → cao, gồm cả mốc', () => {
    expect(cacMucNhuCauDuocChon('nang_cao')).toEqual([
      'co_ban',
      'thanh_thao',
      'nang_cao',
    ]);
    expect(cacMucNhuCauDuocChon('thanh_thao')).toEqual([
      'co_ban',
      'thanh_thao',
    ]);
    expect(cacMucNhuCauDuocChon('co_ban')).toEqual(['co_ban']);
  });
});

describe('duocChonNhuCau', () => {
  it('được chọn mọi mức ≤ mốc', () => {
    expect(duocChonNhuCau('nang_cao', 'co_ban')).toBe(true);
    expect(duocChonNhuCau('co_ban', 'co_ban')).toBe(true);
    expect(duocChonNhuCau('nang_cao', 'nang_cao')).toBe(true);
  });
  it('không được chọn mức > mốc', () => {
    expect(duocChonNhuCau('thanh_thao', 'nang_cao')).toBe(false);
    expect(duocChonNhuCau('co_ban', 'thanh_thao')).toBe(false);
  });
});

describe('homNayVN', () => {
  it('đổi sang ngày theo Asia/Ho_Chi_Minh', () => {
    expect(homNayVN(new Date('2026-10-19T17:30:00Z'))).toBe('2026-10-20');
    expect(homNayVN(new Date('2026-10-19T16:30:00Z'))).toBe('2026-10-19');
  });
});
