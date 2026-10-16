# Hướng dẫn đội hỗ trợ — Duyệt đề nghị đổi buổi học

Dành cho **người hỗ trợ học viên (cụm)** và **Quản trị**. Quyết định nền: ADR 0007.

## 1. Nguyên tắc

- Học viên đề nghị học **một buổi** ở lớp khác thay cho buổi của lớp mình. Học viên **vẫn thuộc lớp gốc**; chỉ buổi đó đổi.
- Buổi đích phải **tương đương**: cùng khóa, cùng giai đoạn, cùng số buổi, cùng hình thức lớp, cùng mức; **chưa bắt đầu**.
- **Sĩ số buổi** = số học viên phân vào lớp − người đã đổi ra + người đã đổi vào (chỉ tính đề nghị đã duyệt).
- **Hàng chờ theo thời điểm gửi**: đề nghị gửi trước được giữ chỗ trước. Học viên **sửa** đề nghị thì về cuối hàng.
- **Ai duyệt**: người hỗ trợ cụm duyệt học viên **thuộc cụm mình**; Quản trị duyệt **mọi** đề nghị.
- **Lượt**: mỗi khóa có số lượt tối đa/học viên; từ chối hoặc hủy thì trả lượt.

## 2. Bật chức năng cho một khóa (chỉ Quản trị)

1. Menu **Khóa bồi dưỡng** → mở khóa → ô **Số buổi tối đa học viên được đề nghị đổi (0 = tắt)**.
2. Nhập số lượt (ví dụ `1` hoặc `2`) → **Lưu số buổi đổi**. Nhập `0` để tắt.
3. Báo người hỗ trợ cụm trước khi bật. Chức năng **không có nút nổi bật** cho học viên — chỉ có dòng chữ nhỏ
   *Không tham gia được buổi này?* dưới từng buổi và đường link `/de-nghi-doi-buoi` (gửi khi học viên hỏi).

## 3. Duyệt đề nghị

Màn hình: người hỗ trợ cụm → menu **Đổi buổi** (số trên menu = số đề nghị đang chờ); Quản trị → menu **Đổi buổi** (🔁).

### Tab **Chờ duyệt**

Sắp theo thời điểm gửi (cũ nhất trước). Mỗi dòng: học viên (đơn vị, cụm), buổi gốc → buổi đề nghị, lý do, thời điểm gửi,
**Thứ tự gửi** `k/n` (vị trí trong hàng chờ của buổi đề nghị), sĩ số buổi đề nghị và số đang chờ.

1. Bấm **Duyệt** → cửa sổ **Chọn buổi chốt** liệt kê mọi buổi tương đương còn chưa bắt đầu, kèm sĩ số, *+n đang chờ*,
   số đề nghị *gửi trước*. Buổi học viên đề nghị được chọn sẵn.
2. Buổi không duyệt được hiện lý do:
   - **Đã đủ** — buổi đã đủ sĩ số.
   - **Giữ chỗ cho đề nghị gửi trước** — chỗ còn lại đang giữ cho người gửi trước; xử lý đề nghị của họ trước.
   - Nếu buổi học viên đề nghị không duyệt được: *Buổi đề nghị không duyệt được — chọn buổi khác*.
3. Buổi đề nghị đã đủ → **trao đổi với học viên qua Zalo**, chọn **buổi khác phù hợp** trong danh sách rồi duyệt
   (học viên sẽ thấy buổi được chốt).
4. Ghi chú (không bắt buộc) → **Xác nhận duyệt**.

**Từ chối**: bấm **Từ chối**, ghi chú bắt buộc (5–500 ký tự, học viên đọc được) → **Gửi từ chối**.

**Quá hạn**: đề nghị mà buổi đã bắt đầu nằm ở mục **Quá hạn** — không duyệt được nữa, chỉ **Từ chối** để đóng.

### Tab **Đã xử lý**

Xem đề nghị đã duyệt / từ chối / hủy, buổi chốt, người xử lý, ghi chú.
**Hủy duyệt**: chỉ khi cả buổi gốc và buổi chốt chưa bắt đầu; ghi chú bắt buộc. Nếu buổi gốc đã đủ sĩ số
thì người hỗ trợ cụm **không hủy được** (Quản trị vẫn làm được, kèm cảnh báo).

### Quyền riêng của Quản trị

Quản trị **được duyệt vượt** sĩ số hoặc vượt thứ tự hàng chờ — lựa chọn hiện cảnh báo vàng
*Vượt sĩ số / thứ tự — chỉ Quản trị*. Chỉ dùng khi đã cân nhắc (ví dụ lớp đích còn chỗ ngồi thực tế).

## 4. Sau khi duyệt — hệ thống tự cập nhật

| Nơi | Thay đổi |
|---|---|
| Lịch của học viên | Buổi đổi hiện giờ/địa điểm buổi mới, nhãn **Đã đổi buổi** |
| Trang lớp (hỗ trợ GV, giảng viên) | Buổi đích: học viên đổi vào, nhãn *Từ {lớp}*; buổi gốc: nhãn *Đổi sang {lớp}*; **Sĩ số buổi** |
| Bảng điểm danh | Phần **Học viên đổi buổi vào lớp**: chỉ ô buổi chốt sửa được |
| Nạp điểm danh Excel | Học viên ghi ở buổi chốt **không bị báo học bù** |
| Vào học Zoom / báo vắng | Học viên điểm danh, báo vắng được ở buổi chốt |
| Chuyên cần | Có mặt ở buổi chốt được tính thay buổi gốc |
| Nhắc lịch cụm | Tin nhắn có dòng "{họ tên} học buổi n tại {lớp}"; duyệt sau lần nhắc cuối → cờ **Cần nhắc lại** |

Sĩ số **theo lớp** (trang khóa, báo cáo, Excel chia lớp) **không đổi** — học viên vẫn thuộc lớp gốc.

## 5. Tình huống thường gặp

| Tình huống | Xử lý |
|---|---|
| Học viên không thấy dòng *Không tham gia được buổi này?* | Khóa chưa bật (số lượt = 0) hoặc buổi đã bắt đầu. Gửi link `/de-nghi-doi-buoi`; nếu báo *Khóa học chưa mở đề nghị đổi buổi* thì nhờ Quản trị bật. |
| Học viên hết lượt | Từ chối/hủy đề nghị không cần thiết để trả lượt, hoặc nhờ Quản trị tăng số lượt của khóa. |
| Hai người cùng duyệt một đề nghị | Chỉ một người thành công; người kia nhận *Đề nghị đã được xử lý*. |
| Báo *Phân lớp của học viên đã thay đổi — hãy từ chối* | Học viên vừa được chuyển lớp; từ chối, nhờ học viên gửi lại nếu cần. |
| Cần đổi buổi hàng loạt theo danh sách (học viên chưa gửi) | Hiện chưa có nút trên giao diện — gửi danh sách mã + lớp/buổi cho Quản trị kỹ thuật xử lý bằng SQL (mẫu: `data/2026-10-16-doi-buoi-khung-dot2-thanh-thao.sql`). |
| Xem danh sách đề nghị chờ toàn hệ thống | Quản trị: trang **Vận hành** có khối *Đề nghị đổi buổi chờ duyệt*. |
