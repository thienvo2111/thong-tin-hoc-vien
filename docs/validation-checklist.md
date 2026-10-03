# Checklist quy tắc ràng buộc & validate

Tổng hợp mọi quy tắc đã xuất hiện trong thiết kế (canvas), map sang nơi thực thi: **DB** (constraint/trigger trong `database-ddl.sql`), **API** (tầng ứng dụng, dùng chung giữa form nhập tay và import hàng loạt — "Dịch vụ Kiểm tra dữ liệu"), hoặc **UI** (cảnh báo không chặn, chỉ nhắc).

Ký hiệu: 🔴 lỗi chặn lưu · 🟡 cảnh báo không chặn (chỉ nhắc, cho phép bỏ qua).

## Họ và tên (`hoc_vien.ho_ten`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 1 | Bắt buộc nhập | 🔴 | DB (`NOT NULL`) + API |
| 2 | Chỉ chữ cái tiếng Việt có dấu + khoảng trắng (không số, không ký tự đặc biệt) | 🔴 | API (regex) |
| 3 | Chuẩn hóa Unicode **NFC** trước khi lưu (chống lỗi font khi xuất báo cáo) | — (biến đổi, không chặn) | API |
| 4 | Chữ cái đầu mỗi từ nên viết hoa — nếu sai, gợi ý dạng chuẩn hóa và yêu cầu xác nhận lại | 🟡 | API (phát hiện) + UI (hiển thị gợi ý, như `FormNhapThongTin.dc.html`) |
| 5 | Không hai khoảng trắng liên tiếp, không khoảng trắng đầu/cuối | 🟡 | API |

