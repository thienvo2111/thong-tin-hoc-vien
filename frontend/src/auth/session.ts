// Kênh thông báo phiên hết hạn (401 trên request đã có token) — tách khỏi api/client.ts
// để client.ts không phụ thuộc router. App.tsx đăng ký lắng nghe để điều hướng + hiện thông báo.
type NguoiNghe = () => void;

let nguoiNghe: NguoiNghe[] = [];

export function theoDoiPhienHetHan(cb: NguoiNghe): () => void {
  nguoiNghe.push(cb);
  return () => {
    nguoiNghe = nguoiNghe.filter((l) => l !== cb);
  };
}

export function baoPhienHetHan(): void {
  nguoiNghe.forEach((l) => l());
}
