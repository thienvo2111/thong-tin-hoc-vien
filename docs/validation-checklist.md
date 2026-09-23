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
| 8b | **Không giả định** Mã định danh CSDL MOET (`ma_dinh_danh_moet`) trùng giá trị với ĐDCN — quan hệ này chưa được xác nhận (2026-09-23, "đang xem xét"). Hai cột tách biệt, không có ràng buộc đồng bộ giữa chúng | ghi nhận rủi ro / quyết định thiết kế | — |

## Ngày / tháng / năm sinh (`ngay_sinh`, `thang_sinh`, `nam_sinh`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 9 | 3 trường tách biệt, đều bắt buộc | 🔴 | DB (`NOT NULL`) |
| 10 | `ngay_sinh` 1–31, `thang_sinh` 1–12 | 🔴 | DB (`CHECK`) |
| 11 | Tổ hợp ngày/tháng/năm phải là ngày thực tế trong lịch (bắt 31/04, 30/02, 29/02 năm không nhuận...) | 🔴 | API (dùng thư viện date, trả lỗi rõ ràng) — DB có `CHECK` dự phòng qua `make_date()` nhưng lỗi SQL thô, **không dùng làm nguồn thông báo lỗi cho người dùng** |
| 12 | Tuổi tối thiểu hợp lý so với khóa bồi dưỡng (mặc định ≥ 15 tuổi — xác nhận lại với nghiệp vụ thực tế trước khi khóa cứng) | 🔴 | DB (`CHECK` biên dưới) + API (so với ngày bắt đầu khóa nếu cần chính xác hơn theo từng khóa) |

## Nơi sinh / Phường-Xã (`noi_sinh_id`, `phuong_xa_id` → `dia_danh`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 13 | Bắt buộc **khi `nguon_tao='tu_dang_ky'`**; với `import_moet` để trống lúc tạo (không có trong danh sách tiếp nhận MOET), bắt buộc khi người dùng tự bổ sung. Luôn chọn từ danh mục — không nhập tự do | 🔴 | DB (FK, cho phép NULL) + UI (chỉ cho chọn, không có ô nhập tay) + API (bắt buộc có điều kiện) |
| 14 | `noi_sinh_id` phải có `cap = 'tinh_thanh'` | 🔴 | API (kiểm tra `cap` trước khi lưu — DB không ràng buộc chéo cột được bằng CHECK đơn giản) |
| 15 | `phuong_xa_id` phải có `cap = 'phuong_xa_dac_khu'` **và** `parent_id` (sau khi truy ngược) khớp `noi_sinh_id` đã chọn | 🔴 | API |
| 16 | Danh mục có thể `trang_thai='ngung'` (do sáp nhập địa giới) — bản ghi cũ vẫn hiển thị đúng cho hồ sơ lịch sử, nhưng **không cho chọn mới** | 🔴 (khi tạo mới) | API |

## Đơn vị công tác (`don_vi_cong_tac_id`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 17 | Bắt buộc chọn từ danh mục (tìm kiếm autocomplete với `tu_dang_ky`; khớp theo tên cột "Đơn vị" khi `import_moet`), không tự thêm đơn vị mới tại form học viên | 🔴 | DB (FK) + UI / API (import) |
| 18 | Chỉ cho chọn đơn vị `trang_thai='active'` và `loai_don_vi='truong'` (học viên thuộc về Trường, không thuộc trực tiếp Sở/Phòng) | 🔴 | API |

## Liên hệ (`so_dien_thoai_lien_he`, `email_lien_he`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 19 | `so_dien_thoai_lien_he` luôn bắt buộc (có ở cả 2 luồng — cột "Số điện thoại" có trong danh sách MOET). `email_lien_he` bắt buộc **chỉ khi `nguon_tao='tu_dang_ky'`**; với `import_moet` để trống, bắt buộc khi tự bổ sung (không có trong danh sách MOET) | 🔴 | DB (`so_dien_thoai_lien_he NOT NULL`, `email_lien_he` cho phép NULL) + API (email bắt buộc có điều kiện) |
| 20 | Số điện thoại đúng định dạng VN (10 số, đầu 0, hoặc +84) | 🔴 | API (regex) |
| 21 | Email đúng định dạng chuẩn (RFC 5322 rút gọn) khi có giá trị | 🔴 | API |

