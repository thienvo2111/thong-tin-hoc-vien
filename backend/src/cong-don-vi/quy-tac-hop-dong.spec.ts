import {
  GiaiDoanKhongHopLeError,
  TY_LE_SUAT,
  TruongPhamVi,
  chuanHoaTenTruong,
  giaTriTamTinh,
  khopTruong,
  suatTuGiaiDoan,
  tongSuat,
} from './quy-tac-hop-dong';

// ADR 0015 S1, S3: "Giai đoạn tham gia" → suất.
describe('suatTuGiaiDoan', () => {
  it.each([
    'Cả 2',
    'Cả hai',
    'cả 2',
    'CẢ HAI',
    '  Cả   2  ',
    'Ca 2',
    'Cả 2 giai đoạn',
    'Ca hai giai doan',
  ])('"%s" → ca_hai, 1 suất', (v) => {
    expect(suatTuGiaiDoan(v)).toEqual({ giai_doan: 'ca_hai', ty_le_suat: 1 });
  });

  it.each([undefined, null, '', '   '])('trống (%p) → ca_hai, 1 suất', (v) => {
    expect(suatTuGiaiDoan(v)).toEqual({ giai_doan: 'ca_hai', ty_le_suat: 1 });
  });

  it.each([
    'Chỉ GĐ1',
    'Chỉ GĐ 1',
    'chỉ gđ1',
    'CHỈ GĐ 1',
    'Chỉ giai đoạn 1',
    'GĐ1',
    'GĐ 1',
    'Chi GD1',
    'Giai đoạn 1',
  ])('"%s" → chi_gd1, 0,5 suất', (v) => {
    expect(suatTuGiaiDoan(v)).toEqual({
      giai_doan: 'chi_gd1',
      ty_le_suat: 0.5,
    });
  });

  it.each([
    'Chỉ GĐ2',
    'Chỉ GĐ 2',
    'chỉ gđ2',
    'Chỉ giai đoạn 2',
    'GĐ2',
    'Chi GD 2',
  ])('"%s" → chi_gd2, 0,5 suất', (v) => {
    expect(suatTuGiaiDoan(v)).toEqual({
      giai_doan: 'chi_gd2',
      ty_le_suat: 0.5,
    });
  });

  it('chuỗi NFD (dấu tách rời) vẫn nhận', () => {
    expect(suatTuGiaiDoan('Chỉ GĐ1'.normalize('NFD')).giai_doan).toBe(
      'chi_gd1',
    );
  });

  it.each(['Chỉ GĐ3', 'Một nửa', 'x', '0,5', 'GĐ1 GĐ2 GĐ3'])(
    'giá trị lạ "%s" → GiaiDoanKhongHopLeError',
    (v) => {
      expect(() => suatTuGiaiDoan(v)).toThrow(GiaiDoanKhongHopLeError);
    },
  );

  it('TY_LE_SUAT khớp S1: cả hai = 1, chỉ một giai đoạn = 0,5 (đối xứng)', () => {
    expect(TY_LE_SUAT).toEqual({ ca_hai: 1, chi_gd1: 0.5, chi_gd2: 0.5 });
  });
});

