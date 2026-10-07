// Giá trị cho `app.set('trust proxy', ...)` lấy từ biến môi trường TRUST_PROXY.
// Production đi qua 2 lớp proxy: proxy trung tâm HCMUE (terminate TLS,
// 10.0.197.1) -> Nginx trên VPS -> Node. Chỉ tin 1 hop (mặc định) thì req.ip
// luôn là IP proxy HCMUE -> mọi người dùng chung 1 bucket rate limit.
// - Để trống: 1 (giữ hành vi cũ, chỉ tin Nginx).
// - Số nguyên: số hop tin cậy.
// - Còn lại: danh sách IP/subnet/tên (loopback, uniquelocal...) phân cách
//   bởi dấu phẩy, vd. "loopback,10.0.197.1".
export function docTrustProxy(raw: string | undefined): number | string[] {
  const giaTri = raw?.trim();
  if (!giaTri) return 1;
  if (/^\d+$/.test(giaTri)) return Number(giaTri);
  return giaTri
    .split(',')
    .map((phan) => phan.trim())
    .filter((phan) => phan.length > 0);
}