## Số định danh cá nhân — ĐDCN (`hoc_vien.so_dinh_danh_ca_nhan`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 6 | Bắt buộc **khi `nguon_tao='tu_dang_ky'`**; với `nguon_tao='import_moet'` để trống lúc tạo, bắt buộc khi người dùng tự bổ sung qua `PATCH /hoc-vien/toi`. Luôn đúng **12 chữ số**, không khoảng trắng/ký tự khác khi có giá trị | 🔴 | DB (`CHECK` cho phép NULL, ép định dạng khi có giá trị) + API (bắt buộc có điều kiện theo `nguon_tao`) |
| 7 | Duy nhất toàn hệ thống (không trùng học viên khác) | 🔴 | DB (`UNIQUE`, cho phép nhiều NULL) + API (kiểm tra trước khi submit qua `GET /hoc-vien/kiem-tra-trung`) |
| 8 | **Không xác thực với CSDL dân cư quốc gia** ở giai đoạn này (hạng mục tương lai, xem `Main.dc.html` — "Tích hợp tương lai") — Trường/Phòng VHXH/Sở duyệt bằng xác minh thủ công là bước xác thực chính | ghi nhận rủi ro | — |
| 8b | **Xác nhận (2026-09-29)**: Mã định danh CSDL MOET (`ma_dinh_danh_moet`) **KHÔNG** trùng giá trị với CCDCN — 2 cột tách biệt, không có ràng buộc đồng bộ giữa chúng. Một số trường không cung cấp được mã định danh CSDL MOET khi báo danh sách → hồ sơ `import_moet` chỉ bắt buộc có ít nhất 1 trong 2 mã (xem rule #34, #8c) | ghi nhận rủi ro / quyết định thiết kế | — |
| 8c | Hồ sơ `import_moet` chấp nhận thiếu `ma_dinh_danh_moet` **hoặc** thiếu `so_dinh_danh_ca_nhan`, nhưng không được thiếu cả 2 (T4b, 2026-09-29) | 🔴 | DB (`chk_hoc_vien_nguon_tao`) + API import |

## Ngày / tháng / năm sinh (`ngay_sinh`, `thang_sinh`, `nam_sinh`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 9 | 3 trường tách biệt, đều bắt buộc | 🔴 | DB (`NOT NULL`) |
| 10 | `ngay_sinh` 1–31, `thang_sinh` 1–12 | 🔴 | DB (`CHECK`) |
| 11 | Tổ hợp ngày/tháng/năm phải là ngày thực tế trong lịch (bắt 31/04, 30/02, 29/02 năm không nhuận...) | 🔴 | API (dùng thư viện date, trả lỗi rõ ràng) — DB có `CHECK` dự phòng qua `make_date()` nhưng lỗi SQL thô, **không dùng làm nguồn thông báo lỗi cho người dùng** |
| 12 | Tuổi tối thiểu hợp lý so với khóa bồi dưỡng (mặc định ≥ 15 tuổi — xác nhận lại với nghiệp vụ thực tế trước khi khóa cứng) | 🔴 | DB (`CHECK` biên dưới) + API (so với ngày bắt đầu khóa nếu cần chính xác hơn theo từng khóa) |

## Nơi sinh / Phường-Xã (`noi_sinh_id`, `phuong_xa_id` → `dia_danh`) — **SUPERSEDED 2026-09-30**

> **Đã thay thế từ 2026-09-30** bởi mục "Nơi sinh (text tự do) & Cư trú" ngay bên dưới — quyết định nghiệp vụ: giấy khai sinh có thể ghi nơi sinh theo địa giới hành chính CŨ, khác địa giới HIỆN TẠI mà `dia_danh` quản lý, và DB không có bộ dữ liệu địa giới cũ để chọn. Giữ nguyên bảng gốc dưới đây chỉ để tra cứu lịch sử (rule #13-16 KHÔNG còn được API thực thi) — cột `noi_sinh_id`/`phuong_xa_id` vẫn còn trong DB (deprecated, không xoá) cho hồ sơ cũ.

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 13 | ~~Bắt buộc **khi `nguon_tao='tu_dang_ky'`**; với `import_moet` để trống lúc tạo (không có trong danh sách tiếp nhận MOET), bắt buộc khi người dùng tự bổ sung. Luôn chọn từ danh mục — không nhập tự do~~ | 🔴 | ~~DB (FK, cho phép NULL) + UI (chỉ cho chọn, không có ô nhập tay) + API (bắt buộc có điều kiện)~~ |
| 14 | ~~`noi_sinh_id` phải có `cap = 'tinh_thanh'`~~ | 🔴 | ~~API (kiểm tra `cap` trước khi lưu — DB không ràng buộc chéo cột được bằng CHECK đơn giản)~~ |
| 15 | ~~`phuong_xa_id` phải có `cap = 'phuong_xa_dac_khu'` **và** `parent_id` (sau khi truy ngược) khớp `noi_sinh_id` đã chọn~~ | 🔴 | ~~API~~ |
| 16 | ~~Danh mục có thể `trang_thai='ngung'` (do sáp nhập địa giới) — bản ghi cũ vẫn hiển thị đúng cho hồ sơ lịch sử, nhưng **không cho chọn mới**~~ | 🔴 (khi tạo mới) | ~~API~~ |

## Nơi sinh (text tự do, 3 trường) & Cư trú (`noi_sinh_tinh/huyen/xa`, `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` → `dia_danh`) — **sửa 2026-10-01 (T17), thay thế mục trên**

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 13b | `noi_sinh_tinh`/`noi_sinh_huyen`/`noi_sinh_xa` (string, tối đa 255 ký tự mỗi trường) — 3 Ô NHẬP TỰ DO riêng biệt, không FK tới `dia_danh` (địa giới có thể đã cũ, DB không có dữ liệu để đối chiếu). **Sửa 2026-10-01**: HOÀN TOÀN TÙY CHỌN cho mọi `nguon_tao` — để trống cả 3 vẫn lưu được, **KHÔNG tính vào "Hồ sơ đầy đủ"** (trước đó `noi_sinh` 1 ô còn bắt buộc + tính vào đầy đủ ở `tu_dang_ky` — đã bỏ) | — (tùy chọn) | API (`IsOptional`/`MaxLength` ở DTO) |
| 14b | `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` — **TÙY CHỌN** (không tính vào "Hồ sơ đầy đủ"), dùng đúng địa giới hành chính HIỆN TẠI của `dia_danh`. Nếu có gửi giá trị: `cu_tru_tinh_id` phải `cap='tinh_thanh'`, `cu_tru_phuong_xa_id` phải `cap='phuong_xa_dac_khu'` **và** `parent_id` khớp `cu_tru_tinh_id` (nếu cả 2 cùng gửi) | 🔴 (nếu gửi sai) | API |
| 15b | Danh mục có thể `trang_thai='ngung'` (do sáp nhập địa giới) — bản ghi cũ vẫn hiển thị đúng cho hồ sơ lịch sử, nhưng **không cho chọn mới** `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` | 🔴 (khi chọn mới) | API |
| 16b | Dữ liệu `noi_sinh_id`/`phuong_xa_id` cũ (nếu có) đã được migrate 1 lần sang `noi_sinh` dạng text lúc thêm cột (migration `20260930080000_t16_hoc_vien_noi_sinh_cu_tru`). **T17 (2026-10-01)**: cột `noi_sinh` (1 ô) sau đó tách thành `noi_sinh_tinh`/`noi_sinh_huyen`/`noi_sinh_xa` — xem migration mới cho cách xử lý dữ liệu `noi_sinh` đã có (giữ nguyên trong 1 trong 3 cột mới hay bỏ, tùy đã có dữ liệu thật hay chưa tại thời điểm migrate) | — | Migration (chạy 1 lần) |
| 17b | UI "Cư trú" (M4 `HoSo.tsx`) gọi `SelectDiaDanh` với `phienBan="hien_tai"` cho cả `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` — chỉ liệt kê xã/phường HIỆN TẠI, loại bỏ mã lịch sử và các dòng đặc biệt (xem mục `dia_danh.phien_ban` bên dưới) | 🟡 (UX, API vẫn chấp nhận bất kỳ `dia_danh` hợp lệ nếu gửi thẳng id) | Frontend |

## `dia_danh.phien_ban` — thêm 2026-09-30 (phân biệt xã/phường theo đợt sáp nhập hành chính 2025)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 97 | Cột `dia_danh.phien_ban` (enum `phien_ban_dia_danh`, `NOT NULL`, mặc định `hien_tai`) phân biệt: **`hien_tai`** — xã/phường theo địa giới hiện hành (34 tỉnh/thành sau sáp nhập); **`lich_su`** — mã xã/phường CŨ trước sáp nhập, giữ lại (không xoá) vì có thể được `don_vi_cong_tac.dia_ban_id` tham chiếu để lưu đúng lịch sử công tác giáo viên tại thời điểm đó; **`dac_biet`** — placeholder không phải địa giới thật (nhóm "Khu vực đặc biệt..." An Giang, sentinel "Xã chưa xác định (...)") | 🔴 | DB (cột + migration `20260930090000_t17_dia_danh_phien_ban`) |
| 98 | `GET /danh-muc/dia-danh?phien_ban=` — tuỳ chọn, không truyền thì không lọc (giữ hành vi cũ, trả về mọi `phien_ban` — dùng cho Admin quản lý danh mục và chọn địa bàn `don_vi_cong_tac`, nơi cần thấy cả `lich_su`/`dac_biet`) | 🟡 | API |

## Đơn vị công tác (`don_vi_cong_tac_id`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 17 | Bắt buộc chọn từ danh mục (tìm kiếm autocomplete với `tu_dang_ky`; khớp theo tên cột "Đơn vị" khi `import_moet`), không tự thêm đơn vị mới tại form học viên | 🔴 | DB (FK) + UI / API (import) |
| 18 | Chỉ cho chọn đơn vị `trang_thai='active'` và `loai_don_vi='truong'` (học viên thuộc về Trường, không thuộc trực tiếp Sở/Phòng) | 🔴 | API |

## Liên hệ (`so_dien_thoai_lien_he`, `email_lien_he`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 19 | `so_dien_thoai_lien_he` luôn bắt buộc **khi coi hồ sơ là "đầy đủ"** (rule #59, mọi `nguon_tao` — không đổi) và bắt buộc **ngay lúc tạo** với `tu_dang_ky` (không đổi). **Sửa 2026-09-30 (T4c)**: riêng lúc **import** `import_moet` (thời điểm tạo hồ sơ, KHÔNG PHẢI lúc xác nhận), KHÔNG còn bắt buộc — danh sách tiếp nhận MOET thực tế có dòng thiếu SĐT, để `NULL` lúc import; vẫn phải bổ sung trước khi `day_du=true` (rule #59) mới xác nhận được (rule #67). `email_lien_he` bắt buộc **chỉ khi `nguon_tao='tu_dang_ky'`**; với `import_moet` để trống, bắt buộc khi tự bổ sung (không có trong danh sách MOET) | 🔴 | DB (`so_dien_thoai_lien_he` cho phép NULL từ T4c) + API (SĐT bắt buộc lúc tạo cho `tu_dang_ky`, tùy chọn lúc import cho `import_moet`, luôn bắt buộc khi check đầy đủ; email bắt buộc có điều kiện) |
| 20 | Số điện thoại đúng định dạng VN (10 số, đầu 0, hoặc +84) | 🔴 | API (regex) |
| 21 | Email đúng định dạng chuẩn (RFC 5322 rút gọn) khi có giá trị | 🔴 | API |

## Trình độ & chuyên môn

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 22 | `trinh_do_chuyen_mon` bắt buộc **khi `tu_dang_ky`**; `import_moet` để trống (không có trong danh sách MOET), bắt buộc khi tự bổ sung | 🔴 | DB (`ENUM`, cho phép NULL) + API (bắt buộc có điều kiện) |
| 23 | Nếu chọn `khac`, bắt buộc `trinh_do_chuyen_mon_khac` | 🔴 | DB (`CHECK`, NULL-safe) |
| 24 | Chuyên môn (`hoc_vien_chuyen_mon`, **1-nhiều**) — text tự do mỗi giá trị, **cố ý không FK/danh mục**, chấp nhận dữ liệu không đồng nhất (vd "Sư phạm Toán" ≠ "SP Toán"), **không có bước chuẩn hóa/gộp tự động hay thủ công** (quyết định đã chốt). Ít nhất 1 giá trị bắt buộc khi `tu_dang_ky`; với `import_moet`, tách từ cột "Chuyên môn" của file (phân tách `;`) — xác nhận thực tế 1 người có thể có nhiều chuyên môn. **Sửa 2026-09-30 (T4c)**: dòng import `import_moet` với ô "Chuyên môn" trống KHÔNG còn là dòng lỗi — tạo hồ sơ không có `hoc_vien_chuyen_mon` nào, học viên tự bổ sung sau (`POST /hoc-vien/toi/chuyen-mon`), bắt buộc trước khi hồ sơ được coi là đầy đủ (rule #59) | 🔴 (≥1 giá trị, không rỗng) khi `tu_dang_ky`; tùy chọn lúc import cho `import_moet` | DB (bảng con `hoc_vien_chuyen_mon`, `UNIQUE(hoc_vien_id, chuyen_mon)`) + API |
| 25 | `cap_giang_day` — **tùy chọn cho mọi hồ sơ** (đã chốt 2026-09-23: nhân viên không trực tiếp giảng dạy được phép để trống vĩnh viễn, không chỉ tạm thời chờ bổ sung). Khi CÓ khai, khai theo **từng học viên**, không suy ra từ trường (đúng cho trường liên cấp), và là field quyết định routing duyệt — xem #25b | — (tùy chọn) | DB (cho phép NULL) |
| 25b | Khi `cap_giang_day IS NULL`, routing duyệt mặc định về **Sở GD&ĐT** (an toàn nhất — Sở có quyền duyệt thay mọi cấp) thay vì chặn hồ sơ lại. Hồ sơ `import_moet` không bị ảnh hưởng vì đã `da_duyet` sẵn, không qua routing này | 🔴 (quy tắc routing) | API |
| 26 | `mon_giang_day_id` — tùy chọn, chỉ áp dụng khi `cap_giang_day` đã có giá trị (danh sách lọc theo `cap_giang_day`, dropdown phụ thuộc); nếu `cap_giang_day IS NULL` thì `mon_giang_day_id` cũng để trống, không hỏi | — (tùy chọn) | DB (FK, cho phép NULL) + API (ẩn field khi chưa có `cap_giang_day`) |
| 26b | `chuc_vu` (vd: TTCM, Giáo viên, Nhân viên) — text tự do lấy nguyên từ cột "Chức vụ" khi import; không bắt buộc, không kiểm soát bằng enum/danh mục (giá trị từ CSDL MOET có thể đa dạng ngoài dự đoán) | — | DB (`varchar` không ràng buộc) |

## Vòng đời hồ sơ & duyệt

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 27 | Hồ sơ chỉ sửa được khi `trang_thai='nhap'`; sau khi `cho_duyet` thì khóa, trừ khi bị `tu_choi` (mở lại `nhap`) | 🔴 | API |
| 28 | Trước khi chuyển `nhap → cho_duyet`, bắt buộc qua màn xác nhận (`XacNhanThongTin.dc.html`) — không có API tắt bỏ qua bước xem lại | 🔴 (quy trình) | API (endpoint `xac-nhan` là bước bắt buộc duy nhất để đổi trạng thái) |
| 29 | Duyệt hồ sơ: đơn vị duyệt xác định theo `cap_giang_day` (routing — xem `api-contract.md`), không theo đơn vị công tác trực tiếp | 🔴 | API |
| 30 | Cấp trên (Sở) duyệt thay được cấp dưới (Phòng VHXH); chiều ngược lại bị từ chối | 🔴 | API (middleware phân quyền scope-based) |
| 31 | Khi duyệt, bắt buộc ghi `nguoi_duyet_id` + `cap_duyet_thuc_te` (audit — biết ai duyệt, vai trò gì lúc duyệt) | 🔴 | DB (`CHECK` đồng bộ trạng thái/người duyệt) |
| 32 | Sau khi xác nhận thành công, tự động gửi email bản sao dữ liệu, ghi `email_ban_sao_da_gui_at` | — (side effect) | API (Dịch vụ Thông báo) |

## Tài khoản tự sinh

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 33 | Tài khoản `nguoi_dung` (vai_tro=`hoc_vien`) tạo tự động cùng lúc với `hoc_vien` (tự đăng ký) hoặc theo lô khi import MOET — không cần cấp trước thủ công trong cả 2 trường hợp | 🔴 (quy trình) | API (transaction, xem `api-contract.md` mục "Luồng đăng ký" / "Luồng import nhân sự từ CSDL MOET") |
| 34 | `ten_dang_nhap` = `so_dinh_danh_ca_nhan` (tự đăng ký) hoặc `ma_dinh_danh_moet` ưu tiên, fallback `so_dinh_danh_ca_nhan` nếu dòng import không có mã MOET (import, T4b 2026-09-29) — gán **1 lần lúc tạo, không tự đổi theo dữ liệu hồ sơ về sau** kể cả khi CCCD được bổ sung muộn. Mật khẩu mặc định = ngày sinh (định dạng thống nhất, ví dụ `ddmmyyyy`) cho cả 2 luồng | 🔴 | DB (`ten_dang_nhap UNIQUE NOT NULL`, tách khỏi `email`) + API |
| 34b | **T4b (2026-09-29)**: `POST /auth/dang-nhap` chấp nhận `ten_dang_nhap` khớp **1 trong 2** — đúng `nguoi_dung.ten_dang_nhap`, hoặc đúng `hoc_vien.so_dinh_danh_ca_nhan` của hồ sơ liên kết (kể cả khi tài khoản được tạo bằng mã MOET rồi CCCD mới được bổ sung sau — lúc đó đăng nhập được bằng cả 2 giá trị). Không áp dụng cho tài khoản không phải học viên | 🔴 | API (`AuthService.dangNhap`) |
| 35 | `phai_doi_mat_khau=true` mặc định — chặn thao tác khác cho tới khi đổi mật khẩu | 🔴 | API (middleware kiểm tra cờ này sau đăng nhập) |
| 36 | Rủi ro đã ghi nhận: không xác thực danh tính khi tự đăng ký (biết ĐDCN người khác là khai được thay) — **quyết định chấp nhận**, dựa vào bước Trường/Phòng VHXH/Sở duyệt làm điểm xác minh chính, không thêm bước xác thực khác | ghi nhận rủi ro | — |

## Nguồn tạo hồ sơ & import nhân sự CSDL MOET (`hoc_vien.nguon_tao`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 36b | Mọi hồ sơ có `nguon_tao ∈ {tu_dang_ky, import_moet}`; ràng buộc chéo: `tu_dang_ky` → `so_dinh_danh_ca_nhan` bắt buộc có ngay; `import_moet` → `ma_dinh_danh_moet` bắt buộc có ngay | 🔴 | DB (`CHECK chk_hoc_vien_nguon_tao`) |
| 36c | Hồ sơ `import_moet` nhận `trang_thai='da_duyet'` **ngay khi import** (danh sách tiếp nhận coi như đã xác thực), `nguoi_duyet_id` = tài khoản Quản trị đã chạy import, `cap_duyet_thuc_te='quan_tri'` — **không** qua lại luồng duyệt Trường/Phòng VHXH/Sở | 🔴 (quy trình) | API |
| 36d | `da_duyet` ngay **không đồng nghĩa hồ sơ đầy đủ** — nhiều trường vẫn `NULL` (CCCD, nơi sinh, phường xã, email, trình độ, cấp giảng dạy, môn giảng dạy). **Sửa T3 (2026-09-29, QĐ1)**: Hồ sơ `import_moet` chưa đầy đủ vẫn được ghi danh. Hồ sơ phải đầy đủ (T9) và đã xác nhận ở đợt `xac_nhan_truoc_danh_gia` (T14) mới được làm đánh giá đầu vào (T15); điều kiện đầy đủ được kiểm tra lại khi cấp chứng nhận (T13) | 🔴 | API |
| 36e | Cột "Đơn vị" trong file import khớp với `don_vi_cong_tac.ten_don_vi` — không khớp được hoặc khớp nhiều hơn 1 kết quả → dòng lỗi (không tự đoán). **T4 (2026-09-28)**: nếu file có cột tùy chọn "Mã đơn vị" (giá trị khác trống) thì khớp `don_vi_cong_tac.ma_don_vi` **ưu tiên hơn** tên — dùng khi tên trường trùng giữa nhiều đơn vị (sau sáp nhập An Giang – Kiên Giang) | 🔴 | API (Dịch vụ Import) |
| 36f | `ma_dinh_danh_moet` duy nhất — dòng import trùng mã đã tồn tại → dòng lỗi (không tự động ghi đè hồ sơ cũ). **T4d (2026-09-30)**: áp dụng tương tự cho `so_dinh_danh_ca_nhan`; cả 2 còn được kiểm tra trùng **NỘI BỘ trong cùng file** (2 dòng cùng mã, DB chưa ghi gì) bằng `dupKeys: Set<string>` — báo lỗi ngay ở bước preview (`POST /import/ho-so-nhan-su-moet`), không đợi tới bước xác nhận mới lộ ra (trước đó dòng trùng nội bộ "pass" cả 2 ở preview vì DB chưa có gì, chỉ lộ lỗi mới ở xác nhận sau khi dòng đầu đã commit) | 🔴 | DB (`UNIQUE`) + API (`HocVienService.checkValidMoetImportRow`) |
| 36g | **T4 (2026-09-28)**: parser `ho_so_nhan_su_moet` tự dò dòng tiêu đề thật (bỏ qua dòng tiêu đề/ghi chú phía trên file), nhận tiêu đề gộp ô 2 tầng cho "Ngày tháng năm sinh", khớp tên cột không phân biệt hoa/thường/khoảng trắng thừa/phần trong ngoặc. Ô số Excel lưu dạng number (mã MOET, SĐT) đọc về chuỗi không `.0`/ký hiệu khoa học | 🔴 | API (`readMoetWorkbookRows`) |
| 36h | **T4 (2026-09-28)**: `Số điện thoại` đúng 9 chữ số bắt đầu `3/5/7/8/9` (mất số 0 đầu do Excel lưu dạng number) → tự thêm `0`, cảnh báo 🟡 không chặn dòng. Sai định dạng khác vẫn là lỗi 🔴 (rule #20) | 🟡 (riêng trường hợp mất số 0 đầu) | API |

## Danh mục dùng chung (Địa danh / Đơn vị công tác / Môn học)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 37 | `ma` / `ma_don_vi` duy nhất trong từng danh mục | 🔴 | DB (`UNIQUE`) |
| 38 | `dia_danh.parent_id` bắt buộc nếu `cap='phuong_xa_dac_khu'`, cấm nếu `cap='tinh_thanh'` | 🔴 | DB (`CHECK`) |
| 39 | `don_vi_cong_tac.don_vi_cha_id` không được tự tham chiếu chính nó | 🔴 | DB (`CHECK`) |
| 40 | Xóa cứng **không được phép** — chỉ `trang_thai='ngung'` (dữ liệu lịch sử vẫn cần hiển thị đúng) | 🔴 | API (không expose `DELETE`, chỉ `PATCH trang_thai`) |
| 41 | Tên (`ten`, `ten_don_vi`, `ten_mon`) chuẩn hóa NFC trước khi lưu | — | API |

## Import hàng loạt (Excel/CSV)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 42 | Mỗi dòng chạy qua **cùng bộ quy tắc** như nhập tay tương ứng (không có luật riêng nới lỏng cho import) | 🔴 | API (dùng chung "Dịch vụ Kiểm tra dữ liệu") |
| 43 | Báo lỗi theo từng dòng, kèm số dòng + lý do cụ thể (không chỉ "file lỗi") | 🔴 | API |
| 44 | Preview trước khi nạp chính thức: hiển thị tổng dòng / hợp lệ / lỗi, xác nhận riêng một bước (`POST /import/{id}/xac-nhan`) trước khi ghi vào bảng thật | 🔴 (quy trình) | API |
| 45 | Import `phan_lop_hoc_vien`: dòng lỗi nếu học viên không xác định được (không có `so_dinh_danh_ca_nhan` lẫn `ma_dinh_danh_moet`, hoặc cả 2 cùng có nhưng trỏ 2 hồ sơ khác nhau — dùng chung `HocVienResolver`, xem rule #3 phần đầu tài liệu `mo-rong-nls-an-giang.md`) hoặc học viên đã xác định nhưng hồ sơ chưa `da_duyet`, mã khóa không tồn tại, hoặc `ten_lop` (khi có giá trị) không tồn tại trong đúng `khoa_id` đó. **Đã sửa 2026-09-25**: chạy lại import cho cùng `(hoc_vien_id, khoa_id)` KHÔNG còn là lỗi — là upsert hợp lệ (xem rule #52). **Sửa T3 (2026-09-29, QĐ1)**: thêm cột `ma_dinh_danh_moet` (tùy chọn, cùng vai trò với `so_dinh_danh_ca_nhan`) — không còn đòi hồ sơ đầy đủ để ghi danh (xem rule #36d) | 🔴 | API |
| 45b | Import `ho_so_nhan_su_moet`: quy tắc riêng ở mục "Nguồn tạo hồ sơ & import nhân sự CSDL MOET" (#36b–36f) | 🔴 | API |
| 46 | File nguồn gốc lưu lại ở object storage, không chỉ lưu kết quả (có thể tra soát lại) | — | Hạ tầng (`Main.dc.html` — Object Storage) |

## Khóa bồi dưỡng & Lớp học

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 47 | **Sửa 2026-09-29 (T2, QĐ2)**: Trường tạo khóa cho đơn vị mình; Quản trị tạo khóa cho bất kỳ đơn vị `khac`/`truong`. Khóa do Quản trị tạo được duyệt ngay. Sở/Phòng VHXH không có endpoint tạo khóa (chỉ duyệt) | 🔴 | API (kiểm tra `vai_tro` ở tầng route + `loai_don_vi`/`trang_thai` của `don_vi_to_chuc_id` khi quan_tri gọi) |
| 48 | `giai_doan_khoa.thu_tu` duy nhất trong 1 khóa, không có thứ tự cố định dùng chung giữa các khóa | 🔴 | DB (`UNIQUE(khoa_id, thu_tu)`) |
| 49 | `thoi_gian_ket_thuc >= thoi_gian_bat_dau` cho khóa, giai đoạn, lịch học lớp | 🔴 | DB (`CHECK`) |
| 50 | `lich_hoc_lop.lop_id` và `.giai_doan_id` phải cùng thuộc 1 `khoa_id` | 🔴 | API (kiểm tra chéo trước khi insert — DB không ràng buộc trực tiếp vì 2 FK khác bảng) |
| 51 | **Sửa 2026-09-30 (QĐ10)**: cột `dang_ky_hoc.lop_id` cũ (1 lớp/đăng ký) đã bị **xóa**, thay bằng bảng nối `dang_ky_hoc_lop` — mỗi dòng `dang_ky_hoc_lop.lop_id` phải thuộc đúng `khoa_id` của `dang_ky_hoc` tương ứng, VÀ `dang_ky_hoc_lop.loai_lop` phải khớp `lop_hoc.loai_lop` của chính `lop_id` đó. Không còn DB trigger — kiểm tra chuyển hẳn sang tầng service (`KhoaBoiDuongService.assertLopThuocKhoaVaLoai`), cùng phong cách với rule #50 | 🔴 | API (`assertLopThuocKhoaVaLoai`, gọi từ cả luồng import lẫn `PATCH /dang-ky-hoc/{id}/lop`) |
| 52 | **Đã sửa 2026-09-25** (bản trước giả định `khoa_id` tự gán khi hồ sơ `da_duyet` — sai, không có cơ sở "học viên thuộc khóa nào" khi tự động; xem `database-ddl.sql` ghi chú triển khai): `dang_ky_hoc.khoa_id` **chỉ gán qua Import `phan_lop_hoc_vien` bởi Quản trị hệ thống** — không tự động theo hồ sơ duyệt, không phải học viên tự chọn/đăng ký. `ten_lop`/`ten_lop_zoom`/`ten_lop_vle`/`ten_cum` trong file import đều tùy chọn và độc lập nhau (QĐ10, 2026-09-30 — trước đó chỉ có `ten_lop`): mỗi cột trống → không gán loại lớp/cụm đó; có giá trị → upsert đúng bảng nối `dang_ky_hoc_lop`/`dang_ky_hoc.cum_id` tương ứng. **Sửa 2026-09-30 (QĐ10)**: nay có thêm 2 endpoint gán tay từng người — `PATCH /dang-ky-hoc/{id}/lop`, `PATCH /dang-ky-hoc/{id}/cum` (xem mục "Loại lớp & Cụm học viên" bên dưới) — không còn đúng nghĩa "không có API gán tay" như trước | 🔴 (quy trình) | API (`phan_lop_hoc_vien` qua import; thao tác đơn lẻ qua `PATCH /dang-ky-hoc/{id}/lop`\|`/cum`) |
| 53 | **Thêm 2026-09-29 (T2, QĐ2)**: `POST/DELETE /khoa-boi-duong/{id}/don-vi-theo-doi(/{don_vi_id})` chỉ Quản trị. Đơn vị trong `khoa_don_vi_theo_doi` chỉ mở rộng phạm vi XEM khóa (metadata/giai đoạn/lớp/lịch) cho Sở/Phòng VHXH/Trường có đơn vị là/nằm dưới đơn vị theo dõi — KHÔNG mở rộng phạm vi dữ liệu cấp học viên (`dang_ky_hoc`, kết quả, báo cáo vẫn lọc theo `hoc_vien.don_vi_cong_tac_id` như cũ) | 🔴 | API (`ScopeService.getKhoaIdsTheoDoi`, kiểm tra `vai_tro` ở route) |
| 94 | **Thêm 2026-09-30**: `PATCH /khoa-boi-duong/{id}/giai-doan/{giai_doan_id}`, `PATCH /khoa-boi-duong/{id}/lop/{lop_id}`, `PATCH /khoa-boi-duong/{id}/cum/{cum_id}`, `PATCH /lop/{id}/lich-hoc/{lich_hoc_id}` — 4 endpoint sửa một phần (partial) cho 4 thực thể trước đó chỉ có `POST` tạo mới. Body rỗng hoặc không có trường hợp lệ nào → `400 VALIDATION_ERROR` (không cho "sửa không làm gì cả"). Không DTO nào có trường cha (`khoa_id`/`lop_id`/`giai_doan_id`) — không cho đổi quan hệ cha qua các endpoint này. Con (`giai_doan_id`/`lop_id`/`cum_id`/`lich_hoc_id`) không thuộc đúng cha trên URL → `404 NOT_FOUND` (không lộ thông tin con thuộc khóa/lớp khác). Quyền giống hệt `POST` tương ứng (Trường chủ khóa, QuảnTrị) | 🔴 | API (`KhoaBoiDuongService.capNhatGiaiDoan`\|`capNhatLop`\|`capNhatCum`\|`capNhatLichHoc`) |
| 95 | **Thêm 2026-09-30**: xóa cứng (hard DELETE) **không được phép** cho `giai_doan_khoa`, `lop_hoc`, `cum_hoc_vien` (rule #40, cùng nguyên tắc chung của hệ thống) — chỉ vô hiệu hóa qua `PATCH .../trang_thai='ngung'`. Riêng `lich_hoc_lop.trang_thai` (`trang_thai_lich_hoc`) **chưa có giá trị "hủy/vô hiệu"** — chỉ có `chua_dien_ra`\|`dang_dien_ra`\|`ket_thuc` — nên `PATCH /lop/{id}/lich-hoc/{lich_hoc_id}` hiện CHƯA dùng để "hủy" hẳn 1 buổi học, chỉ để sửa sai sót (giờ/địa điểm/buổi/trạng thái diễn ra). Nếu sau này cần "hủy buổi học", cần thêm giá trị enum mới (`ALTER TYPE ... ADD VALUE`, migration riêng — xem quy ước ở đầu `prisma/schema.prisma`), CHƯA tự thêm ở đây vì spec không yêu cầu rõ | 🔴 (quy trình) | API (không expose `DELETE` cho 4 thực thể này, chỉ `PATCH trang_thai`) |
| 96 | **Thêm 2026-09-30**: `PATCH /khoa-boi-duong/{id}/lop/{lop_id}` cho phép đổi `loai_lop` **kể cả khi lớp đang có đăng ký** (`dang_ky_hoc_lop` trỏ tới) — KHÔNG chặn (quyết định tự chọn khi spec không nói rõ nên chặn hay cho phép, chọn theo hướng "cho phép + cảnh báo", nhất quán với cách xử lý lệch mức năng lực khi import phân lớp). Response trả kèm trường `canh_bao` (chuỗi mô tả số đăng ký bị ảnh hưởng) khi có ít nhất 1 `dang_ky_hoc_lop` trỏ tới lớp — KHÔNG tự động sửa/xóa các dòng đó, cần rà soát thủ công qua `PATCH /dang-ky-hoc/{id}/lop` | 🟡 | API (`KhoaBoiDuongService.capNhatLop`) |

## Bảo mật đăng nhập (T1, 2026-09-28 — mo-rong-nls-an-giang.md)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 53 | Sai mật khẩu 5 lần liên tiếp → `nguoi_dung.khoa_den = now() + 15 phút`; đăng nhập đúng (kể cả ngay sau khi `khoa_den` đã hết hạn) → reset `so_lan_dang_nhap_sai=0, khoa_den=NULL` | 🔴 | API (`AuthService.dangNhap`) |
| 54 | Đang trong thời gian khóa → `POST /auth/dang-nhap` trả `423 ACCOUNT_LOCKED` kèm thời điểm mở khóa, **không kiểm tra mật khẩu** (đúng hay sai cũng bị chặn như nhau) | 🔴 | API |
| 55 | Sai tên đăng nhập và sai mật khẩu trả **cùng một thông báo** `UNAUTHORIZED` — không tiết lộ tài khoản có tồn tại hay không (ngoại lệ: `423` tự nó đã tiết lộ tài khoản tồn tại — đánh đổi chấp nhận theo spec) | 🔴 | API |
| 56 | `POST /auth/doi-mat-khau`: mật khẩu mới ≥8 ký tự, có cả chữ và số, khác mật khẩu cũ, và (nếu tài khoản gắn hồ sơ học viên) khác chuỗi ngày sinh `ddmmyyyy` — vi phạm trả `VALIDATION_ERROR` kèm `fields` | 🔴 | API |
| 57 | `POST /auth/dang-nhap` và `GET /hoc-vien/kiem-tra-trung`: giới hạn 10 request/phút/IP, vượt quá trả `429 RATE_LIMITED` (`@nestjs/throttler`, áp riêng 2 route này — không đăng ký guard toàn cục) | 🔴 | API |
| 58 | `POST /nguoi-dung/{id}/dat-lai-mat-khau` (`quan_tri`): chỉ áp dụng tài khoản `vai_tro='hoc_vien'`; đặt mật khẩu về ngày sinh `ddmmyyyy`, `phai_doi_mat_khau=true`, xóa `khoa_den`/bộ đếm sai, ghi `nhat_ky_dat_lai_mat_khau` | 🔴 (quy trình) | API |

## Hồ sơ đầy đủ (T9, 2026-09-28 — mo-rong-nls-an-giang.md)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 59 | "Đầy đủ" = qua toàn bộ quy tắc #1-26b của luồng `tu_dang_ky` (`validateHocVien(requireFull=true)`) — cảnh báo 🟡 KHÔNG làm hồ sơ "chưa đầy đủ", chỉ lỗi 🔴 mới tính. Tính động (`HocVienService.danhGiaDayDu`), không lưu cột tính sẵn | 🔴 | API (`GET /hoc-vien/toi/muc-do-day-du`, `GET /hoc-vien?day_du=`) |

## Đợt xác nhận & lịch sử thay đổi hồ sơ (T14, 2026-09-28 — mo-rong-nls-an-giang.md, QĐ7)

Thay rule #27/#28 **CHỈ cho hồ sơ `nguon_tao='import_moet'`** — `tu_dang_ky` giữ nguyên #27/#28 như cũ.

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 60 | "Đợt đang mở" của 1 học viên = đợt (bất kỳ `loai`) có `mo_luc <= now() < dong_luc` và (`khoa_id IS NULL` hoặc học viên đã ghi danh đúng `khoa_id` đó qua `dang_ky_hoc`) | 🔴 | API (`DotXacNhanService.dotDangMoCuaHocVien`) |
| 61 | Các đợt không được chồng thời gian trong cùng phạm vi (`khoa_id`, kể cả cùng NULL) | 🔴 | API (`DotXacNhanService.kiemTraChongCheo`, kiểm tra khi tạo/gia hạn đợt — DB không có EXCLUDE constraint cho việc này) |
| 62 | `import_moet`: `PATCH /hoc-vien/toi`, `POST`/`DELETE /hoc-vien/toi/chuyen-mon`, `POST /hoc-vien/toi/xac-nhan` chỉ thực hiện được khi có đợt đang mở — ngoài giờ đợt trả `403 DOT_XAC_NHAN_DONG` (bất kể `trang_thai`, hồ sơ `import_moet` luôn `da_duyet`) | 🔴 | API |
| 63 | `import_moet` sửa được mọi trường khai báo (kể cả `ho_ten`, ngày sinh, `don_vi_cong_tac_id`) qua PATCH trong đợt mở; **không** sửa được `ma_dinh_danh_moet`, `nguon_tao`, trạng thái (không có trong `UpdateHocVienDto`) | 🔴 | API |
| 64 | Mỗi TRƯỜNG thay đổi giá trị (so với hồ sơ trước đó, không phải mỗi request) → 1 dòng `lich_su_thay_doi_ho_so`, cùng transaction với `hoc_vien.update`. `la_truong_goc_moet=true` cho đúng 7 trường: `ho_ten`, `ngay_sinh`, `thang_sinh`, `nam_sinh`, `don_vi_cong_tac_id`, `chuc_vu`, `so_dien_thoai_lien_he` (+ `chuyen_mon` qua POST/DELETE riêng) — các trường khác (CCCD, `noi_sinh` **[sửa 2026-09-30, trước đây `noi_sinh_id`/`phuong_xa_id`]**, `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` **[mới 2026-09-30]**, email, trình độ, cấp/môn giảng dạy, ghi chú) vẫn ghi lịch sử nhưng `la_truong_goc_moet=false` | 🔴 | DB (bảng `lich_su_thay_doi_ho_so`) + API (`HocVienService.tinhDiffHoSo`) |
| 65 | Nếu học viên đã có xác nhận còn hiệu lực (`xac_nhan_ho_so.con_hieu_luc=true`) ở đợt đang mở mà sửa hồ sơ/chuyên môn tiếp → xác nhận đó `con_hieu_luc=false`, `vo_hieu_luc_luc=now()`; response của endpoint sửa trả thêm `xac_nhan_bi_huy: true` | 🔴 | API (`DotXacNhanService.huyXacNhanNeuCo`, cùng transaction) |
| 66 | Đổi ngày sinh **không** đổi mật khẩu (mật khẩu chỉ đổi qua `POST /auth/doi-mat-khau`, không có logic nào tự sync lại theo `ngay_sinh` sau lần đăng nhập đầu — rule #35) | 🔴 | API |
| 67 | `POST /hoc-vien/toi/xac-nhan` (`import_moet`): bắt buộc đợt đang mở **và** `day_du=true` (T9) — thiếu 1 trong 2 → lỗi tương ứng (`403 DOT_XAC_NHAN_DONG` hoặc `400 VALIDATION_ERROR` kèm `fields`=danh sách thiếu); tạo `xac_nhan_ho_so.du_lieu` = bản chụp response `GET /hoc-vien/toi` tại thời điểm xác nhận; gửi lại email `hoc_vien_xac_nhan` | 🔴 | API |
| 68 | Ngoài giờ đợt: học viên chỉ xem (`GET` không bị chặn); Quản trị vẫn sửa được qua `PATCH /hoc-vien/{id}` (không bị chặn bởi đợt), ghi lịch sử với `vai_tro_nguoi_sua='quan_tri'` | 🔴 | API |

## Cổng điều kiện làm đánh giá đầu vào & tài khoản VLE (T15, 2026-09-28 — mo-rong-nls-an-giang.md, QĐ8/QĐ9)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 69 | Import `tai_khoan_vle`: xác định học viên bằng HocVienResolver dùng chung — phải có ít nhất 1 trong `so_dinh_danh_ca_nhan`/`ma_dinh_danh_moet`; có cả 2 thì phải trỏ cùng 1 hồ sơ, không thì dòng lỗi | 🔴 | API (`resolveHocVienImportRow`) |
| 70 | `mat_khau_tam` (import `tai_khoan_vle`) mã hóa AES-256-GCM (`vle-crypto.util.ts`, khóa `VLE_SECRET_KEY`) trước khi lưu `tai_khoan_vle.mat_khau_tam_ma_hoa` — DB **không bao giờ** chứa mật khẩu dạng rõ | 🔴 | API + DB (`bytea`) |
| 71 | Mật khẩu tạm **không bao giờ** xuất hiện trong: response API quản trị (`GET /import/{id}`, `GET /bao-cao/dieu-kien-danh-gia`...), file lỗi import (`GET /import/{id}/file-loi` tự ẩn cột `mat_khau_tam`), log ứng dụng | 🔴 | API |
| 72 | Đủ điều kiện làm đánh giá đầu vào = có `xac_nhan_ho_so.con_hieu_luc=true` ở 1 đợt `loai='xac_nhan_truoc_danh_gia'` áp dụng cho học viên **và** `day_du=true` (T9) tại thời điểm gọi `GET /hoc-vien/toi/danh-gia-dau-vao` — không cần đợt đó đang mở lúc gọi | 🔴 | API (`HocVienService.danhGiaDauVaoCuaToi`) |
| 73 | Chưa đủ điều kiện (ở bất kỳ trạng thái nào) → response **không** chứa `duong_dan`/`ten_dang_nhap_vle`/`mat_khau_tam` | 🔴 | API |
| 74 | Đợt `xac_nhan_truoc_danh_gia` áp dụng cho học viên đã đóng (`dong_luc <= now()`) mà học viên chưa đủ điều kiện → `{ du_dieu_kien: false, het_han: true }` (QĐ9) — vào danh sách xử lý riêng (`GET /bao-cao/dieu-kien-danh-gia`) | 🔴 | API |
| 75 | Sửa hồ sơ sau khi đã xác nhận đợt 2 → xác nhận đó hết hiệu lực (rule #65) → mất điều kiện xem thông tin VLE cho tới khi xác nhận lại | 🔴 | API (liên kết #65 + #72) |

## Xác minh email liên hệ & quên/đặt lại mật khẩu (2026-09-30)

`token_xac_thuc` dùng 1 lần, KHÔNG dùng JWT (không thu hồi sớm được) — token gốc chỉ tồn tại trong email gửi đi, DB chỉ lưu `token_hash` (SHA-256 hex).

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 76 | Đổi `email_lien_he` (giá trị mới khác giá trị cũ, qua `PATCH /hoc-vien/toi` hoặc `PATCH /hoc-vien/{id}`) → `hoc_vien.email_da_xac_minh=false` + tạo token `xac_minh_email` (hết hạn 24 giờ) + gửi email chứa link `FRONTEND_URL/xac-minh-email?token=...` tới địa chỉ MỚI. Gửi lại `email_lien_he` y hệt giá trị cũ hoặc sửa trường khác không đụng `email_lien_he` → không reset cờ, không tạo token | 🔴 | API (`HocVienService.suaHoSo` + `taoVaGuiXacMinhEmail`) |
| 77 | `POST /hoc-vien/toi/gui-lai-xac-minh-email`: chưa có `email_lien_he` → `400 VALIDATION_ERROR`; đã `email_da_xac_minh=true` → `409 CONFLICT`; còn token `xac_minh_email` hiệu lực tạo dưới 60 giây trước → `429 RATE_LIMITED` (chặn spam, không gửi lại) | 🔴 | API |
| 78 | `POST /auth/xac-minh-email`: token phải đúng loại `xac_minh_email`, chưa hết hạn, chưa dùng — sai bất kỳ điều kiện nào trả **chung 1 thông báo lỗi**, không tiết lộ lý do cụ thể (sai/hết hạn/đã dùng). Hợp lệ → `hoc_vien.email_da_xac_minh=true` + đánh dấu token `da_dung_luc=now()`, cùng transaction | 🔴 | API (`AuthService.xacMinhEmail`) |
| 79 | `POST /auth/quen-mat-khau`: **LUÔN** trả `{ da_gui: true }` bất kể tài khoản có tồn tại, có phải học viên, có `email_lien_he`, hay email đã xác minh hay không — không tiết lộ qua response lẫn qua thời gian phản hồi (cùng nguyên tắc rule #9/#55) | 🔴 | API (`AuthService.quenMatKhau`) |
| 80 | `quen-mat-khau` chỉ thực sự tạo token + gửi email khi tài khoản là `vai_tro='hoc_vien'` **và** có `email_lien_he` **và** `email_da_xac_minh=true`; tạo token `dat_lai_mat_khau` (hết hạn 30 phút) VÔ HIỆU các token `dat_lai_mat_khau` CHƯA DÙNG trước đó của cùng học viên (chỉ token mới nhất dùng được); còn token hiệu lực tạo dưới 60 giây trước → bỏ qua, không tạo mới (chặn spam) | 🔴 | API |
| 81 | `POST /auth/quen-mat-khau` giới hạn 10 request/phút/IP (`429 RATE_LIMITED`, dùng chung `ThrottlerGuard` với rule #57) | 🔴 | API |
| 82 | `POST /auth/dat-lai-mat-khau`: token phải đúng loại `dat_lai_mat_khau`, chưa hết hạn, chưa dùng — sai bất kỳ điều kiện nào trả chung 1 thông báo lỗi (cùng nguyên tắc rule #78). `mat_khau_moi` áp dụng CÙNG độ phức tạp rule #56 (≥8 ký tự, có chữ và số, khác ngày sinh `ddmmyyyy`), riêng "khác mật khẩu cũ" so bằng `bcrypt.compare` với hash hiện tại (không có mật khẩu cũ dạng chữ rõ) | 🔴 | API (`AuthService.datLaiMatKhau`) |
| 83 | Đặt lại mật khẩu thành công → cập nhật `mat_khau_hash`, `phai_doi_mat_khau=false`, đánh dấu token vừa dùng **và** vô hiệu MỌI token `dat_lai_mat_khau` chưa dùng khác của cùng học viên (cùng transaction) | 🔴 | API |

## Loại lớp & Cụm học viên (QĐ10, 2026-09-30 — mo-rong-nls-an-giang.md)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 84 | `lop_hoc.loai_lop` bắt buộc đúng 1 trong 3 giá trị (`truc_tiep`\|`zoom`\|`vle`) — 3 loại lớp **độc lập hoàn toàn** với nhau (không phải lớp cha chứa lớp con): 1 học viên có thể đồng thời thuộc 1 lớp trực tiếp, 1 lớp zoom, 1 "lớp" vle mà không liên quan gì nhau về thành viên. Tên lớp (`ten_lop`) chỉ duy nhất TRONG cùng 1 loại lớp của 1 khóa (`uq_lop_ten_trong_khoa` = `(khoa_id, loai_lop, ten_lop)`) — được phép trùng tên GIỮA các loại lớp khác nhau | 🔴 | DB (`UNIQUE(khoa_id, loai_lop, ten_lop)`, cột `NOT NULL`) |
| 85 | `dang_ky_hoc_lop.loai_lop` (bản sao giá trị tại thời điểm gán) phải luôn khớp `lop_hoc.loai_lop` của chính `lop_id` được gán — không khớp thì từ chối với `VALIDATION_ERROR` rõ ràng. Không dùng DB trigger cho việc này (khác `trg_dang_ky_lop_thuoc_khoa` cũ đã bị xóa) — kiểm tra ở tầng service, áp dụng cho cả luồng import `phan_lop_hoc_vien` lẫn `PATCH /dang-ky-hoc/{id}/lop` | 🔴 | API (`KhoaBoiDuongService.assertLopThuocKhoaVaLoai`) |
| 86 | Mỗi `dang_ky_hoc` chỉ có tối đa 1 `dang_ky_hoc_lop` cho mỗi `loai_lop` (không thể có 2 lớp trực tiếp cùng lúc, tương tự cho zoom/vle) — `PATCH /dang-ky-hoc/{id}/lop` là **upsert** theo `(dang_ky_hoc_id, loai_lop)`, gọi lại với `lop_id` khác sẽ THAY THẾ lớp cũ của đúng loại đó, không cộng dồn | 🔴 | DB (`UNIQUE(dang_ky_hoc_id, loai_lop)`) |
| 87 | `cum_hoc_vien` là khái niệm **độc lập hoàn toàn** với cây đơn vị công tác (`don_vi_cong_tac`) VÀ với 3 loại lớp — chứa **học viên trực tiếp** qua `dang_ky_hoc.cum_id`, không qua trung gian lớp nào. Tên cụm (`ten_cum`) chỉ duy nhất trong 1 khóa (`uq_cum_ten_trong_khoa`). `cum_id` gán cho `dang_ky_hoc` phải thuộc đúng `khoa_id` của chính đăng ký học đó | 🔴 | DB (`UNIQUE(khoa_id, ten_cum)`) + API (kiểm tra `cum.khoa_id === dang_ky_hoc.khoa_id` ở `PATCH /dang-ky-hoc/{id}/cum` và luồng import) |

## Điểm danh & kết quả giai đoạn (T12, 2026-09-30 — mo-rong-nls-an-giang.md)

Điểm danh nhập qua **IMPORT EXCEL**, không có giao diện chấm tay từng buổi (xem mục 5 `api-contract.md`).

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 88 | Import `diem_danh`: `loai_lop` **bắt buộc** (khác `lop_va_lich_hoc` — không có mặc định `truc_tiep`) vì điểm danh phải khớp đúng 1 buổi cụ thể trong số có thể nhiều lớp trùng tên khác loại trong cùng khóa (QĐ10). Xác định buổi qua `(khoa_id, loai_lop, ten_lop)` → lớp, rồi `(lop_id, giai_doan_id, buoi_so)` → buổi — không tìm thấy học viên/đăng ký học/lớp/giai đoạn/buổi thì dòng lỗi | 🔴 | API (`KhoaBoiDuongService.resolveDiemDanhRow`) |
| 89 | Mỗi `diem_danh` chỉ có tối đa 1 dòng cho mỗi cặp `(dang_ky_hoc_id, lich_hoc_id)` — import `diem_danh` là **upsert** theo cặp này, chạy lại file cùng học viên/buổi sẽ GHI ĐÈ dòng cũ (`trang_thai`, `nguon`, `ghi_chu`), không cộng dồn | 🔴 | DB (`UNIQUE(dang_ky_hoc_id, lich_hoc_id)` = `uq_diem_danh`) |
| 90 | Học viên điểm danh ở buổi thuộc lớp **KHÁC** lớp mình đang được gán cho đúng `loai_lop` đó (học bù, kể cả khi chưa được gán lớp nào của `loai_lop` này) → dòng vẫn được lưu, thêm cảnh báo 🟡 vào `danh_sach_canh_bao` (không chặn) — NHƯNG **bắt buộc** phải có `ghi_chu` trong trường hợp này; thiếu `ghi_chu` → dòng lỗi 🔴 (chặn), không phải cảnh báo | 🔴 (thiếu `ghi_chu`) / 🟡 (có `ghi_chu`) | API (`KhoaBoiDuongService.resolveDiemDanhRow`) |
| 91 | Import `ket_qua_giai_doan`: học viên xác định được phải **đã ghi danh** vào đúng khóa đó (`dang_ky_hoc` cho `(hoc_vien_id, khoa_id)` đã tồn tại, cùng quy tắc `ket_qua_danh_gia` T5) — chưa ghi danh thì dòng lỗi rõ ràng, import này **không** tự tạo `dang_ky_hoc`. `ty_le_hoan_thanh` (khi có giá trị) giới hạn 0–100 | 🔴 | API (`KhoaBoiDuongService.resolveKetQuaGiaiDoanRow`) + DB (`CHECK (ty_le_hoan_thanh BETWEEN 0 AND 100)` = `chk_ket_qua_giai_doan_ty_le`) |
| 92 | Mỗi `ket_qua_giai_doan` chỉ có tối đa 1 dòng cho mỗi cặp `(dang_ky_hoc_id, giai_doan_id)` — import là **upsert** theo cặp này, chạy lại file ghi đè `ty_le_hoan_thanh`/`diem`, không cộng dồn | 🔴 | DB (`UNIQUE(dang_ky_hoc_id, giai_doan_id)` = `uq_ket_qua_giai_doan`) |
| 93 | `GET /hoc-vien/toi/khoa-hoc` và `GET /hoc-vien/{id}/khoa-hoc` trả thêm `trang_thai_diem_danh` cho mỗi buổi (cả 3 khối `lop_truc_tiep`/`lop_zoom`/`lop_vle`) — `null` nếu học viên chưa được điểm danh cho buổi đó, KHÔNG suy diễn thành "vắng" | 🔴 | API (`KhoaBoiDuongService.khoaHocTheoHocVienId`) |

## Cấu hình khảo sát đầu vào (2026-10-02 — api-contract.md mục 9)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 94 | `PUT /cau-hinh-khao-sat` chỉ `quan_tri`; `GET` công khai | 🔴 | API (`@Roles` cấp method — KHÔNG đặt cấp class vì sẽ chặn luôn route `@Public()`) |
| 95 | `che_do_hoc_vien` ∈ {`khao_sat`, `dang_nhap`}; `danh_gia_dau_vao_trong_cong`, `hien_khao_sat` là boolean | 🔴 | API (DTO) + FE (zod) |
| 96 | `phieu` tối đa 10; mỗi phiếu: `ten` 1–200 ký tự, `mo_ta` ≤ 1000, `lien_ket` 1–5 mục; mỗi đường dẫn: `nhan` 1–100 ký tự, `url` rỗng HOẶC URL `http://`/`https://` hợp lệ ≤ 1000 ký tự (chặn `javascript:` …) | 🔴 | API (DTO) + FE (zod) |
| 97 | `che_do_hoc_vien = khao_sat` thì bắt buộc `hien_khao_sat = true` (học viên không có chỗ nào để làm khảo sát) | 🔴 | API (`CauHinhKhaoSatService.luuCauHinh`) + FE |
| 98 | `hien_khao_sat = true` thì cần ít nhất 1 phiếu | 🔴 | API + FE |
| 99 | Chuỗi được trim (và NFC ở FE) trước khi lưu; thứ tự `phieu` giữ nguyên như gửi lên | 🟡 | API + FE |

## Đối tượng học viên & SSO sang hệ thống khảo sát (2026-10-02 — api-contract.md mục 9, 10)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 100 | `doi_tuong` ∈ {`giao_vien`, `can_bo_quan_ly`}; NULL được phép lưu (hồ sơ cũ/import chưa chọn) | 🔴 | DB (enum) + API (DTO `@IsEnum`) + FE (zod) |
| 101 | Hồ sơ **chưa chọn `doi_tuong`** → **không "đầy đủ"** (thêm 1 mục vào `thieu`). Đặt trong `danhGiaDayDu`, KHÔNG trong `validateHocVien` (bộ quy tắc đó còn dùng cho `POST /hoc-vien` tự đăng ký — không chặn luồng tạo hồ sơ) | 🔴 | API (`HocVienService.danhGiaDayDu`) |
| 102 | Sửa `doi_tuong` ghi `lich_su_thay_doi_ho_so` như các trường hồ sơ khác; học viên `import_moet` chỉ tự sửa được khi có Đợt xác nhận đang mở (T14) — quản trị sửa được mọi lúc | 🔴 | API |
| 103 | `kenh_danh_gia` ∈ {`sso`, `vle`}, bắt buộc khi PUT cấu hình; đọc cấu hình cũ thiếu trường → `vle` | 🔴 | API (DTO + `layKenhDanhGia`) |
| 104 | `POST /sso/cap-ma`: chỉ `hoc_vien`; chỉ khi `kenh_danh_gia = sso` **và** hồ sơ đầy đủ (dùng chung cổng M6); `target` ∈ {`khao-sat`, `danh-gia`} hoặc bỏ trống | 🔴 | API |
| 105 | Mã SSO: 32 byte ngẫu nhiên, DB chỉ lưu SHA-256, hết hạn 5 phút, đổi được đúng 1 lần (UPDATE nguyên tử), sai API key **không** đốt mã | 🔴 | API (`SsoService`) + DB (`UNIQUE(ma_hash)`) |
| 106 | `POST /sso/doi-ma` không trả CCCD/ngày sinh/email/SĐT; thiếu `SSO_KHAO_SAT_API_KEY` → 503 | 🔴 | API |

## Cấu hình khảo sát theo khóa (2026-10-02 — api-contract.md mục 9)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 107 | Cấu hình riêng của khóa dùng **cùng** quy tắc với cấu hình chung (#95–99) | 🔴 | API (`CauHinhKhaoSatService.chuanHoa` dùng chung) |
| 108 | `tinh_id` (tùy chọn) phải là địa danh cấp `tinh_thanh`; mỗi tỉnh gắn tối đa 1 khóa — gắn tỉnh đã thuộc khóa khác → 409, nêu mã khóa đang giữ | 🔴 | API + DB (`UNIQUE(tinh_id)` = `uq_cau_hinh_khao_sat_khoa_tinh`) |
| 109 | Cấu hình cho học viên = khóa **đã duyệt** đã ghi danh có cấu hình riêng, nhiều khóa → `ngay_duyet` gần nhất; không có → cấu hình chung. Trang chủ/danh sách tỉnh chỉ tính khóa đã duyệt | 🔴 | API (`layChoHocVien`, `layTheoTinh`, `danhSachTinh`) |
| 110 | Xóa cấu hình riêng không ảnh hưởng cấu hình chung; khóa bị xóa → cấu hình riêng xóa theo | 🔴 | API + DB (`ON DELETE CASCADE`) |
