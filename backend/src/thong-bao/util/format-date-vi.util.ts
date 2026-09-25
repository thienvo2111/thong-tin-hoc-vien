// Định dạng dd/mm/yyyy thủ công thay vì Date.toLocaleDateString('vi-VN') — để
// không phụ thuộc dữ liệu ICU đầy đủ có sẵn trên môi trường chạy Node hay
// không (tránh nội dung email bị sai định dạng ngày ở môi trường thiếu ICU).
export function formatDateVi(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}
