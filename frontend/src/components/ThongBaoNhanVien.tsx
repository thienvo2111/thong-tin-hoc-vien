import { StatusBanner } from "./StatusBanner";

/** 2026-10-07: đối tượng "nhân viên" chỉ cung cấp thông tin cá nhân — khảo sát/tập huấn chưa triển khai.
 * Câu chữ khớp backend (hoc-vien.service.ts#THONG_BAO_KHAO_SAT_NHAN_VIEN). */
export function ThongBaoNhanVien() {
  return (
    <StatusBanner
      loai="info"
      tieuDe="Khảo sát chưa triển khai cho đối tượng nhân viên"
    >
      Học viên chỉ cần cung cấp thông tin cá nhân cơ bản (chưa thực hiện khảo
      sát đánh giá năng lực và chưa tập huấn trong đợt này).{" "}
      <b>Kế hoạch tập huấn:</b> Việc khảo sát năng lực và tập huấn chuyên môn sẽ
      triển khai đồng loạt trên toàn tỉnh trong năm 2027.
    </StatusBanner>
  );
}
