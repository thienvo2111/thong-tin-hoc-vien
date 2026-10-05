# Đặc tả màn hình — Cổng học viên (đợt xác nhận hồ sơ & đánh giá đầu vào)

> Đặt tại `docs/dac-ta-cong-hoc-vien.md`. API tham chiếu: `api-contract.md` và `mo-rong-nls-an-giang.md` (T1, T9, T14, T15).
> Ngày lập: 2026-09-28.

## Thứ tự làm

| Ưu tiên | Màn hình | Cần cho |
|---|---|---|
| 1 | M0 Trang giới thiệu — **bản tối thiểu** (mục 1, 6, 7, 8 bên dưới) | Mở đợt 1 (link gửi qua Zalo trỏ vào đây) |
| 1 | M1 Đăng nhập · M2 Đổi mật khẩu lần đầu | Mở đợt 1 |
| 2 | M3 Trang chính (trạng thái) | Mở đợt 1 |
| 3 | M4 Hồ sơ – xem & sửa | Mở đợt 1 |
| 4 | M5 Xem lại & xác nhận | Mở đợt 1 |
| 5 | M6 Làm bài đánh giá đầu vào | Mở đợt 2 (05/10) |
| 6 | M0 Trang giới thiệu — **bản đầy đủ** (mục 2–5, 9) | Sau 05/10, khi có nội dung chính thức |

**Route:** `/` = M0 (công khai) · `/dang-nhap` = M1 · `/doi-mat-khau` = M2 · `/toi` = M3 · `/toi/ho-so` = M4 · `/toi/xac-nhan` = M5 · `/toi/danh-gia-dau-vao` = M6 · `/huong-dan` = M9 (công khai).

Mọi màn hình sau đăng nhập có thanh trên: tên học viên, nút "Đăng xuất", email hỗ trợ (`EMAIL_HO_TRO` trong `src/content/hoTro.ts`), mục "Hướng dẫn" (M9).

### Chế độ triển khai (cập nhật 2026-10-02)

Quản trị cấu hình tại **`/admin/cau-hinh-khao-sat`** (menu "Cấu hình khảo sát", API `GET`/`PUT /cau-hinh-khao-sat` — `api-contract.md` mục 9): chọn chế độ, bật/tắt menu M6, bật/tắt khối khảo sát, nhập danh sách phiếu + đường dẫn (thêm/xóa/đổi thứ tự, nhiều đường dẫn/phiếu khi tách theo đối tượng). Có hiệu lực ngay, không cần deploy. Khi chưa lưu lần nào hoặc API lỗi, frontend dùng giá trị mặc định trong `frontend/src/content/trienKhai.ts`. Phần chữ của khối (tiêu đề, mô tả, "Sau khi hoàn thành khảo sát") vẫn ở `gioiThieu.khaoSatDauVao`.

| Kịch bản | `cheDoHocVien` | `danhGiaDauVaoTrongCong` | Hành vi |
|---|---|---|---|
| **GĐ1 "khảo sát trước"** (An Giang hiện tại) | `khao_sat` | `false` | Học viên **không đăng nhập**. M0 hiện khối "Khảo sát đầu vào" với các phiếu làm **tuần tự** (Phiếu 1: khảo sát kĩ năng số → Phiếu 2: đánh giá năng lực số); học viên kê khai/bổ sung thông tin ngay trong phiếu. M1 hiện thông báo "Học viên chưa cần đăng nhập" (form vẫn dùng cho quản trị). |
| **GĐ2 sau khi đổ dữ liệu** | `dang_nhap` | `false` | Học viên đăng nhập để **xem** hồ sơ + lớp học. Không mở Đợt xác nhận → hồ sơ `import_moet` chỉ xem. Menu M6 ẩn. Giai đoạn kết quả cuối: mở Đợt xác nhận để học viên điều chỉnh. |
| **Địa phương bổ sung thông tin trên hệ thống trước đánh giá** | `dang_nhap` | `true` | Luồng gốc M1 → M5 → M6 như đặc tả dưới đây. |

