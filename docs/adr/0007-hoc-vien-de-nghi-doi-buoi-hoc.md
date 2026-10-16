# ADR 0007 — Học viên tự đề nghị đổi từng buổi học, người hỗ trợ cụm duyệt theo hàng đợi

- Ngày: 2026-10-16
- Trạng thái: Đã chấp nhận
- Bổ sung (không thay thế): ADR 0004 G14 — đề nghị đổi lớp **cả giai đoạn** (`de_nghi_doi_lop`) giữ nguyên
- Đặc tả: [2026-10-16-doi-buoi-hoc-design.md](../superpowers/specs/2026-10-16-doi-buoi-hoc-design.md)

## Bối cảnh

Học viên thường bận đúng một buổi chứ không phải cả giai đoạn. Hiện chỉ có hai cách xử lý: người hỗ trợ cụm tạo đề nghị đổi lớp cả giai đoạn (G14, quá nặng), hoặc học viên tự đến lớp khác và bị ghi "học bù" khi nạp điểm danh (không ai kiểm soát sĩ số). Cần cho học viên tự đề nghị đổi **một buổi** sang buổi tương đương của lớp khác, có người duyệt dựa trên sĩ số, nhưng không để thành chức năng ai cũng bấm.

## Quyết định

| # | Quyết định |
|---|---|
| D1 | **Đổi buổi ≠ đổi lớp.** Bảng mới `doi_buoi_hoc` (1 dòng = 1 buổi). Duyệt **không** sửa `phan_lop_giai_doan`; học viên vẫn thuộc lớp gốc. Danh sách 1 buổi = phân lớp − đổi ra + đổi vào (chỉ `da_duyet`). |
| D2 | **Buổi tương đương**: cùng khóa, cùng giai đoạn, cùng `buoi_so`, lớp cùng `loai_lop` và cùng `muc_nang_luc`, khác lớp. Buổi nguồn và buổi đích phải **chưa bắt đầu** (`thoi_gian_bat_dau > now()`) cả khi gửi lẫn khi duyệt. |
| D3 | **Người duyệt**: Quản trị (mọi đề nghị) và người hỗ trợ học viên của cụm chứa học viên (ADR 0003). Hỗ trợ GV không duyệt đổi buổi (khác G14) — người hỗ trợ cụm là người liên lạc Zalo được với học viên để trao đổi, chốt lịch khác. |
| D4 | **Sĩ số theo buổi** là chặn cứng với người hỗ trợ cụm: buổi đầy không duyệt được, phải chốt sang buổi tương đương khác còn chỗ (`lich_chot_id` có thể khác buổi học viên đề nghị). Quản trị được duyệt vượt, kèm cảnh báo và ghi nhật ký. Học viên không chọn được buổi đã đầy. |
| D5 | **Hàng đợi theo thời điểm gửi** (`tao_luc`): duyệt đề nghị R vào buổi X chỉ khi số chỗ trống của X **lớn hơn** số đề nghị đang chờ vào X gửi trước R (giữ chỗ cho người gửi trước). Buổi dư chỗ → người sau vẫn duyệt ngay, không bị kẹt bởi cụm khác. Quản trị được vượt thứ tự, kèm cảnh báo. Kiểm tra + duyệt trong 1 transaction có `pg_advisory_xact_lock` theo buổi chốt. |
| D6 | **Sửa đề nghị = hủy + tạo mới** trong 1 transaction → `tao_luc` mới, học viên về **cuối hàng**. Đề nghị cũ `da_huy` không tính lượt. |
| D7 | **Quá hạn** (buổi đã bắt đầu khi còn `cho_duyet`) tính lúc đọc, không lưu trạng thái, không cron; không duyệt được, không tính vào hàng đợi. |
| D8 | **Giới hạn và công tắc chung một cột**: `khoa_boi_duong.so_buoi_doi_toi_da` (mặc định 0 = tắt). Lượt = số đề nghị `cho_duyet` + `da_duyet` của đăng ký trong khóa; từ chối/hủy trả lượt. |
| D9 | **Lối vào kín đáo**: dòng chữ nhỏ "Không tham gia được buổi này?" trong chi tiết buổi + trang `/de-nghi-doi-buoi` không có trong menu (người hỗ trợ gửi link). Không nút nổi bật, không thông báo chủ động. |
| D10 | **Hiển thị minh bạch** cho cả học viên và người duyệt: mỗi buổi đích kèm sĩ số hiện tại/tối đa và số đề nghị đang chờ vào buổi đó; đề nghị đang chờ kèm thứ tự trong hàng. |

## Phương án đã loại

- **Mở rộng `de_nghi_doi_lop` thêm `lich_hoc_id`** — một bảng hai nghĩa (duyệt thì sửa phân lớp hay không), khác người duyệt, mọi truy vấn phải rẽ nhánh.
- **Duyệt = ghi sẵn dòng `diem_danh`** — lẫn dữ liệu đổi buổi với điểm danh thật; import điểm danh ghi đè.
- **Vượt sĩ số chỉ cảnh báo (như G14)** — lớp phổ biến bị dồn quá tải do học viên tự gửi hàng loạt.
- **Hàng đợi tuyệt đối (phải xử lý hết người trước)** — một người hỗ trợ cụm chậm làm kẹt mọi cụm khác dù buổi còn chỗ.
- **Không giới hạn lượt** — học viên điều chỉnh tràn lan; người duyệt quá tải.

## Hệ quả

- 1 migration chỉ thêm (bảng `doi_buoi_hoc`, cột `so_buoi_doi_toi_da` default 0); không đổi dữ liệu cũ; sau deploy mọi khóa đều tắt.
- Các nơi đọc danh sách học viên theo **buổi** (trang lớp, mẫu/nạp điểm danh, lịch và nhắc lịch cụm, trang học viên) phải đi qua module `doi-buoi-hoc`. Nơi đọc theo **lớp** (sĩ số lớp, báo cáo, email xếp lớp, SSO, Excel chia lớp) không đổi.
- Nạp điểm danh: học viên đã được duyệt đổi vào buổi không còn bị coi là học bù.
- Đổi buổi được duyệt sau lần nhắc lịch cuối của cụm → bật cờ "Cần nhắc lại" (như G11).
- Sĩ số "theo buổi" có thể khác sĩ số "theo lớp" — giao diện phải ghi rõ đang hiện loại nào.
- Các đường đọc phát sinh thêm khi triển khai (đều đi qua `DoiBuoiHocQueryService`): vào học Zoom (học viên đổi vào buổi chốt được vào phòng), chuyên cần/tiến độ (tính điểm danh ở buổi chốt thay buổi nguồn), báo vắng (nhận buổi chốt), chốt vắng Zoom tự động (bỏ qua người đổi ra, tính người đổi vào). Trang lớp và bảng điểm danh trả người đổi vào ở danh sách riêng `hoc_vien_doi_vao`.