## Trình độ & chuyên môn

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 22 | `trinh_do_chuyen_mon` bắt buộc **khi `tu_dang_ky`**; `import_moet` để trống (không có trong danh sách MOET), bắt buộc khi tự bổ sung | 🔴 | DB (`ENUM`, cho phép NULL) + API (bắt buộc có điều kiện) |
| 23 | Nếu chọn `khac`, bắt buộc `trinh_do_chuyen_mon_khac` | 🔴 | DB (`CHECK`, NULL-safe) |
| 24 | Chuyên môn (`hoc_vien_chuyen_mon`, **1-nhiều**) — text tự do mỗi giá trị, **cố ý không FK/danh mục**, chấp nhận dữ liệu không đồng nhất (vd "Sư phạm Toán" ≠ "SP Toán"), **không có bước chuẩn hóa/gộp tự động hay thủ công** (quyết định đã chốt). Ít nhất 1 giá trị bắt buộc khi `tu_dang_ky`; với `import_moet`, tách từ cột "Chuyên môn" của file (phân tách `;`) — xác nhận thực tế 1 người có thể có nhiều chuyên môn | 🔴 (≥1 giá trị, không rỗng) | DB (bảng con `hoc_vien_chuyen_mon`, `UNIQUE(hoc_vien_id, chuyen_mon)`) + API |
| 25 | `cap_giang_day` bắt buộc **khi `tu_dang_ky`** — khai theo **từng học viên**, không suy ra từ trường (đúng cho trường liên cấp). Với `import_moet` để trống, **CHƯA CHỐT**: có bắt buộc bổ sung sau với `chuc_vu='Nhân viên'` (không trực tiếp giảng dạy) hay không — cần xác nhận nghiệp vụ | 🔴 khi `tu_dang_ky` / ⚠️ chưa chốt khi import | DB (cho phép NULL) + API |
| 26 | `mon_giang_day_id` bắt buộc **khi `tu_dang_ky`**, danh sách lọc theo `cap_giang_day` đã chọn (dropdown phụ thuộc). Cùng tình trạng "chưa chốt" như #25 với hồ sơ `import_moet` | 🔴 khi `tu_dang_ky` / ⚠️ chưa chốt khi import | DB (FK, cho phép NULL) + API |
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
| 34 | `ten_dang_nhap` = `so_dinh_danh_ca_nhan` (tự đăng ký) hoặc `ma_dinh_danh_moet` (import) — gán **1 lần lúc tạo, không tự đổi theo dữ liệu hồ sơ về sau** kể cả khi CCCD được bổ sung muộn. Mật khẩu mặc định = ngày sinh (định dạng thống nhất, ví dụ `ddmmyyyy`) cho cả 2 luồng | 🔴 | DB (`ten_dang_nhap UNIQUE NOT NULL`, tách khỏi `email`) + API |
| 35 | `phai_doi_mat_khau=true` mặc định — chặn thao tác khác cho tới khi đổi mật khẩu | 🔴 | API (middleware kiểm tra cờ này sau đăng nhập) |
| 36 | Rủi ro đã ghi nhận: không xác thực danh tính khi tự đăng ký (biết ĐDCN người khác là khai được thay) — **quyết định chấp nhận**, dựa vào bước Trường/Phòng VHXH/Sở duyệt làm điểm xác minh chính, không thêm bước xác thực khác | ghi nhận rủi ro | — |