**Theo khóa (2026-10-02):** cấu hình trên có thể đặt riêng cho từng khóa (admin: ô "Áp dụng cho"). M0 hiện ô "Thầy/Cô công tác tại tỉnh/thành nào?" (NativeSelect, chỉ khi có ≥1 tỉnh dùng cấu hình riêng) — chọn tỉnh thì trang dùng cấu hình khóa của tỉnh đó; link `/?tinh=<id>` chọn sẵn; lựa chọn nhớ trên máy (localStorage, lỗi lưu trữ không ảnh hưởng). Cổng học viên (M3, M6, thanh menu) dùng cấu hình theo khóa đã ghi danh.

Mục nội dung trong `gioiThieu.ts` gắn `cheDo: 'khao_sat' | 'dang_nhap'` chỉ hiện ở chế độ tương ứng (áp dụng cho khối `huongDan`, từng bước `loTrinh`, từng câu `hoiDap`); không gắn = luôn hiện.

---

## M1 — Đăng nhập

**API:** `POST /auth/dang-nhap` `{ ten_dang_nhap, mat_khau }` → `{ token, phai_doi_mat_khau, nguoi_dung }`.

**Giao diện**
- Tiêu đề: tên chương trình lấy từ `gioiThieu.ts` (không ghi tên tỉnh).
- Ô "Mã định danh" (nhãn phụ: "Mã định danh trên CSDL ngành do nhà trường cung cấp"), bàn phím số trên điện thoại (`inputMode="numeric"`), bỏ khoảng trắng khi dán.
- Ô "Mật khẩu" có nút hiện/ẩn. Gợi ý dưới ô: "Lần đầu đăng nhập: mật khẩu là ngày sinh dạng ngày-tháng-năm viết liền, ví dụ 08121983".
- Liên kết "Không biết mã định danh?" → mở khung hướng dẫn tĩnh: liên hệ nhà trường hoặc số hỗ trợ.
- Chế độ `khao_sat` (2026-10-02): khung thông tin "Học viên chưa cần đăng nhập" + liên kết "Đi tới trang khảo sát" (→ `/#khao-sat`). Form vẫn hoạt động bình thường (quản trị/cán bộ đăng nhập).

**Hành vi**
- Thành công + `phai_doi_mat_khau=true` → M2; ngược lại → M3.
- Sai thông tin → một thông báo chung "Mã định danh hoặc mật khẩu không đúng" (không phân biệt sai phần nào).
- 423 → "Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau {HH:mm}".

**Nghiệm thu:** đăng nhập bằng mã MOET + ngày sinh của tài khoản import → vào M2; dán mã có khoảng trắng vẫn đăng nhập được.

---

## M2 — Đổi mật khẩu lần đầu

**API:** `POST /auth/doi-mat-khau` `{ mat_khau_cu, mat_khau_moi }`.

- 3 ô: mật khẩu hiện tại (tự điền sẵn giá trị vừa đăng nhập nếu còn trong bộ nhớ, ẩn), mật khẩu mới, nhập lại.
- Hiển thị điều kiện dạng checklist, tích xanh theo thời gian thực: ≥ 8 ký tự · có chữ và số · khác ngày sinh · hai ô trùng nhau.
- Thành công → thông báo "Đã đổi mật khẩu. Thầy/Cô ghi nhớ mật khẩu mới để đăng nhập lần sau." → M3.
- Không cho rời màn hình (guard route) cho tới khi đổi xong, trừ "Đăng xuất".

---

## M3 — Trang chính (trạng thái của tôi)

**API:** `GET /hoc-vien/toi/dot-xac-nhan` (T14), `GET /hoc-vien/toi/muc-do-day-du` (T9), `GET /hoc-vien/toi` (tên).

**Khối trạng thái (luôn ở trên cùng)** — một trong các trạng thái:

