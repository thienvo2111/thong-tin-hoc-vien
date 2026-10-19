# ADR 0010 — Tra cứu tình hình đi học và điểm danh bổ sung của người hỗ trợ học viên

- Ngày: 2026-10-19
- Trạng thái: Đã chấp nhận
- Bổ sung (không thay thế): ADR 0005 Z7 (sửa nhanh điểm danh của Quản trị + hỗ trợ GV giữ nguyên), ADR 0008 L8 (chuyên cần trong lớp)
- Liên quan: ADR 0003 (phạm vi cụm), ADR 0007 (đổi buổi — chuyên cần tính ở buổi chốt), ADR 0008 L2 (phạm vi cụm ∪ lớp gốc)

## Bối cảnh

Người hỗ trợ học viên nhận câu hỏi "Thầy/Cô bị ghi vắng buổi nào?" qua Zalo và cần trả lời trên điện thoại. Hiện họ chỉ thấy chuyên cần "x/y" trong từng lớp được gắn (L8), không xem được một học viên qua mọi giai đoạn/lớp, không lọc được ai đang có buổi vắng/chưa điểm danh, và không sửa được khi học viên có minh chứng (ảnh Zoom, ký tên muộn) — phải nhờ Quản trị hoặc hỗ trợ GV (chỉ trong 3 ngày). Quản trị cũng thiếu một màn tra cứu đi học theo học viên trên cả khóa.

## Quyết định

| # | Quyết định |
|---|---|
| T1 | **Phạm vi.** Người hỗ trợ học viên: học viên có `dang_ky_hoc` thuộc cụm của tôi **hoặc** phân lớp gốc vào lớp được gắn (ADR 0008 L2, `HoTroHocVienScopeService.whereDangKyTrongPhamVi` — điểm kiểm tra duy nhất, ngoài phạm vi → `404`). Lọc cụm chỉ nhận cụm của tôi (`404` như `cumLoc`). Quản trị: mọi học viên, mọi cụm. Một service dùng chung (`backend/src/tinh-hinh-di-hoc/`) nhận phạm vi đã giải quyết; người hỗ trợ ở `/ho-tro-hoc-vien/di-hoc*`, Quản trị ở `/thong-ke/di-hoc*` (tiền tố `/thong-ke` đã có trong Nginx — **không** thêm tiền tố mới trên VPS). |
| T2 | **Lọc và phân trang ở server, xuất đủ dòng.** Bắt buộc chọn khóa; lọc họ tên/mã MOET (khớp mã chấp nhận thiếu/thừa số 0 đầu qua `ma-moet.util`), trường (ô chọn tìm qua server `SelectDonViTimKiem`, không giới hạn 200 đơn vị), cụm, lớp, "có buổi vắng", "có buổi chưa điểm danh". Hai lọc sau dựa trên số đếm nên tính cho mọi đăng ký khớp rồi mới cắt trang; không có hai lọc này thì chỉ tính cho trang đang xem. Nạp theo lô (đăng ký, buổi các lớp, đổi buổi, buổi chốt, điểm danh + báo vắng theo lô 1.000 đăng ký) — không N+1. Excel xuất mọi dòng khớp lọc, không ngày sinh/CCCD, ghi nhật ký. Bộ lọc nằm trên URL. |
| T3 | **Định nghĩa đếm = buổi hiệu dụng.** Với mỗi phân lớp (giai đoạn G, lớp C), mỗi buổi L của C ở G → E = buổi chốt nếu có đổi buổi `da_duyet` còn hiệu lực ra khỏi L (`DoiBuoiHocQueryService`), ngược lại L. Trạng thái tại E theo `tinhDiemDanhDong` (L8): dòng `diem_danh` thắng báo vắng; không có gì → chưa đến giờ / chưa điểm danh. Tổng chỉ đếm E **đã bắt đầu**: đã diễn ra, có mặt, vắng, vắng có phép, đã báo vắng, chưa điểm danh. Hàm `buoiHieuDung` dùng chung với chuyên cần trong lớp (L8) — L8 giữ hành vi cũ. Không xét `che_do_chuyen_can`/điểm danh lớp cũ (khác dashboard Z8). |
| T4 | **Điểm danh bổ sung của người hỗ trợ học viên.** Chỉ buổi hiệu dụng E của đăng ký (buổi của lớp khác không đổi vào, buổi nguồn đã đổi ra → `400`), E đã bắt đầu, **không giới hạn thời gian** sau buổi; chỉ ghi `co_mat` hoặc `vang_co_phep` (không tự ghi "vắng"); **lý do bắt buộc** (1–500 ký tự). Ghi qua hàm dùng chung `DiemDanhService.ghiThuCong`: `nguon = thu_cong`, `ghi_chu = lý do`, `nguoi_sua`, `cap_nhat_luc`, giữ `tu_diem_danh_luc`. Ghi nhật ký `ho_tro_diem_danh_bo_sung` (trạng thái cũ → mới) vào dòng thời gian học viên. Quyền thời gian là nhánh mới của `quyenSuaDiemDanh` (`ho_tro_hoc_vien`: đã bắt đầu → được), trạng thái cho phép ở `trangThaiSuaDuoc`. |
| T5 | **Quản trị** trên cùng màn (`/admin/di-hoc`): quyền như Z7 — mọi lúc, đủ `co_mat`/`vang`/`vang_co_phep`, lý do tùy chọn; cùng kiểm tra buổi hiệu dụng. |
| T6 | **Import Excel điểm danh vẫn ghi đè** (ADR 0005 Z3, không đổi). Rủi ro: Quản trị nạp lại file của buổi đã được bổ sung → mất bổ sung. Giảm thiểu: modal bổ sung cảnh báo "Nếu Quản trị nạp lại file điểm danh của buổi này, kết quả bổ sung sẽ bị ghi đè."; nhật ký `ho_tro_diem_danh_bo_sung` còn lại để đối chiếu. |