// Biến thể tên trường thực tế của An Giang (issue #44).
describe('chuanHoaTenTruong', () => {
  it.each([
    ['THCS và THPT Võ Văn Kiệt', 'Trường THCS&THPT Võ Văn Kiệt'],
    ['Trường THCS & THPT Tân Thành', 'Trường THCS&THPT Tân Thành'],
    ['Trường TH, THCS và THPT Kiên Hải', 'Trường TH, THCS&THPT Kiên Hải'],
    [
      'Trường PT DTNT THCS và THPT An Giang 1',
      'Trường Phổ thông DTNT.THCS&THPT An Giang 1',
    ],
    ['Trường PT DT NT THCS và THPT An Giang 1', 'PT DTNT THCS&THPT An Giang 1'],
    ['Trường PT ĐTNT An Giang', 'Trường Phổ thông Dân tộc nội trú An Giang'],
    ['trường thcs  an sơn', 'TRƯỜNG THCS AN SƠN'],
    ['Trường THCS (Mỹ Hòa)', 'Trường THCS - Mỹ Hoà'],
    ['Trường THCS Lê Lợi'.normalize('NFD'), 'Trường THCS Lê Lợi'],
  ])('"%s" ≡ "%s"', (a, b) => {
    expect(chuanHoaTenTruong(a)).toBe(chuanHoaTenTruong(b));
  });

  it.each([
    ['Trường THCS An Sơn', 'Trường THCS và THPT An Sơn'],
    [
      'Trường PT DTNT THCS và THPT An Giang 1',
      'Trường PT DTNT THCS và THPT An Giang 2',
    ],
    ['Trường THCS Tân Thành', 'Trường THPT Tân Thành'],
    ['Trường TH Mỹ Hòa', 'Trường TH Mỹ Hà'],
  ])('"%s" ≠ "%s"', (a, b) => {
    expect(chuanHoaTenTruong(a)).not.toBe(chuanHoaTenTruong(b));
  });

  it('giữ dấu tiếng Việt (không bỏ dấu), gọn khoảng trắng, bỏ "trường" đầu', () => {
    expect(chuanHoaTenTruong('  Trường  THCS&THPT   Võ Văn Kiệt. ')).toBe(
      'thcs và thpt võ văn kiệt',
    );
  });

  it('"pt" chỉ thay khi là một từ riêng', () => {
    expect(chuanHoaTenTruong('Trường THPT Châu Phú')).toBe('thpt châu phú');
    expect(chuanHoaTenTruong('Trường PT Châu Phú')).toBe('phổ thông châu phú');
  });
});

describe('khopTruong', () => {
  const PHAM_VI: TruongPhamVi[] = [
    { id: 'a', ma_don_vi: 'TR-AG-012', ten_don_vi: 'Trường THCS Lê Lợi' },
    {
      id: 'b',
      ma_don_vi: 'TR-AG-013',
      ten_don_vi: 'Trường THCS&THPT Võ Văn Kiệt',
    },
    { id: 'c', ma_don_vi: null, ten_don_vi: 'Trường TH Mỹ Hòa' },
    { id: 'd', ma_don_vi: 'TR-AG-020', ten_don_vi: 'Trường TH Mỹ Hoà' },
  ];

  it('mã trường thắng dù tên ghi trường khác', () => {
    expect(
      khopTruong(
        { ma_truong: 'TR-AG-012', ten_truong: 'THCS và THPT Võ Văn Kiệt' },
        PHAM_VI,
      ),
    ).toEqual({ trang_thai: 'khop_ma', don_vi_id: 'a' });
  });

  it('mã so khớp không phân biệt hoa/thường, bỏ khoảng trắng thừa', () => {
    expect(khopTruong({ ma_truong: '  tr-ag-013 ' }, PHAM_VI)).toEqual({
      trang_thai: 'khop_ma',
      don_vi_id: 'b',
    });
  });

  it('mã không có trong phạm vi → lùi về khớp tên', () => {
    expect(
      khopTruong(
        { ma_truong: 'TR-KHAC-999', ten_truong: 'THCS và THPT Võ Văn Kiệt' },
        PHAM_VI,
      ),
    ).toEqual({ trang_thai: 'khop_ten', don_vi_id: 'b' });
  });

  it('mã không có trong phạm vi, không có tên → khong_khop', () => {
    expect(khopTruong({ ma_truong: 'TR-KHAC-999' }, PHAM_VI)).toEqual({
      trang_thai: 'khong_khop',
    });
  });

  it('tên không có trong danh sách phạm vi (trường cùng tên ở Sở khác không được truyền vào) → khong_khop', () => {
    expect(
      khopTruong({ ten_truong: 'Trường THCS Nguyễn Du' }, PHAM_VI),
    ).toEqual({ trang_thai: 'khong_khop' });
  });

  it('2 trường trong phạm vi cùng tên sau chuẩn hóa → nhieu_ket_qua, không chọn bừa', () => {
    expect(khopTruong({ ten_truong: 'TH Mỹ Hòa' }, PHAM_VI)).toEqual({
      trang_thai: 'nhieu_ket_qua',
    });
  });

  it.each([{}, { ma_truong: '', ten_truong: '  ' }])(
    'không có mã lẫn tên (%p) → thieu_truong',
    (dong) => {
      expect(khopTruong(dong, PHAM_VI)).toEqual({ trang_thai: 'thieu_truong' });
    },
  );

  it('danh sách phạm vi rỗng → khong_khop', () => {
    expect(
      khopTruong({ ma_truong: 'TR-AG-012', ten_truong: 'THCS Lê Lợi' }, []),
    ).toEqual({ trang_thai: 'khong_khop' });
  });

  it('kết quả luôn là id trong danh sách truyền vào', () => {
    const ids = new Set(PHAM_VI.map((t) => t.id));
    for (const dong of [
      { ma_truong: 'TR-AG-012' },
      { ten_truong: 'Trường THCS Lê Lợi' },
      { ten_truong: 'THCS&THPT Võ Văn Kiệt' },
    ]) {
      const kq = khopTruong(dong, PHAM_VI);
      expect(kq.don_vi_id && ids.has(kq.don_vi_id)).toBe(true);
    }
  });
});