| Điều kiện | Nội dung | Nút chính |
|---|---|---|
| Đợt đang mở, hồ sơ thiếu | "Đợt {tên đợt}: còn {n} thông tin cần bổ sung. Hạn: {dong_luc}" + danh sách trường thiếu (nhãn tiếng Việt) | "Bổ sung thông tin" → M4 |
| Đợt đang mở, đủ, chưa xác nhận | "Hồ sơ đã đủ. Thầy/Cô cần kiểm tra lại và xác nhận trước {dong_luc}" | "Xem lại & xác nhận" → M5 |
| Đợt đang mở, đã xác nhận | "Đã xác nhận lúc {xac_nhan_luc}. Có thể sửa tới {dong_luc}, nhưng sửa xong phải xác nhận lại" | "Xem hồ sơ" → M4 |
| Đợt 2 đang mở, đã xác nhận đợt 2 | Như trên + khối M6 | "Làm bài đánh giá" → M6 |
| Chưa có đợt mở, có đợt sắp mở | "Đợt {tên} mở lúc {mo_luc}" | "Xem hồ sơ" (chỉ xem) |
| Không có đợt mở | "Hiện không trong thời gian chỉnh sửa hồ sơ" | "Xem hồ sơ" (chỉ xem) |

- Đếm ngược thời gian còn lại khi dưới 24 giờ trước `dong_luc`.
- Bảng nhãn tiếng Việt cho tên trường (`so_dinh_danh_ca_nhan` → "Số CCCD", `noi_sinh_id` → "Nơi sinh (tỉnh/thành)", …) đặt trong `src/lib/nhanTruong.ts`, dùng chung cho M3, M4, M5.

---

## M4 — Hồ sơ: xem & sửa

**API:** `GET /hoc-vien/toi`, `PATCH /hoc-vien/toi`, `POST`/`DELETE /hoc-vien/toi/chuyen-mon`, `GET /danh-muc/dia-danh`, `GET /danh-muc/don-vi-cong-tac`, `GET /danh-muc/mon-hoc`, `GET /hoc-vien/kiem-tra-trung`, (nếu đã có) `GET /danh-muc/chuyen-mon-dao-tao/goi-y`.

**Chế độ:** sửa được khi có đợt đang mở; ngược lại toàn bộ ở chế độ chỉ xem (không hiện nút Lưu).

**Bố cục** — các thẻ (card) theo thứ tự, mỗi thẻ có dấu ● đỏ nếu còn trường thiếu:

1. **Thông tin cá nhân**
   - Mã định danh (chỉ xem, không bao giờ sửa).
   - Họ và tên; Ngày / Tháng / Năm sinh (3 ô số); Giới tính (tùy chọn).
   - Số CCCD: 12 chữ số, bàn phím số; khi rời ô gọi `kiem-tra-trung` → báo trùng ngay.
   - Ghi chú nhỏ dưới nhóm này: "Thông tin lấy từ danh sách của ngành. Nếu chưa đúng, Thầy/Cô sửa lại cho chính xác — thông tin này sẽ in trên giấy chứng nhận."
   - Họ tên: cảnh báo 🟡 khi chưa viết hoa chữ đầu, kèm nút "Dùng dạng chuẩn: Nguyễn Văn A".
2. **Nơi sinh & cư trú**
   - Nơi sinh (tỉnh/thành): Select có tìm kiếm, `cap=tinh_thanh`, `trang_thai=active`.
   - Phường/xã: Select phụ thuộc, `cap=phuong_xa_dac_khu&parent_id={noi_sinh_id}`; đổi tỉnh → xóa phường/xã đã chọn.
3. **Công tác**
   - Đơn vị công tác: Autocomplete `GET /danh-muc/don-vi-cong-tac?loai_don_vi=truong&q=` (gõ ≥ 2 ký tự, debounce 300 ms); hiển thị "Tên trường — Phường/xã".
   - Chức vụ (text); **Đối tượng** (2026-10-02, radio Giáo viên / Cán bộ quản lý — bắt buộc để hồ sơ "đầy đủ", gửi sang hệ thống khảo sát); Số điện thoại (bàn phím số, 10 số bắt đầu 0).
