import {
  boSo0DauDeTimKiem,
  chuanHoaMaMoet,
  chuanHoaSoDienThoai,
  lamSachMaMoet,
  MaMoetDb,
  timCacHocVienIdTheoMaMoet,
  timHocVienIdTheoMaMoet,
  timHocVienIdTheoSoDienThoai,
} from './ma-moet.util';

function dbTra(rows: unknown[]): { db: MaMoetDb; queryRaw: jest.Mock } {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  return { db: { $queryRaw: queryRaw } as unknown as MaMoetDb, queryRaw };
}

// Lấy danh sách tham số đã bind của Prisma.sql (đảm bảo không nối chuỗi input).
function thamSo(queryRaw: jest.Mock): unknown[] {
  return (queryRaw.mock.calls[0][0] as { values: unknown[] }).values;
}

describe('ma-moet.util', () => {
  describe('chuanHoaMaMoet / lamSachMaMoet', () => {
    it.each([
      ['01234567890', '1234567890'],
      ['1234567890', '1234567890'],
      ['012345678901', '12345678901'], // mã 12 số
      [' 0123 456.78-90 ', '1234567890'], // khoảng trắng/chấm/gạch
      ['000123', '123'], // bỏ TOÀN BỘ số 0 đầu
      ['000000', ''], // toàn số 0 -> rỗng
      ['', ''],
    ])('chuanHoaMaMoet(%p) = %p', (vao, ra) => {
      expect(chuanHoaMaMoet(vao)).toBe(ra);
    });

    it('null/undefined -> rỗng', () => {
      expect(chuanHoaMaMoet(null)).toBe('');
      expect(chuanHoaMaMoet(undefined)).toBe('');
    });

    it('lamSachMaMoet giữ số 0 đầu, chỉ bỏ ký tự phân cách', () => {
      expect(lamSachMaMoet(' 0123 45 ')).toBe('012345');
    });
  });

  describe('boSo0DauDeTimKiem', () => {
    it.each([
      ['0123', '123'],
      [' 00123 ', '123'],
      ['MOET-SSO-ab12', 'MOET-SSO-ab12'], // giữ ký tự phân cách
      ['0123-45', '123-45'],
      ['000', '000'], // toàn số 0 -> giữ nguyên
      ['Nguyễn Văn', 'Nguyễn Văn'],
    ])('boSo0DauDeTimKiem(%p) = %p', (vao, ra) => {
      expect(boSo0DauDeTimKiem(vao)).toBe(ra);
    });
  });

  describe('chuanHoaSoDienThoai', () => {
    it.each([
      ['0912345678', '0912345678'],
      ['+84912345678', '0912345678'],
      ['84912345678', '0912345678'],
      ['0912 345.678', '0912345678'],
      ['912345678', '0912345678'], // thiếu số 0
      ['0912-345-678', '0912345678'],
      ['abc', ''],
      ['', ''],
    ])('chuanHoaSoDienThoai(%p) = %p', (vao, ra) => {
      expect(chuanHoaSoDienThoai(vao)).toBe(ra);
    });
  });

  describe('timCacHocVienIdTheoMaMoet', () => {
    it('ưu tiên khớp chính xác khi có', async () => {
      const { db } = dbTra([
        { id: 'a', chinh_xac: false },
        { id: 'b', chinh_xac: true },
      ]);
      await expect(timCacHocVienIdTheoMaMoet(db, '0123')).resolves.toEqual([
        'b',
      ]);
    });

    it('không có khớp chính xác -> trả mọi id khớp bỏ số 0', async () => {
      const { db, queryRaw } = dbTra([{ id: 'a', chinh_xac: false }]);
      await expect(timCacHocVienIdTheoMaMoet(db, ' 0123 ')).resolves.toEqual([
        'a',
      ]);
      // Input chỉ đi vào tham số bind — không nội suy chuỗi.
      expect(thamSo(queryRaw)).toEqual(['0123', '0123', '123', '123']);
    });

    it('khớp chính xác dùng chuỗi chỉ trim (mã có ký tự phân cách vẫn khớp nguyên văn)', async () => {
      const { db, queryRaw } = dbTra([{ id: 'x', chinh_xac: true }]);
      await expect(timCacHocVienIdTheoMaMoet(db, ' MOET-01 ')).resolves.toEqual(
        ['x'],
      );
      expect(thamSo(queryRaw)[0]).toBe('MOET-01');
    });

    it('input rỗng sau làm sạch -> không truy vấn, không khớp', async () => {
      const { db, queryRaw } = dbTra([]);
      await expect(timCacHocVienIdTheoMaMoet(db, '  ')).resolves.toEqual([]);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('toàn số 0 -> khóa bỏ số 0 rỗng (SQL bỏ nhánh ltrim), vẫn khớp chính xác được', async () => {
      const { db, queryRaw } = dbTra([{ id: 'z', chinh_xac: true }]);
      await expect(timCacHocVienIdTheoMaMoet(db, '0000')).resolves.toEqual([
        'z',
      ]);
      expect(thamSo(queryRaw)).toEqual(['0000', '0000', '', '']);
    });
  });

  describe('timHocVienIdTheoMaMoet', () => {
    it('đúng 1 -> id', async () => {
      const { db } = dbTra([{ id: 'a', chinh_xac: false }]);
      await expect(timHocVienIdTheoMaMoet(db, '123')).resolves.toBe('a');
    });

    it('0 -> null', async () => {
      const { db } = dbTra([]);
      await expect(timHocVienIdTheoMaMoet(db, '123')).resolves.toBeNull();
    });

    it('>= 2 khớp bỏ số 0 -> null (không đoán)', async () => {
      const { db } = dbTra([
        { id: 'a', chinh_xac: false },
        { id: 'b', chinh_xac: false },
      ]);
      await expect(timHocVienIdTheoMaMoet(db, '123')).resolves.toBeNull();
    });
  });

  describe('timHocVienIdTheoSoDienThoai', () => {
    it('đúng 1 học viên -> id, tham số đã chuẩn hóa', async () => {
      const { db, queryRaw } = dbTra([{ id: 'a' }]);
      await expect(
        timHocVienIdTheoSoDienThoai(db, '+84 912 345 678'),
      ).resolves.toBe('a');
      expect(thamSo(queryRaw)).toContain('0912345678');
    });

    it('SĐT dùng chung (2 học viên) -> null', async () => {
      const { db } = dbTra([{ id: 'a' }, { id: 'b' }]);
      await expect(
        timHocVienIdTheoSoDienThoai(db, '0912345678'),
      ).resolves.toBeNull();
    });

    it('không tồn tại -> null', async () => {
      const { db } = dbTra([]);
      await expect(
        timHocVienIdTheoSoDienThoai(db, '0912345678'),
      ).resolves.toBeNull();
    });

    it('rỗng sau chuẩn hóa -> null, không truy vấn', async () => {
      const { db, queryRaw } = dbTra([]);
      await expect(timHocVienIdTheoSoDienThoai(db, 'abc')).resolves.toBeNull();
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });
});