## Phương án đã loại

- **Phạm vi toàn khóa cho người hỗ trợ** — trái ADR 0003/0008 (chỉ cụm ∪ lớp gốc); lộ hồ sơ học viên của cụm khác.
- **Ma trận học viên × buổi** — không đọc được trên điện thoại (người hỗ trợ dùng Zalo trên điện thoại); chọn bảng tổng theo học viên + ngăn kéo chi tiết từng buổi.
- **Giới hạn 3 ngày như hỗ trợ GV (Z7/G12)** — người dùng chọn **không giới hạn**: minh chứng của học viên thường đến muộn hơn 3 ngày.

## Hệ quả

- **Không migration**, không đổi dữ liệu. Không thêm tiền tố Nginx (Quản trị dùng `/thong-ke/di-hoc`).
- `quyenSuaDiemDanh('ho_tro_hoc_vien', …)` đổi từ `khong_co_quyen` sang theo thời gian bắt đầu — chỉ ảnh hưởng nơi gọi mới; `PUT /lop/{lopId}/diem-danh` vẫn chỉ cho `quan_tri`, `ho_tro_giang_vien` (Roles), hành vi cũ giữ nguyên.
- Nhật ký mới: `ho_tro_xuat_tinh_hinh_di_hoc`, `xuat_tinh_hinh_di_hoc`, `ho_tro_diem_danh_bo_sung`.
- Hiệu năng (đo trên DB dev, 1 khóa 7.521 đăng ký, Quản trị không lọc): trang 1 ~0,8–1 s; lọc "có buổi vắng/chưa điểm danh" (tính cả khóa) ~1,4–1,8 s; xuất Excel cả khóa ~3–4,5 s. Người hỗ trợ (vài trăm học viên) nhanh hơn nhiều. Dữ liệu thật nhiều phân lớp/buổi hơn sẽ chậm hơn tuyến tính theo số dòng điểm danh — chấp nhận, chưa bắt buộc lọc thêm.
- Giao diện: `/ho-tro/di-hoc` (menu "Tình hình đi học") và `/admin/di-hoc` (cùng component, `cheDo='admin'`).