4. **Liên hệ**
   - Email: ghi chú "Hệ thống gửi bản sao hồ sơ và thông báo lớp học qua email này".
5. **Trình độ & chuyên môn**
   - Trình độ chuyên môn (Select theo enum); chọn "Khác" → hiện ô bắt buộc mô tả.
   - Chuyên môn: TagsInput (≥ 1 giá trị). Thêm/xóa mỗi thẻ gọi ngay `POST`/`DELETE /hoc-vien/toi/chuyen-mon`.
   - Cấp giảng dạy (tùy chọn) → nếu có, hiện Môn giảng dạy (Select `GET /danh-muc/mon-hoc?cap_hoc=`); bỏ cấp → xóa môn.

**Lưu**
- Một nút "Lưu" cố định ở đáy màn hình (sticky), chỉ gửi các trường đã đổi (`PATCH` một phần).
- Thành công: thông báo "Đã lưu". Nếu response có `xac_nhan_bi_huy: true` → hộp thoại "Thầy/Cô đã sửa hồ sơ sau khi xác nhận. Vui lòng xác nhận lại trước {dong_luc}." với nút "Xác nhận lại" → M5.
- Lỗi `fields` → cuộn tới ô lỗi đầu tiên.
- Rời trang khi còn thay đổi chưa lưu → hỏi xác nhận.

**Nghiệm thu**
- Tài khoản MOET mới: các trường thiếu có viền đỏ + nhãn "Cần bổ sung".
- Đổi nơi sinh → danh sách phường/xã đổi theo, giá trị cũ bị xóa.
- Nhập CCCD đã có người dùng → báo trùng khi rời ô, không đợi bấm Lưu.
- Đợt đóng → không có ô nhập nào sửa được.

---

## M5 — Xem lại & xác nhận

**API:** `POST /hoc-vien/toi/kiem-tra-truoc-xac-nhan` (lỗi + cảnh báo), `POST /hoc-vien/toi/xac-nhan`.

- Gọi kiểm tra ngay khi vào màn hình.
- Hiển thị toàn bộ hồ sơ dạng bảng 2 cột (nhãn · giá trị), tên danh mục thay cho id.
- Có lỗi → khối đỏ liệt kê lỗi, mỗi lỗi có nút "Sửa" nhảy tới đúng ô ở M4; nút xác nhận bị vô hiệu hóa.
- Có cảnh báo → khối vàng, không chặn.
- Ô tích bắt buộc: "Tôi xác nhận các thông tin trên là chính xác và chịu trách nhiệm về thông tin đã khai."
- Bấm "Xác nhận" → thành công: màn hình kết quả "Đã xác nhận lúc {giờ}. Bản sao hồ sơ đã gửi tới {email}." → nút "Về trang chính".

**Nghiệm thu:** hồ sơ thiếu → không bấm được xác nhận; đủ → xác nhận xong M3 chuyển sang trạng thái "Đã xác nhận".

---

## M6 — Làm bài đánh giá đầu vào (đợt 2)

**API:** `GET /hoc-vien/toi/danh-gia-dau-vao` (T15). Cấu hình query: `gcTime: 0`, không refetch nền.

