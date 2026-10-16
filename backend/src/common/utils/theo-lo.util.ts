// Tiện ích cho import file lớn (hàng nghìn dòng): chia mảng giá trị cho mệnh
// đề IN (...) và chạy song song có giới hạn để không làm cạn pool kết nối DB.

export const KICH_THUOC_LO = 1000;

export function chiaLo<T>(items: T[], kichThuoc = KICH_THUOC_LO): T[][] {
  const lo: T[][] = [];
  for (let i = 0; i < items.length; i += kichThuoc) {
    lo.push(items.slice(i, i + kichThuoc));
  }
  return lo;
}

// Kết quả giữ đúng thứ tự đầu vào.
export async function chaySongSongGioiHan<T, R>(
  items: T[],
  gioiHan: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const ketQua = new Array<R>(items.length);
  let tiepTheo = 0;
  const luong = async () => {
    while (tiepTheo < items.length) {
      const i = tiepTheo++;
      ketQua[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(gioiHan, items.length) }, luong),
  );
  return ketQua;
}
