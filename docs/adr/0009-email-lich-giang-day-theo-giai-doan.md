# ADR 0009 — Email lịch giảng dạy theo giai đoạn – khóa, gửi bằng nút bấm

- Ngày: 2026-10-17
- Trạng thái: Đã chấp nhận (2026-10-17)
- Bổ sung (không thay thế): ADR 0004 G10/G11 — tin nhắn Zalo soạn sẵn + "Đã gửi" giữ nguyên; ADR này làm phần "Email nhắc = để sau" của G10
- Đặc tả: [2026-10-17-email-lich-giang-day-design.md](../superpowers/specs/2026-10-17-email-lich-giang-day-design.md)
- Mẫu email đã duyệt: `design/mau-email/5a-lich-day-giang-vien.html`, `design/mau-email/5b-lich-day-giang-vien-cap-nhat.html`

## Bối cảnh

Hiện người hỗ trợ giảng viên nhắc lịch bằng cách sao chép tin nhắn cho từng (lớp × giai đoạn trực tiếp × giảng viên), dán vào Zalo/SMS rồi bấm "Đã gửi". Một giảng viên dạy nhiều lớp trong cùng giai đoạn sẽ nhận nhiều tin rời rạc, còn lớp Zoom thì không có tin nhắn nào. Cần gửi cho mỗi giảng viên **một email chính thức** chứa toàn bộ lịch dạy của họ trong một giai đoạn của khóa. Email chỉ gửi khi cán bộ bấm nút.

## Quyết định

| # | Quyết định |
|---|---|
| E1 | **Đơn vị gửi = (khóa × giai đoạn × giảng viên).** Mỗi email gom **mọi buổi** giảng viên được phân công (`phan_cong_giang_day`) trong giai đoạn đó, qua **mọi lớp** của khóa, ở mọi hình thức có buổi (trực tiếp, Zoom). Nhóm theo lớp, trong lớp xếp theo giờ bắt đầu. |
| E2 | **Chỉ gửi thủ công, không cron.** Người bấm là `ho_tro_giang_vien` trong nhóm của khóa (phạm vi `HoTroGiangVienScopeService`). Họ chọn giai đoạn và tích chọn giảng viên, xác nhận, rồi email được xếp vào hàng đợi. Quản trị không có nút ở v1 (ADR 0004: nhắc giảng viên là việc của nhóm hỗ trợ GV). |
| E3 | **Đi làn "hàng loạt" (`hang_doi_email`)**, chịu `EMAIL_DAILY_LIMIT` như mọi email hàng loạt. Thêm giá trị enum `loai_su_kien_thong_bao.nhac_lich_giang_vien` trong một migration riêng. |
| E4 | **Một lần gửi email = một dòng `nhat_ky_nhac_lich`** (`doi_tuong = giang_vien`, `lich_hoc_ids` = các buổi trong email, `noi_dung` = tiêu đề kèm bản text tóm tắt). Thêm cột `hang_doi_email_id` (nullable, FK) để phân biệt kênh email và tra trạng thái gửi thật. Nhờ vậy cờ chưa nhắc / cần nhắc lại / đã nhắc (G11) và mục bảng kiểm `da_nhac_giang_vien` dùng chung, không phải sửa logic. Nhật ký được ghi **lúc xếp hàng**, không chờ SMTP. |
| E5 | **Bản cập nhật (mẫu 5b)** được dùng khi giảng viên đã có ≥1 email trước đó chứa buổi của giai đoạn này. Buổi được gắn huy hiệu "Có thay đổi" nếu `cap_nhat_luc` > lần email cuối, hoặc nếu buổi đó chưa có trong email cuối. Buổi có trong email cuối nhưng giảng viên không còn dạy thì liệt kê ở khối "Không còn trong lịch của Thầy/Cô". |
| E6 | **Không có email → không gửi, không chặn cả lô.** Trả về danh sách bị bỏ qua kèm lý do. Nút "Xem lịch dạy trên Cổng giảng viên" chỉ hiện khi giảng viên có tài khoản `giang_vien` đang hoạt động. |
| E7 | Câu chữ cố định trong code (như mọi mẫu email khác), mọi dữ liệu động đều qua `e()`, liên kết chỉ nhận `http(s)` (`laLienKet`). |

## Phương án đã loại

- **Một email cho mỗi (lớp × giai đoạn)**: giảng viên dạy 3 lớp sẽ nhận 3 email, trái yêu cầu "theo giai đoạn – theo khóa".
- **Cron tự gửi trước N ngày**: người dùng yêu cầu bấm tay. Lịch thường còn bị sửa sát ngày, gửi tự động dễ phát lịch sai.
- **Bảng nhật ký email riêng**: sẽ trùng với `nhat_ky_nhac_lich` và phải viết lại logic "cần nhắc lại" lẫn bảng kiểm.
- **Gửi ngay (làn ưu tiên cao)**: lô vài chục giảng viên có thể làm cạn hạn mức SMTP vốn dành cho email bảo mật.

## Hệ quả

- Migration (chỉ thêm, không đổi dữ liệu): (1) `ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'nhac_lich_giang_vien'` (riêng); (2) `ALTER TABLE nhat_ky_nhac_lich ADD COLUMN hang_doi_email_id uuid NULL REFERENCES hang_doi_email(id)`.
- "Đã nhắc" nghĩa là **đã xếp hàng**. Nếu SMTP lỗi hẳn, nhật ký vẫn còn, nhưng trang gửi hiện trạng thái `that_bai` của dòng hàng đợi để cán bộ gửi lại.
- Email cũng gửi được cho giai đoạn Zoom. Tin nhắn Zalo (G10) vẫn chỉ cho đợt trực tiếp như cũ.
- Giao diện: trang `/ho-tro-gv/gui-lich-day` (menu **Gửi lịch dạy**). Hướng dẫn: `docs/huong-dan-gui-lich-day-giang-vien.md`. Thêm `GET /ho-tro-giang-vien/khoa` cho ô chọn khóa/giai đoạn; `bo_qua.ly_do` có thêm `loi_he_thong`.

## Triển khai

- 2 migration **chỉ thêm**: `20261017100000_su_kien_nhac_lich_giang_vien` (enum) → `20261017100100_nhac_lich_hang_doi_email` (cột nullable + index + FK). Không UPDATE/DELETE dòng nào; số dòng mọi bảng không đổi.
- Trước `prisma migrate deploy`: backup `pg_dump` (mật khẩu lấy từ `DATABASE_URL` trong `backend/.env`).
- Sau deploy: email chỉ phát sinh khi người hỗ trợ GV bấm **Gửi**. Không có cron mới; `HangDoiEmailProcessor` hiện có sẽ gửi các dòng `nhac_lich_giang_vien`.