**Kênh trang khảo sát — `kenh = 'sso'` (2026-10-02, chọn ở `/admin/cau-hinh-khao-sat`):** chỉ cần hồ sơ đầy đủ. Đủ điều kiện → 2 thẻ bài theo thứ tự "1. Phiếu khảo sát kĩ năng số" (`target=khao-sat`), "2. Phiếu đánh giá năng lực số" (`target=danh-gia`) + nút "Xem tất cả bài cần làm" (không target). **2026-10-04:** mỗi thẻ có nhãn trạng thái từ `GET /sso/tinh-trang` — "Chưa làm" (nút "Làm bài"), "Đã mở, chưa nộp"/"Đang làm" (nút "Làm tiếp"), "Đã hoàn thành" (thời điểm + mức — **ưu tiên nhãn thang gốc của hệ thống khảo sát — `muc_goc` là mã `M1`–`M4`, FE hiện "M1 – Chưa đạt" / "M2 – Cơ bản" / "M3 – Thành thạo" / "M4 – Nâng cao"** (2026-10-05) — hoặc "Kết quả đang được tổng hợp"; có `url_ket_qua` → nút "Xem kết quả chi tiết" mở cùng tab; nút phụ "Mở lại trang khảo sát"), "Cần kiểm tra lại" (quá 24 giờ chưa nộp, kèm lời nhắc vào lại và bấm nộp bài). Không hiện điểm. Xong cả 2 → khung "đã hoàn thành 2 bài khảo sát đầu vào". Không tải được trạng thái → vẫn cho làm bài, chỉ ẩn nhãn. Trạng thái tự tải lại khi học viên quay về tab. M3 hiện tóm tắt cùng nhãn trong khối khảo sát đầu vào (kênh `sso`) và đầu ra. Bấm → `POST /sso/cap-ma` → chuyển trang **cùng tab** (không mở cửa sổ mới — trình duyệt Zalo); lỗi cấp mã thì hiện thông báo, không chuyển. Chưa đủ → liệt kê `ly_do` + nút "Bổ sung hồ sơ" (không có nút xác nhận). Không hiện tài khoản VLE. Bảng dưới đây áp dụng cho kênh `vle`.

Mục menu "Đánh giá đầu vào" ở thanh trên chỉ hiện khi cấu hình `danh_gia_dau_vao_trong_cong = true` (2026-10-02, `/admin/cau-hinh-khao-sat`) — địa phương làm đánh giá qua phiếu khảo sát ngoài thì ẩn.

| Phản hồi | Hiển thị |
|---|---|
| `du_dieu_kien: true` | Link "Vào làm bài" (mở cùng tab), tên đăng nhập VLE (có nút sao chép), mật khẩu tạm ẩn dạng •••• với nút "Hiện" và "Sao chép"; lưu ý "Hệ thống VLE sẽ yêu cầu đổi mật khẩu ở lần đăng nhập đầu" |
| `du_dieu_kien: false` | Danh sách `ly_do` (nhãn tiếng Việt) + nút đi tới M4/M5 tương ứng |
| `het_han: true` | "Đã hết thời gian xác nhận để làm bài đánh giá. Thầy/Cô liên hệ {hỗ trợ} để được hướng dẫn." |

**Nghiệm thu:** chưa xác nhận đợt 2 → không có bất kỳ thông tin VLE nào trong DOM hay network cache; sửa hồ sơ sau khi xác nhận → M6 trở lại trạng thái chưa đủ điều kiện.

---

## M0 — Trang giới thiệu chương trình (công khai)

**Mục đích:** cửa vào duy nhất của cổng. Giáo viên bấm link từ Zalo sẽ vào đây trước. Đồng thời là trang quảng bá cho lãnh đạo Sở, trường, đối tác và công chúng.

**Dùng chung cho nhiều tỉnh:** trang không ghi tên tỉnh cụ thể, không hiển thị lịch của riêng khóa nào. Lộ trình mô tả các giai đoạn chung, không kèm ngày.

**Không gọi API cần đăng nhập.** Nếu người dùng đã đăng nhập, nút chính đổi thành "Vào trang của tôi" (→ `/toi`).

### Nguồn nội dung — bắt buộc

- **Toàn bộ chữ, số liệu, mốc thời gian, logo** lấy từ một file duy nhất `src/content/gioiThieu.ts` (object có kiểu TypeScript `NoiDungGioiThieu`). Component chỉ hiển thị, **không chứa nội dung cứng**.
- Bản đầu dùng **nội dung tạm** có sẵn trong file `gioiThieu.ts` đi kèm đặc tả này (đặt vào `src/content/`). Mỗi khối nội dung có cờ `tam: true` khi còn là nội dung tạm; đơn vị tổ chức sẽ thay dần.
- Claude Code **không tự thêm** số liệu, tên mô-đun, văn bản pháp lý hay tên tỉnh ngoài những gì có trong file nội dung.
- Ở chế độ dev, in ra console danh sách các khối còn `tam: true` hoặc chứa chuỗi `[CHỜ` (để biết còn gì cần thay). Không chặn build.
- Mục có `hien: false` không được render.

