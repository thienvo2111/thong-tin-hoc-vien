import { chaySongSongGioiHan, chiaLo } from './theo-lo.util';

describe('theo-lo.util', () => {
  describe('chiaLo', () => {
    it('rỗng -> không có lô nào', () => {
      expect(chiaLo([])).toEqual([]);
    });

    it('vừa đúng kích thước -> 1 lô', () => {
      expect(chiaLo([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    });

    it('dư -> lô cuối ngắn hơn, giữ thứ tự', () => {
      expect(chiaLo([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('mặc định 1000 phần tử/lô', () => {
      const lo = chiaLo(Array.from({ length: 2001 }, (_, i) => i));
      expect(lo.map((l) => l.length)).toEqual([1000, 1000, 1]);
    });
  });

  describe('chaySongSongGioiHan', () => {
    it('rỗng -> [] và không gọi fn', async () => {
      const fn = jest.fn();
      await expect(chaySongSongGioiHan([], 8, fn)).resolves.toEqual([]);
      expect(fn).not.toHaveBeenCalled();
    });

    it('kết quả đúng thứ tự đầu vào dù hoàn thành lệch nhau', async () => {
      const kq = await chaySongSongGioiHan([30, 5, 20, 1], 3, async (ms) => {
        await new Promise((r) => setTimeout(r, ms));
        return ms * 2;
      });
      expect(kq).toEqual([60, 10, 40, 2]);
    });

    it('không bao giờ chạy quá giới hạn cùng lúc', async () => {
      let dangChay = 0;
      let toiDa = 0;
      await chaySongSongGioiHan(
        Array.from({ length: 25 }, (_, i) => i),
        4,
        async () => {
          dangChay++;
          toiDa = Math.max(toiDa, dangChay);
          await new Promise((r) => setTimeout(r, 1));
          dangChay--;
        },
      );
      expect(toiDa).toBe(4);
    });

    it('fn lỗi -> promise bị reject', async () => {
      await expect(
        chaySongSongGioiHan([1, 2], 2, async (x) => {
          if (x === 2) throw new Error('hỏng');
          return x;
        }),
      ).rejects.toThrow('hỏng');
    });
  });
});
