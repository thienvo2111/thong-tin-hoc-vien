# ADR 0014 — Chuyển lớp bằng import: công nhận buổi đã học theo mức, cảnh báo và tự hủy đổi buổi/học bù

- Ngày: 2026-10-22
- Trạng thái: Đã chấp nhận
- Bổ sung: ADR 0005 Z8 (`che_do_chuyen_can`), ADR 0007 (đổi buổi), ADR 0010 T7 (chuyên cần dùng chung), ADR 0012 (học bù)

## Bối cảnh

Quản trị cần **cập nhật lại lớp** cho học viên bằng cách import lại `phan_lop_hoc_vien`, trong khi nhiều học viên đã học 1–2 buổi ở lớp cũ (đã có điểm danh có mặt / vắng).

Hiện trạng (main 10c3d00):

- Import đè **đã được phép**: ô giai đoạn = tên lớp → gán/thay, trống → giữ, `-` → gỡ (`resolvePhanLopRow` / `commitPhanLop`). Không chặn, không cảnh báo khi học viên đã có điểm danh.
- `diem_danh` gắn với `(dang_ky_hoc_id, lich_hoc_id)`, **không** gắn với `phan_lop_giai_doan` → chuyển lớp không xóa điểm danh cũ.
- Tính hay không tính buổi ở lớp cũ do `khoa_boi_duong.che_do_chuyen_can` (ADR 0005 Z8) quyết định, qua hàm duy nhất `tinhChuyenCan`: `theo_lop_hien_tai` (mặc định, lớp Zoom cũ không tính) hoặc `cong_nhan_lop_cu` (khớp theo `(giai_doan, buoi_so)`, **không xét mức**).
- Nghiệp vụ thực tế: các lớp Zoom cùng giai đoạn chỉ dạy cùng nội dung theo `buoi_so` khi **cùng mức** (`co_ban` / `thanh_thao` / `nang_cao`). Khóa An Giang hiện tại vẫn cần công nhận cả khác mức (đợt này), các khóa sau thì không.
- Không lưu lịch sử phân lớp (ADR 0010 T7) — chỉ biết lớp hiện tại.
- Đề nghị đổi buổi / học bù `cho_duyet` của lớp cũ đã tự bị chặn duyệt (`quyetDinhDuyet` so `lop_phan_hien_tai`); bản `da_duyet` vẫn giữ hiệu lực và tính thay buổi nguồn của lớp cũ.

## Quyết định