### Các mục (theo thứ tự trên trang)

| # | Mục | Nội dung | Bản tối thiểu |
|---|---|---|---|
| 1 | **Phần mở đầu** | Tên chương trình, 1 câu thông điệp, nút chính **"Đăng nhập cổng học viên"** (→ `/dang-nhap`) — ở chế độ `khao_sat` đổi thành **"Làm khảo sát đầu vào"** (→ `#khao-sat`), nút phụ "Tìm hiểu chương trình" (cuộn xuống mục 2). Nếu `thongBaoNoiBat` có giá trị (ví dụ "Đợt kiểm tra hồ sơ mở đến 23:59 ngày 04/10") → dải thông báo nổi bật phía trên | ✔ |
| 1b | **Khảo sát đầu vào** (`khaoSatDauVao`, 2026-10-02) | Danh sách phiếu đánh số theo thứ tự làm; mỗi phiếu có 1 hoặc nhiều đường dẫn (tách theo đối tượng: giáo viên / cán bộ quản lý), mở tab mới; đường dẫn còn `[CHỜ]` → nút bị khóa + "Đường dẫn đang được cập nhật". Ghi chú "Sau khi hoàn thành khảo sát". Hiện khi bật "Hiện khối khảo sát" trong `/admin/cau-hinh-khao-sat` (độc lập chế độ) | |
| 2 | **Con số chương trình** | 3–4 ô số (ví dụ số tỉnh đã triển khai, số giáo viên đã tham gia) — chỉ hiển thị khi file nội dung có số; mặc định `hien: false` | |
| 3 | **Vì sao cần năng lực số** | Mục tiêu, lợi ích cho giáo viên, 3 mức Cơ bản / Thành thạo / Nâng cao (mô tả ngắn từng mức) | |
| 4 | **Lộ trình học** | Các giai đoạn chung theo thứ tự (không có ngày): điện thoại hiển thị dọc, desktop ngang | |
| 5 | **Nội dung chương trình** | Danh sách mô-đun/chủ đề dạng thẻ (tên, mô tả 1–2 câu, hình thức học) | |
| 6 | **Hướng dẫn nhanh cho học viên** | 4 bước: nhận mã định danh từ nhà trường → đăng nhập bằng mã + ngày sinh (ddmmyyyy) → bổ sung & xác nhận hồ sơ → làm bài đánh giá đầu vào. Chỉ hiện ở chế độ `dang_nhap` | ✔ |
| 7 | **Câu hỏi thường gặp** | Accordion; danh sách câu hỏi lấy từ file nội dung (tái sử dụng FAQ của N4) | ✔ |
| 8 | **Liên hệ hỗ trợ** | Hotline, Zalo hỗ trợ, email; giờ hỗ trợ | ✔ |
| 9 | **Đơn vị tổ chức** | Logo + tên HCMUE; danh sách đơn vị phối hợp (nếu có) chỉ hiển thị khi được đồng ý — cờ `hien` | |

Chân trang: tên đơn vị tổ chức, địa chỉ, liên kết "Đăng nhập", năm.

### Chia sẻ & quảng bá

- Thẻ meta tĩnh trong `index.html` (không sinh bằng JS, vì Zalo/Facebook không chạy JS khi tạo bản xem trước): `<title>`, `description`, `og:title`, `og:description`, `og:image` (ảnh 1200×630 đặt trong `public/`), `og:url`. Giá trị lấy từ file nội dung lúc build (plugin Vite thay thế chuỗi trong `index.html`).
- Ảnh trong trang: định dạng WebP có kích thước cố định, `loading="lazy"` trừ phần mở đầu.

### Yêu cầu kỹ thuật

