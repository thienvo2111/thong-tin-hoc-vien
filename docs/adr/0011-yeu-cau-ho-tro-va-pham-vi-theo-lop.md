# ADR 0011 — Yêu cầu hỗ trợ theo lớp và phạm vi lớp gồm đổi buổi

- Ngày: 2026-10-19
- Trạng thái: Đã chấp nhận
- Sửa đổi: ADR 0008 L2 (phạm vi lớp), L4 (yêu cầu hỗ trợ không còn chỉ theo cụm); ADR 0003 H10, H14 (định tuyến + ký tên ticket)
- Liên quan: ADR 0007 (đổi buổi — quy tắc hiệu lực), ADR 0010 (tình hình đi học)

## Bối cảnh

Người hỗ trợ lớp Zoom (ADR 0008) là người học viên liên hệ đầu tiên trong buổi học, nhưng yêu cầu hỗ trợ vẫn chỉ đi tới người hỗ trợ **cụm** (ADR 0003 H10): học viên chưa có cụm thì chỉ Quản trị thấy, học viên có cụm thì người hỗ trợ lớp không thấy câu hỏi của chính học viên lớp mình. Đồng thời học viên **đổi buổi vào** lớp (ADR 0007) có trong danh sách buổi để điểm danh (L7) nhưng người hỗ trợ lớp không mở được hồ sơ (L2) — không cấp lại được mật khẩu khi học viên báo không vào được Zoom. Màn Tình hình đi học (ADR 0010) cũng trộn học viên cụm và học viên lớp, người giữ cả hai không tách được.

## Quyết định

| # | Quyết định |
|---|---|
| P1 | **Phạm vi lớp gồm đổi buổi vào.** Học viên thuộc phạm vi lớp khi có `phan_lop_giai_doan` vào lớp được gắn **hoặc** có đổi buổi `da_duyet` **còn hiệu lực** (phân lớp hiện tại ở giai đoạn của buổi nguồn vẫn là lớp nguồn — quy tắc của `DoiBuoiHocQueryService`, hàm `doiVaoLop` dùng chung `locHieuLuc`, không chép lại) có buổi chốt thuộc lớp đó. Chờ duyệt / từ chối / đã hủy / hết hiệu lực không tính. `HoTroHocVienScopeService.whereDangKyTrongPhamVi` vẫn là điểm kiểm tra **duy nhất**, áp cho **mọi** chức năng dùng phạm vi: tra cứu/chi tiết, sửa hồ sơ, mật khẩu, báo vắng / đề nghị đổi lớp, tình hình đi học + điểm danh bổ sung, yêu cầu hỗ trợ. Hệ quả chấp nhận (người dùng yêu cầu): 1 học viên đổi buổi giữa 2 lớp thuộc phạm vi của người hỗ trợ **cả hai** lớp. Danh sách "Cả lớp" và file lớp vẫn theo lớp gốc; danh sách buổi vẫn là phân lớp − đổi ra + đổi vào (L7), người đổi vào nay có link chi tiết. Truy vấn tập hợp: 1 truy vấn đổi buổi theo lớp của tôi + 1 truy vấn phân lớp hiện tại, rồi `OR { id: { in: … } }` — không N+1. |
| P2 | **Yêu cầu hỗ trợ theo cụm ∪ lớp.** Ticket tới người hỗ trợ khi học viên có đăng ký trong phạm vi (P1) — học viên chưa có cụm nhưng thuộc lớp của tôi nay tới người hỗ trợ lớp (vẫn tới Quản trị). Lọc `cum_id` (phải là cụm của tôi, khác → `404`) và `lop_id` (phải là lớp được gắn, khác → `404` "Không tìm thấy lớp"; khớp phân lớp hoặc đổi buổi vào lớp đó). Số đếm menu gồm ticket theo lớp. Mỗi dòng thêm `lop_ho_tro` = các lớp **của tôi** mà học viên thuộc; `ten_cum` = mọi cụm của học viên. Nhiều người cùng thấy 1 ticket: **ai trả lời trước thắng** — giữ UPDATE có điều kiện `cho_xu_ly` (ADR 0003 H11), người sau nhận `409`. |
| P3 | **Ký tên "Hỗ trợ lớp X".** Người trả lời giữ cụm của học viên → tên cụm (như H14); không giữ cụm nào của học viên nhưng được gắn lớp học viên thuộc (P1) → "Hỗ trợ lớp <tên lớp>", chọn lớp ở giai đoạn **mới nhất** (ngày bắt đầu giai đoạn giảm dần, rồi thứ tự giai đoạn, rồi tên lớp — tất định); còn lại → cụm đầu tiên của học viên / "Ban tổ chức (HCMUE)" như cũ. Vẫn không lộ họ tên cán bộ. Phân công tính tại lúc học viên xem (động), như H14. |
| P4 | **Lọc phạm vi Tình hình đi học.** Người hỗ trợ có `pham_vi` = `tat_ca` (mặc định, cụm ∪ lớp) \| `cum` (chỉ cụm của tôi) \| `lop` (chỉ lớp của tôi, gồm đổi buổi vào), áp cho danh sách và file xuất (bộ lọc ghi vào nhật ký). Quản trị bỏ qua tham số. Giao diện: điều khiển "Tất cả · Cụm của tôi · Lớp tôi hỗ trợ" (ẩn lựa chọn không có), lưu trên URL; ô Lớp xếp nhóm "Lớp tôi hỗ trợ" trước "Lớp khác". |

## Phương án đã loại

- **Đổi buổi vào chỉ để xem (không sửa)** — phải tách 2 mức quyền trong mọi chức năng dùng phạm vi; người dùng chọn quyền đầy đủ.
- **Hàng chờ ticket riêng theo lớp** — học viên vừa có cụm vừa có lớp xuất hiện ở 2 hàng chờ khác nhau, dễ trả lời trùng; một hàng chờ chung + lọc cụm/lớp + 409 đủ.

## Hệ quả

- **Không migration**, không đổi dữ liệu. Sau deploy người hỗ trợ lớp thấy thêm: học viên đổi buổi (đã duyệt, còn hiệu lực) vào lớp mình, và ticket của học viên lớp mình (kể cả chưa có cụm).
- Người hỗ trợ lớp **sửa được** hồ sơ học viên chỉ đổi 1 buổi vào lớp mình — chấp nhận (cùng là cán bộ HCMUE hỗ trợ học viên đó trong buổi học).
- API: `GET /ho-tro-hoc-vien/yeu-cau-ho-tro` thêm `lop_id`, dòng + chi tiết thêm `lop_ho_tro`; `GET /ho-tro-hoc-vien/di-hoc` + `/xuat` thêm `pham_vi`. `nguoi_tra_loi_hien_thi` có thể là "Hỗ trợ lớp X".
- Mỗi request có phạm vi lớp thêm 2 truy vấn (đổi buổi vào lớp của tôi + phân lớp hiện tại để lọc hiệu lực) — quy mô vài lớp/người, chấp nhận.
- Nhắc lịch cụm, thống kê, duyệt đổi buổi, danh sách học viên hiện có (`/ho-tro-hoc-vien/hoc-vien`) vẫn chỉ theo cụm (ADR 0008 L4).