| # | Quyết định |
|---|---|
| C1 | **Công tắc 3 nấc theo khóa** — thêm giá trị `cong_nhan_cung_muc` vào enum `che_do_chuyen_can`. Áp cho dòng điểm danh ở lớp Zoom khác lớp hiện tại (sau `doi_tu`), cùng giai đoạn, cùng `buoi_so`: `theo_lop_hien_tai` → không tính; `cong_nhan_cung_muc` → tính khi **cùng mức** (C2); `cong_nhan_lop_cu` → tính bất kể mức (giữ nguyên hành vi hiện tại, không đổi nghĩa giá trị cũ). Trạng thái tốt nhất thắng, hòa → lớp hiện tại (như Z8). |
| C2 | **So mức** giữa lớp của dòng điểm danh và lớp hiện tại của giai đoạn: hai lớp cùng `muc_nang_luc` → cùng mức; **cả hai NULL** → cùng mức (khóa không chia mức vẫn hoạt động như "công nhận lớp cũ"); một bên NULL, một bên có mức → khác mức. Lớp **trực tiếp** giữ quy tắc cũ — luôn tính (học bù), không xét mức. Đăng ký chưa có lớp hiện tại ở giai đoạn đó → không có lớp để so → không tính dòng lớp Zoom khác (như Z8 hiện nay). |
| C3 | **Mặc định cho khóa tạo mới** = `cong_nhan_cung_muc`. Khóa đang có **giữ nguyên giá trị** (migration không cập nhật dữ liệu). Khóa An Giang hiện tại: Quản trị chọn nấc `cong_nhan_lop_cu` trên màn **Cấu hình điểm danh Zoom** (thao tác UI, không phải migration). |
| C4 | **Một chỗ tính duy nhất**: `tinhChuyenCan` nhận thêm mức của lớp mỗi dòng và mức lớp hiện tại theo giai đoạn; mọi nơi gọi (dashboard / `thong-ke.service`, `napChuyenCan` cho DS lớp, DS buổi, tình hình đi học) nạp thêm `lop_hoc.muc_nang_luc`. Phần hiển thị "buổi đã có ở lớp cũ" trên trang khóa học của học viên (`khoa-boi-duong.service`, gọi cố định `cong_nhan_lop_cu`, chỉ để hiển thị) **không đổi**. |
| C5 | **Bước kiểm tra import phân lớp — chỉ cảnh báo, không chặn** (dòng vẫn hợp lệ): (a) **chuyển lớp** (ô = tên lớp khác lớp hiện tại) mà đăng ký đã có `diem_danh` ở buổi của lớp cũ cùng giai đoạn → "Học viên X chuyển từ lớp A sang lớp B (giai đoạn n): đã điểm danh k buổi ở lớp A — theo chế độ của khóa: được công nhận / không được công nhận (khác mức)"; (b) **gỡ lớp** (`-`) mà đã có điểm danh → "đã điểm danh k buổi ở lớp A — điểm danh vẫn được giữ"; (c) chuyển lớp mà có đề nghị sẽ bị hủy (C6) → nêu số đề nghị đổi buổi / học bù, tách riêng số bản đã duyệt mà học viên **đã điểm danh buổi chốt**. Dòng giữ nguyên lớp (ô trống hoặc đúng tên lớp hiện tại) → không cảnh báo. |
| C6 | **Bước xác nhận — chuyển lớp tự hủy hết đề nghị của lớp cũ**: mọi `doi_buoi_hoc` (cả `doi_buoi` và `hoc_bu`) của đăng ký đó, `trang_thai` ∈ {`cho_duyet`, `da_duyet`}, có **buổi nguồn thuộc lớp cũ, đúng giai đoạn bị đổi** → `da_huy`, **kể cả** bản đã duyệt mà buổi chốt đã bắt đầu hoặc đã điểm danh. `nguoi_xu_ly` = người import, `xu_ly_luc` = lúc xác nhận, `ghi_chu_xu_ly` = "Hủy tự động do chuyển lớp (nhập file)"; ghi nhật ký hoạt động; **không gửi email**. Bản `tu_choi` / `da_huy` không đụng tới. Chạy trong cùng lượt ghi phân lớp của dòng đó. |
| C7 | **Gỡ lớp (`-`) không tự hủy** đề nghị — chỉ cảnh báo (C5b). Đề nghị `cho_duyet` vẫn bị chặn duyệt bởi kiểm tra lớp hiện tại sẵn có. |
| C8 | **Điểm danh không bao giờ bị xóa** bởi chuyển/gỡ lớp hay đổi nấc — chỉ thay đổi cách tính, nên đổi nấc lúc nào cũng được và có thể hoàn tác. |

## Phương án đã loại

- **Chặn import chuyển lớp khi học viên đã có điểm danh** — chuyển lớp là thao tác hợp lệ, dữ liệu không mất; chặn làm Quản trị phải gỡ từng người.
- **Ghi quyết định công nhận lúc chuyển lớp (cột trên `phan_lop_giai_doan` / bảng lịch sử)** — chỉ cần khi chính sách thay đổi giữa các lần chuyển lớp **trong cùng khóa**; người dùng chốt "đợt sau" = khóa sau, nên cài đặt theo khóa là đủ, không cần migration bảng.
- **Đổi nghĩa `cong_nhan_lop_cu` thành "cùng mức"** — khóa đang dùng giá trị này bị đổi hành vi ngầm.
- **Chỉ hủy đề nghị đã duyệt chưa diễn ra** (đề xuất ban đầu) — người dùng chọn hủy hết để không còn đề nghị nào treo vào lớp cũ.
- **Gửi email khi tự hủy** — đồng bộ với hủy duyệt hiện tại (không email); Quản trị chủ động báo học viên nếu cần.

## Hệ quả