// ADR 0015 S1, S5 (issue #60): tổng suất chính xác (0,5 cộng dồn không lệch số thực).
describe('tongSuat', () => {
  const ds = (...suat: number[]) => suat.map((ty_le_suat) => ({ ty_le_suat }));

  it('danh sách rỗng → 0', () => {
    expect(tongSuat([])).toBe(0);
  });

  it('0,5 + 0,5 + 1 = 2 đúng tuyệt đối', () => {
    expect(tongSuat(ds(0.5, 0.5, 1))).toBe(2);
  });

  it('số lẻ 0,5 giữ nguyên phần ,5', () => {
    expect(tongSuat(ds(1, 0.5))).toBe(1.5);
    expect(tongSuat(ds(0.5))).toBe(0.5);
  });

  it('682 người (341 người 0,5 + 341 người 1) = 511,5 — không trôi số thực', () => {
    const lon = [
      ...Array.from({ length: 341 }, () => 0.5),
      ...Array.from({ length: 341 }, () => 1),
    ];
    expect(tongSuat(ds(...lon))).toBe(511.5);
  });

  it('nhận ty_le_suat dạng Decimal đã đổi sang number (0.5 / 1)', () => {
    expect(tongSuat(ds(Number('0.5'), Number('1.0')))).toBe(1.5);
  });
});

// ADR 0015 S5: giá trị = Σ suất × đơn giá, làm tròn đến đồng — quy tắc: làm tròn nửa lên (≥ 0,5 đồng → lên).
describe('giaTriTamTinh', () => {
  it('đơn giá null → null (chưa có đơn giá, không hiện số)', () => {
    expect(giaTriTamTinh(12.5, null)).toBeNull();
    expect(giaTriTamTinh(0, null)).toBeNull();
  });

  it('đơn giá 0 → 0', () => {
    expect(giaTriTamTinh(12.5, 0)).toBe(0);
  });

  it('tổng suất 0 → 0', () => {
    expect(giaTriTamTinh(0, 1_500_000)).toBe(0);
  });

  it('đơn giá chẵn: 12,5 × 1.500.000 = 18.750.000', () => {
    expect(giaTriTamTinh(12.5, 1_500_000)).toBe(18_750_000);
  });

  it('đơn giá lẻ: 2,5 × 1.234.567 = 3.086.417,5 → 3.086.418 (nửa lên)', () => {
    expect(giaTriTamTinh(2.5, 1_234_567)).toBe(3_086_418);
  });

  it('0,5 × 3 = 1,5 → 2 (nửa lên); 0,5 × 1 = 0,5 → 1', () => {
    expect(giaTriTamTinh(0.5, 3)).toBe(2);
    expect(giaTriTamTinh(0.5, 1)).toBe(1);
  });

  it('kết quả luôn là số nguyên đồng', () => {
    for (const suat of [0.5, 1, 7.5, 511.5]) {
      expect(Number.isInteger(giaTriTamTinh(suat, 1_234_567))).toBe(true);
    }
  });

  it('quy mô lớn: 511,5 suất × 1.234.567 = 631.481.020,5 → 631.481.021', () => {
    expect(giaTriTamTinh(511.5, 1_234_567)).toBe(631_481_021);
  });

  it('dùng cùng tongSuat: 0,5 + 0,5 + 1 suất × 1.000.001 = 2.000.002', () => {
    const suat = tongSuat([
      { ty_le_suat: 0.5 },
      { ty_le_suat: 0.5 },
      { ty_le_suat: 1 },
    ]);
    expect(giaTriTamTinh(suat, 1_000_001)).toBe(2_000_002);
  });
});