- M0 nằm trong **chunk riêng, tải đầu tiên, nhẹ** (mục tiêu < 150 KB gzip gồm cả CSS). Không tải Mantine form/dates hay TanStack Query cho M0.
- Hiển thị tốt ở 360px trong trình duyệt Zalo; nút chính luôn thấy được trong màn hình đầu tiên trên điện thoại.
- Tiêu đề phân cấp đúng (`h1` duy nhất ở phần mở đầu), ảnh có `alt`, tương phản màu đạt WCAG AA.

### Nghiệm thu

- Mở `/` khi chưa đăng nhập → thấy nút chính ngay màn hình đầu trên điện thoại 360px ("Làm khảo sát đầu vào" ở chế độ `khao_sat`, "Đăng nhập cổng học viên" ở chế độ `dang_nhap`).
- Chế độ `khao_sat`: các phiếu hiện đúng thứ tự; không hiện hướng dẫn đăng nhập / FAQ mật khẩu.
- Đổi 1 câu trong `gioiThieu.ts` → trang đổi theo, không sửa component nào.
- Không có tên tỉnh nào xuất hiện trên M0 (test: render M0 không chứa chuỗi "An Giang").
- Chế độ dev in danh sách khối `tam: true`.
- Dán link vào Zalo → hiện ảnh xem trước, tiêu đề và mô tả đúng.
- Lighthouse (mobile) cho `/`: Performance ≥ 90, Accessibility ≥ 95.

---

## M9 — Hướng dẫn sử dụng (công khai)

**Route:** `/huong-dan` — ngoài `RequireAuth`, chunk riêng (lazy), sibling của `/` trong `router.tsx`.

**Mục đích:** hướng dẫn từng bước có hình minh họa cho học viên (đăng nhập, đổi mật khẩu, hồ sơ, khảo sát,
lớp học/Zalo, xác nhận, quên mật khẩu, gửi yêu cầu hỗ trợ) và mục tra cứu "Lỗi thường gặp" (tìm kiếm không
dấu + lọc theo nhóm). Dùng chung nhiều tỉnh — không ghi tên tỉnh nào.

**Nguồn nội dung:** `src/content/huongDan.ts` (chữ, bảng, danh sách lỗi — kiểu `NoiDungHuongDan`) và
`src/content/huongDanHinh.ts` (ảnh minh họa `src/assets/huong-dan/*.webp`, 2 biến thể máy tính/điện thoại
mỗi phần). Component (`src/pages/M9/HuongDan.tsx`) chỉ hiển thị, không chứa nội dung cứng — cùng quy ước
với M0.

`../huong-dan-hoc-vien.html` và file `.docx` kèm theo trong `design/` là bản in/chia sẻ phái sinh của
`src/content/huongDan.ts` (cùng nội dung, trình bày lại để gửi qua Zalo/in giấy) — sửa nội dung ở
`huongDan.ts`, không sửa trực tiếp các bản phái sinh.

**Lối vào:** menu M0 ("Hướng dẫn sử dụng") + nút dưới khối "Bắt đầu trong 4 bước" + chân trang; dòng
gợi ý ở M1 (`#dang-nhap`); mục "Hướng dẫn" trên `TopBar` (mọi màn hình sau đăng nhập); thẻ gợi ý ở M3; liên
kết "Xem lỗi thường gặp" (`#loi`) ở M8.

**Nghiệm thu:** mở `/huong-dan` độc lập (không cần đăng nhập); đổi kiểu hình Máy tính/Điện thoại đổi ảnh ở
mọi phần; tìm "tạm khóa" (không dấu) vẫn ra đúng mục lỗi tài khoản tạm khóa; không có tên tỉnh nào trong
trang.

---

## Kiểm tra trước khi phát hành (bắt buộc)

- [ ] Chạy toàn luồng M0 → M5 trên điện thoại Android và iPhone, trong trình duyệt nhúng của Zalo.
- [ ] Mạng 3G giả lập (DevTools): trang đăng nhập hiển thị < 3 giây.
- [ ] Không có token/CCCD/mật khẩu trong console, URL hay `localStorage`.
- [ ] Toàn bộ chữ tiếng Việt hiển thị đúng dấu, không lỗi font.