- **2 migration chỉ thêm, không đổi dữ liệu**: (1) `ALTER TYPE che_do_chuyen_can ADD VALUE 'cong_nhan_cung_muc'`; (2) `ALTER TABLE khoa_boi_duong ALTER COLUMN che_do_chuyen_can SET DEFAULT 'cong_nhan_cung_muc'`. Tách 2 file vì PostgreSQL không cho dùng giá trị enum mới trong cùng transaction vừa thêm. Cập nhật `docs/database-ddl.sql`.
- Đề nghị **đã duyệt, đã học buổi chốt** bị hủy (C6): `diem_danh` ở buổi chốt vẫn giữ nhưng mất `doi_tu` → không còn tính thay buổi nguồn mà tính như dòng ở lớp khác theo `(giai_doan, buoi_so)` của chính buổi chốt. Ở `cong_nhan_lop_cu` / `cong_nhan_cung_muc` (cùng mức) thường vẫn được tính vì đổi buổi/học bù sang buổi tương đương; ở `theo_lop_hien_tai` thì **không** còn tính. Cảnh báo C5c nêu số này trước khi xác nhận.
- Đề nghị bị hủy do chuyển lớp trả lại lượt (từ chối/hủy trả lượt — ADR 0007/0012); `lyDoHuy` trả `huy_duyet` (có `nguoi_xu_ly`).
- Màn Cấu hình điểm danh Zoom thêm lựa chọn thứ 3; nhãn nêu rõ "cùng mức" / "bất kể mức".
- Giới hạn: vẫn không lưu lịch sử phân lớp — cảnh báo C5 chỉ dựa trên điểm danh và đề nghị hiện có của lớp cũ.
- **Bổ sung nhật ký (2026-10-22, không migration)**:
  - Dòng nhật ký "Phân lớp" (`phan_lop`) khi **nhập file** chuyển lớp ghi thêm vào `mo_ta` (và `chi_tiet` có cấu trúc: `diem_danh_lop_cu { so_buoi, cong_nhan, che_do_chuyen_can }`, `huy_de_nghi { doi_buoi, hoc_bu, ids }`) số buổi đã điểm danh ở lớp cũ cùng giai đoạn, kết luận được/không được công nhận theo nấc **tại thời điểm chuyển** (ghi tên nấc: "theo lớp hiện tại" / "cùng mức" / "bất kể mức") và số đề nghị bị hủy — vd `AG-2026 — GĐ2 "…": Lớp A → Lớp B (nhập file) — đã điểm danh 2 buổi ở lớp Lớp A, được công nhận (nấc: bất kể mức); hủy 1 đổi buổi`. Gỡ lớp `-` có điểm danh → "— đã điểm danh k buổi, điểm danh vẫn được giữ". Dùng lại dữ liệu nạp theo lô của C5 (không truy vấn theo dòng). Đây là bản ghi lịch sử bù cho giới hạn "không lưu lịch sử phân lớp" ở trên. Phân lớp thủ công giữ nguyên.
  - Đề nghị tự hủy khi chuyển lớp (C6) ghi `hanh_dong='huy_doi_buoi_chuyen_lop'` ("Hủy đổi buổi/học bù do chuyển lớp", nhóm học tập) thay cho `duyet_doi_buoi`. Dòng ghi trước thay đổi này (trên prod từ lúc deploy #35) vẫn là `duyet_doi_buoi` với `chi_tiet.tu_dong_chuyen_lop=true`.
  - **Lịch sử cấu hình khóa**: mọi PATCH khóa có đổi ghi `cap_nhat_cau_hinh_khoa` (trường, cũ → mới); Quản trị xem ở tab "Lịch sử cấu hình" trang chi tiết khóa (`GET /khoa-boi-duong/{id}/lich-su-cau-hinh`). Biết được nấc chuyên cần ở từng thời điểm. Các lần đổi cấu hình trước thay đổi này không có lịch sử.
- **Bảng điểm danh lớp và trang lớp dùng `tinhChuyenCan` (2026-10-23, không migration, chỉ đọc)**: trước đó `DiemDanhService.bangDiemDanh` (`GET /lop/{lopId}/diem-danh`) và `trang-lop.service` chỉ đọc `diem_danh` của buổi thuộc lớp đang xem, nên học viên chuyển A → B thấy trống ở các buổi đã có mặt tại A. Nay buổi chưa có dòng tại lớp đang xem được điền từ kết quả `tinhChuyenCan` theo nấc của khóa nếu kết quả đến từ lớp khác, gắn nhãn "Có mặt – ở lớp X" và **chỉ đọc** (`nguon_tinh: 'lop_khac'`, `sua_duoc: false`); dòng ở lớp cũ không bị ghi đè. Một chỗ tính duy nhất (C4) nay gồm cả 2 màn này.
