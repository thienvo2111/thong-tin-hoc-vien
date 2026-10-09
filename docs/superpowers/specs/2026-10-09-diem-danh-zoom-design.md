# Điểm danh lớp Zoom bằng cú bấm — đặc tả

- Ngày: 2026-10-09
- Trạng thái: Đã thống nhất (phiên grill 2026-10-09), chưa code
- ADR: [`docs/adr/0005-diem-danh-zoom-bang-cu-bam.md`](../../adr/0005-diem-danh-zoom-bang-cu-bam.md)
- Tham chiếu: training-system `backend/src/routes/sessions.routes.ts` (`self-checkin`, cửa sổ −30' → kết thúc buổi; tính bằng `date + setHours` theo giờ máy chủ — **không** chép phần này, ở đây dùng `thoi_gian_bat_dau` timestamptz)

## 1. Bối cảnh

- Mỗi buổi là 1 dòng `lich_hoc_lop` có `thoi_gian_bat_dau`/`thoi_gian_ket_thuc` (timestamptz) và `dia_diem_hoac_link` riêng.
- `diem_danh` (T12) unique `(dang_ky_hoc_id, lich_hoc_id)`, trạng thái `co_mat|vang|vang_co_phep`, nguồn `zoom|ky_ten|qr|thu_cong` — hiện chỉ nhập qua import Excel.
- Nút "Vào học" ở trang lớp học viên (`frontend/src/pages/M7/ThongTinLopHoc.tsx`) là `<a href>` thẳng tới link Zoom, không qua backend. Đăng nhập dùng Bearer token → không làm được "GET rồi redirect" như training-system.
- Thống kê chuyên cần (`ThongKeService.diemDanhTheoBuoi`) chỉ đếm dòng đã có và gom theo `GĐ·buổi số` không tách lớp.
- Email lịch học (`ThongBaoService.guiDangKyHocPhanLop`) chỉ phát sinh khi Quản trị **import phân lớp** và học viên có lớp trực tiếp; nội dung liệt kê cả link Zoom. Cron `HangDoiEmailProcessor` chỉ xả hàng đợi, **không** gửi theo giờ. Tin nhắn nhắc lịch Zalo (`soanTinNhanCum`) không chứa link.

## 2. Phạm vi

- Chỉ lớp `loai_lop = zoom`, chỉ khi khóa đã bật (`khoa_boi_duong.bat_diem_danh_zoom_luc IS NOT NULL`). Khóa chưa bật: hành vi giữ nguyên như hiện nay.
- Lớp trực tiếp: điểm danh giấy rồi import như cũ. Không làm QR.
- Học viên được điểm danh 1 buổi ⇔ có `phan_lop_giai_doan` khớp `(lop_id, giai_doan_id)` của buổi. Sai → 403.

## 3. Cửa sổ điểm danh

- `mo = thoi_gian_bat_dau − khoa.diem_danh_mo_truoc_phut` (mặc định 30, hợp lệ 0–180)
- `dong = thoi_gian_bat_dau + khoa.diem_danh_dong_sau_phut` (mặc định 120, hợp lệ 15–720) — **không** cắt theo `thoi_gian_ket_thuc`.
- Tính theo **giờ máy chủ**, luôn theo cấu hình hiện tại của khóa và giờ hiện tại của buổi (đổi lịch/cấu hình có hiệu lực ngay với buổi chưa chốt).
- 1 hàm thuần duy nhất `tinhCuaSoDiemDanh(buoi, khoa, now) → { mo, dong, pha: 'chua_mo' | 'dang_mo' | 'da_dong' }`, dùng chung cho API vào học, API trang lớp, cron chốt.

## 4. Học viên bấm "Điểm danh & vào Zoom"

`POST /lich-hoc/:id/vao-hoc` (vai trò `hoc_vien`):

| Pha | Ghi dữ liệu | Trả về | Hộp thoại FE |
|---|---|---|---|
| `chua_mo` | không | `{ ket_qua: 'chua_mo', mo }`, **không** có link | ⏳ "Chưa đến thời gian điểm danh — mở lúc HH:mm." Chỉ nút [Đóng] |
| `dang_mo`, chưa có dòng | tạo `co_mat`, `nguon = zoom`, `tu_diem_danh_luc = now` | `{ ket_qua: 'da_ghi_nhan', luc, link }` | ✅ "Đã điểm danh buổi N lúc HH:mm." [Mở phòng Zoom] |
| `dang_mo`, đã có dòng | không ghi đè | `{ ket_qua: 'da_co', trang_thai, luc, link }` | ℹ️ "Bạn đã điểm danh buổi này lúc HH:mm." [Mở phòng Zoom] |
| `da_dong` | không | `{ ket_qua: 'qua_gio', dong, link }` | ⚠️ "Đã quá thời gian điểm danh (đóng lúc HH:mm) nên lượt vào này không được ghi nhận." [Vẫn vào Zoom] |

- Tạo dòng dùng `createMany … skipDuplicates` / bắt lỗi unique → bấm nhiều lần, 2 tab cùng lúc vẫn idempotent.
- Báo vắng không chặn: bấm vẫn ghi `co_mat` ("có mặt luôn thắng", `hopNhatDiemDanh`).
- Mở Zoom bằng cú bấm thứ 2 trong hộp thoại (tránh trình duyệt di động/Zalo chặn `window.open` sau `await`).
- Buổi chưa có `dia_diem_hoac_link` → không có nút.

## 5. Giấu link Zoom với học viên (khóa đã bật)

- API trang lớp của học viên **không** trả `dia_diem_hoac_link` cho buổi lớp Zoom; trả thêm `diem_danh_zoom: { mo, dong, pha, trang_thai, tu_diem_danh_luc }`.
- Ẩn nút "Mở liên kết" cấp giai đoạn (`gd.link_hoac_dia_diem`) với giai đoạn mà học viên ở lớp Zoom đã có buổi.
- Email lịch học: buổi Zoom thay link bằng "Vào học và điểm danh bằng nút trên Cổng thông tin" + `linkLopHoc`.
- Giảng viên, hỗ trợ GV/HV, Quản trị vẫn thấy link như cũ.
- Đã biết: không chặn được chia sẻ link sau khi vào phòng (Zoom "Copy Invite Link"), email cũ đã gửi vẫn có link. Cú bấm là **tín hiệu tự khai**; báo cáo người tham gia Zoom (import) là nguồn đối chiếu.

## 6. Chốt vắng tự động

- Cron mỗi 5 phút (`@nestjs/schedule`, đã có `ScheduleModule`). Chọn buổi thỏa:
  - lớp `zoom`, khóa đã bật, `thoi_gian_bat_dau >= khoa.bat_diem_danh_zoom_luc`;
  - `dia_diem_hoac_link` khác rỗng (buổi quên nhập link **không** chốt → tránh cả lớp bị vắng);
  - `now > dong` và `chot_diem_danh_luc IS NULL`.
- Với mỗi buổi, trong 1 transaction: học viên của lớp ở giai đoạn đó (qua `phan_lop_giai_doan`) chưa có dòng → tạo `vang` (`vang_co_phep` nếu có `bao_vang`), `nguon = zoom`; set `chot_diem_danh_luc = now` (UPDATE có điều kiện `IS NULL` — chạy song song không chốt 2 lần).
- Không ném lỗi ra ngoài (như `HangDoiEmailProcessor`): log rồi chạy lượt sau.
- Học viên xếp lớp sau khi buổi đã chốt → không có dòng ("chưa có dữ liệu").
- Tắt tính năng ở khóa → cron dừng chốt; dữ liệu đã ghi giữ nguyên.

## 7. Sửa điểm danh

- **Import Excel** (Quản trị / hỗ trợ GV như hiện tại) **luôn ghi đè** trạng thái và nguồn; **không** xóa `tu_diem_danh_luc`.
- **Sửa nhanh từng ô** trên bảng điểm danh của lớp — giữ ADR 0004:
  - `ho_tro_giang_vien` trong khóa của nhóm: buổi có `thoi_gian_bat_dau` trong vòng **3 ngày** trước now;
  - `quan_tri`: mọi lúc;
  - `giang_vien`: chỉ đọc (G8); `ho_tro_hoc_vien`: chỉ báo vắng (G13).
- Sửa nhanh ghi `nguon = thu_cong`, `nguoi_sua = user.id`, `cap_nhat_luc = now`, ghi chú tùy chọn.
- Tương tác G12 ADR 0004: hỗ trợ GV không đổi giờ buổi đã có điểm danh (400) → với tự điểm danh, buổi bị "khóa giờ" từ lúc học viên đầu tiên bấm (≈ 30' trước giờ học). Chấp nhận.

## 8. Chuyển lớp Zoom & chuyên cần

- **Không bao giờ xóa** điểm danh ở lớp cũ khi chuyển lớp (3 đường: sửa phân lớp lẻ, import phân lớp, duyệt đề nghị đổi lớp — hiện không đường nào đụng `diem_danh`, giữ nguyên).
- Giả định đã xác nhận: các lớp Zoom cùng giai đoạn dạy cùng nội dung theo `buoi_so`.
- 1 hàm duy nhất tính chuyên cần theo `(giai_doan, buoi_so)` của 1 đăng ký, chế độ `khoa.che_do_chuyen_can`:
  - `theo_lop_hien_tai` (mặc định): chỉ dòng thuộc buổi của lớp hiện tại ở giai đoạn đó;
  - `cong_nhan_lop_cu`: kết quả tốt nhất (`co_mat` > `vang_co_phep` > `vang`) giữa mọi lớp đăng ký đó có dòng ở giai đoạn đó.
- Dashboard chuyên cần dùng hàm này → mỗi học viên đếm **1 lần** mỗi `(giai_doan, buoi_so)` (sửa lỗi đếm 2 lần hiện tại).
- Trang lớp học viên: buổi có dòng ở lớp cũ hiện dòng nhỏ "Buổi N: đã có mặt ở lớp X (lớp cũ)".

## 9. Nhắc học viên & cảnh báo vận hành

- Nút đổi tên **"Điểm danh & vào Zoom"**.
- Khung cảnh báo vàng cố định trên khối lịch Zoom: "⚠️ **Bắt buộc điểm danh từng buổi.** Mỗi buổi học, hãy bấm nút *Điểm danh & vào Zoom* của đúng buổi đó (mở trước giờ học {X} phút, đóng sau giờ bắt đầu {Y}). Vào Zoom bằng link khác hoặc ở lại phòng từ buổi trước sẽ **không được ghi nhận** và bị tính vắng."
- Nhãn trạng thái mỗi thẻ buổi: "Điểm danh mở lúc HH:mm" / "Đang mở điểm danh" / "✅ Đã điểm danh HH:mm" / "Đã đóng điểm danh" / "Vắng".
- Đã điểm danh buổi khác cùng ngày → nhắc "Buổi này cũng cần bấm điểm danh, kể cả khi bạn vẫn đang ở trong phòng Zoom."
- Tin nhắn nhắc lịch Zalo cụm: thêm dòng "Nhớ bấm *Điểm danh & vào Zoom* trên Cổng thông tin cho từng buổi." (không link).
- Hướng dẫn học viên (`frontend/src/content/huongDan.ts`, `docs/huong-dan-hoc-vien.html`): mục "Điểm danh lớp Zoom" + FAQ (quên bấm, vào bằng link cũ, ở lại phòng sang buổi chiều).
- Quản trị/hỗ trợ GV — chi tiết khóa: cảnh báo "N buổi Zoom sắp diễn ra chưa có link"; khi tạo/sửa buổi mà 2 buổi cùng lớp có cửa sổ chồng nhau → cảnh báo, không chặn.

## 10. Dữ liệu (migration — chỉ thêm)

| Bảng | Cột | Kiểu |
|---|---|---|
| `diem_danh` | `tu_diem_danh_luc` | timestamptz NULL |
| `diem_danh` | `nguoi_sua` | uuid NULL → `nguoi_dung` (SET NULL) |
| `lich_hoc_lop` | `chot_diem_danh_luc` | timestamptz NULL |
| `khoa_boi_duong` | `bat_diem_danh_zoom_luc` | timestamptz NULL |
| `khoa_boi_duong` | `diem_danh_mo_truoc_phut` | smallint NOT NULL DEFAULT 30, CHECK 0–180 |
| `khoa_boi_duong` | `diem_danh_dong_sau_phut` | smallint NOT NULL DEFAULT 120, CHECK 15–720 |
| `khoa_boi_duong` | `che_do_chuyen_can` | enum mới `che_do_chuyen_can (theo_lop_hien_tai, cong_nhan_lop_cu)` NOT NULL DEFAULT `theo_lop_hien_tai` |

Enum mới → `CREATE TYPE` cùng migration được. Không sửa/xóa dữ liệu cũ; backup trước deploy theo quy trình.

## 11. Triển khai

- Deploy không ảnh hưởng khóa nào (mặc định tắt). Hiện chưa khóa nào tới giai đoạn Zoom.
- **Tiên quyết trước khi bật trên prod:** `timedatectl` trên VPS phải `NTP synchronized: yes` (VPS từng lệch ~1 giờ). Thêm bước kiểm tra vào script deploy.

## 12. Kiểm thử (theo yêu cầu)

- `tinhCuaSoDiemDanh`: biên `mo`/`dong` đúng tới giây, cấu hình khác mặc định, buổi ngắn hơn cửa sổ, múi giờ (server UTC, buổi giờ VN).
- Vào học: 4 pha; bấm 2 lần; 2 request song song; không thuộc lớp → 403; lớp không phải Zoom / khóa chưa bật → 400; buổi không link; có báo vắng vẫn `co_mat`.
- Giấu link: học viên không nhận link ở trang lớp/email khi bật; nhân sự vẫn nhận; khóa tắt → như cũ.
- Chốt: chỉ buổi đủ điều kiện; `vang` vs `vang_co_phep`; không đè dòng đã có; không chốt 2 lần; buổi trước mốc bật; buổi không link; học viên xếp muộn.
- Sửa nhanh: hỗ trợ GV trong/ngoài 3 ngày, ngoài khóa → 403; giảng viên/hỗ trợ HV → 403; Quản trị mọi lúc; ghi `nguoi_sua`.
- Import ghi đè dòng tự điểm danh, giữ `tu_diem_danh_luc`.
- Chuyên cần 2 chế độ với học viên chuyển lớp; dashboard không đếm 2 lần.
- Sáng/chiều cùng link: điểm danh độc lập theo buổi.