## Nguồn tạo hồ sơ & import nhân sự CSDL MOET (`hoc_vien.nguon_tao`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 36b | Mọi hồ sơ có `nguon_tao ∈ {tu_dang_ky, import_moet}`; ràng buộc chéo: `tu_dang_ky` → `so_dinh_danh_ca_nhan` bắt buộc có ngay; `import_moet` → `ma_dinh_danh_moet` bắt buộc có ngay | 🔴 | DB (`CHECK chk_hoc_vien_nguon_tao`) |
| 36c | Hồ sơ `import_moet` nhận `trang_thai='da_duyet'` **ngay khi import** (danh sách tiếp nhận coi như đã xác thực), `nguoi_duyet_id` = tài khoản Quản trị đã chạy import, `cap_duyet_thuc_te='quan_tri'` — **không** qua lại luồng duyệt Trường/Phòng VHXH/Sở | 🔴 (quy trình) | API |
| 36d | `da_duyet` ngay **không đồng nghĩa hồ sơ đầy đủ** — nhiều trường vẫn `NULL` (CCCD, nơi sinh, phường xã, email, trình độ, cấp giảng dạy, môn giảng dạy). API phải chặn các hành động cần hồ sơ đầy đủ (vd đăng ký khóa bồi dưỡng) cho tới khi người dùng tự bổ sung xong | 🔴 | API |
| 36e | Cột "Đơn vị" trong file import khớp với `don_vi_cong_tac.ten_don_vi` — không khớp được hoặc khớp nhiều hơn 1 kết quả → dòng lỗi (không tự đoán) | 🔴 | API (Dịch vụ Import) |
| 36f | `ma_dinh_danh_moet` duy nhất — dòng import trùng mã đã tồn tại → dòng lỗi (không tự động ghi đè hồ sơ cũ) | 🔴 | DB (`UNIQUE`) + API |

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
| 45 | Import `phan_lop_hoc_vien`: dòng lỗi nếu ĐDCN không tồn tại/chưa `da_duyet`, khóa/lớp không tồn tại, hoặc học viên đã có `dang_ky_hoc` khác cho cùng `khoa_id` (vi phạm `UNIQUE(hoc_vien_id, khoa_id)`) | 🔴 | API + DB (`UNIQUE` bắt lỗi tầng cuối) |
| 45b | Import `ho_so_nhan_su_moet`: quy tắc riêng ở mục "Nguồn tạo hồ sơ & import nhân sự CSDL MOET" (#36b–36f) | 🔴 | API |
| 46 | File nguồn gốc lưu lại ở object storage, không chỉ lưu kết quả (có thể tra soát lại) | — | Hạ tầng (`Main.dc.html` — Object Storage) |

## Khóa bồi dưỡng & Lớp học

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 47 | Chỉ Trường tạo khóa; Sở/Phòng VHXH không có endpoint tạo khóa (chỉ duyệt) | 🔴 | API (kiểm tra `vai_tro` ở tầng route) |
| 48 | `giai_doan_khoa.thu_tu` duy nhất trong 1 khóa, không có thứ tự cố định dùng chung giữa các khóa | 🔴 | DB (`UNIQUE(khoa_id, thu_tu)`) |
| 49 | `thoi_gian_ket_thuc >= thoi_gian_bat_dau` cho khóa, giai đoạn, lịch học lớp | 🔴 | DB (`CHECK`) |
| 50 | `lich_hoc_lop.lop_id` và `.giai_doan_id` phải cùng thuộc 1 `khoa_id` | 🔴 | API (kiểm tra chéo trước khi insert — DB không ràng buộc trực tiếp vì 2 FK khác bảng) |
| 51 | `dang_ky_hoc.lop_id` (nếu có) phải thuộc đúng `dang_ky_hoc.khoa_id` | 🔴 | DB (trigger `trg_dang_ky_lop_thuoc_khoa`) |
| 52 | `dang_ky_hoc.khoa_id` gán ngay khi hồ sơ học viên `da_duyet`; `lop_id` **chỉ gán qua Import bởi Quản trị hệ thống**, không có API gán tay từng người (số lượng lớn) | 🔴 (quy trình) | API (không expose `PATCH dang_ky_hoc.lop_id` ngoài luồng import) |
