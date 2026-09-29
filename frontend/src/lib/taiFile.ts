/** Kích hoạt tải 1 Blob về máy qua trình duyệt (dùng cho các nút "Xuất Excel"/"Xem file lỗi"). */
export function taiFileTuBlob(blob: Blob, tenFile: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tenFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
