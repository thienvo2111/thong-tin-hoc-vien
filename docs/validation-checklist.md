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
| 34 | `ten_dang_nhap` = `so_dinh_danh_ca_nhan` (tự đăng ký) hoặc `ma_dinh_danh_moet` (import) — gán **1 lần lúc tạo, không tự đổi theo dữ liệu hồ sơ về sau** kể cả khi CCCD được bổ sung muộn. Mật khẩu mặc định = ngày sinh (định dạng thống nhất, ví dụ `ddmmyyyy`) cho cả 2 luồng | 🔴 | DB (`ten_dang_nhap UNIQUE NOT NULL`, tách khỏi `email`) + API |
| 35 | `phai_doi_mat_khau=true` mặc định — chặn thao tác khác cho tới khi đổi mật khẩu | 🔴 | API (middleware kiểm tra cờ này sau đăng nhập) |
| 36 | Rủi ro đã ghi nhận: không xác thực danh tính khi tự đăng ký (biết ĐDCN người khác là khai được thay) — **quyết định chấp nhận**, dựa vào bước Trường/Phòng VHXH/Sở duyệt làm điểm xác minh chính, không thêm bước xác thực khác | ghi nhận rủi ro | — |

## Nguồn tạo hồ sơ & import nhân sự CSDL MOET (`hoc_vien.nguon_tao`)

| # | Quy tắc | Mức | Nơi thực thi |
|---|---|---|---|
| 36b | Mọi hồ sơ có `nguon_tao ∈ {tu_dang_ky, import_moet}`; ràng buộc chéo: `tu_dang_ky` → `so_dinh_danh_ca_nhan` bắt buộc có ngay; `import_moet` → `ma_dinh_danh_moet` bắt buộc có ngay | 🔴 | DB (`CHECK chk_hoc_vien_nguon_tao`) |
| 36c | Hồ sơ `import_moet` nhận `trang_thai='da_duyet'` **ngay khi import** (danh sách tiếp nhận coi như đã xác thực), `nguoi_duyet_id` = tài khoản Quản trị đã chạy import, `cap_duyet_thuc_te='quan_tri'` — **không** qua lại luồng duyệt Trường/Phòng VHXH/Sở | 🔴 (quy trình) | API |
| 36d | `da_duyet` ngay **không đồng nghĩa hồ sơ đầy đủ** — nhiều trường vẫn `NULL` (CCCD, nơi sinh, phường xã, email, trình độ, cấp giảng dạy, môn giảng dạy). API phải chặn các hành động cần hồ sơ đầy đủ (vd đăng ký khóa bồi dưỡng) cho tới khi người dùng tự bổ sung xong | 🔴 | API |
| 36e | Cột "Đơn vị" trong file import khớp với `don_vi_cong_tac.ten_don_vi` — không khớp được hoặc khớp nhiều hơn 1 kết quả → dòng lỗi (không tự đoán). **T4 (2026-09-28)**: nếu file có cột tùy chọn "Mã đơn vị" (giá trị khác trống) thì khớp `don_vi_cong_tac.ma_don_vi` **ưu tiên hơn** tên — dùng khi tên trường trùng giữa nhiều đơn vị (sau sáp nhập An Giang – Kiên Giang) | 🔴 | API (Dịch vụ Import) |
| 36f | `ma_dinh_danh_moet` duy nhất — dòng import trùng mã đã tồn tại → dòng lỗi (không tự động ghi đè hồ sơ cũ) | 🔴 | DB (`UNIQUE`) + API |
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
| 45 | Import `phan_lop_hoc_vien`: dòng lỗi nếu ĐDCN không tồn tại/chưa `da_duyet`, mã khóa không tồn tại, hoặc `ten_lop` (khi có giá trị) không tồn tại trong đúng `khoa_id` đó. **Đã sửa 2026-09-25**: chạy lại import cho cùng `(hoc_vien_id, khoa_id)` KHÔNG còn là lỗi — là upsert hợp lệ (xem rule #52) | 🔴 | API |
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
| 52 | **Đã sửa 2026-09-25** (bản trước giả định `khoa_id` tự gán khi hồ sơ `da_duyet` — sai, không có cơ sở "học viên thuộc khóa nào" khi tự động; xem `database-ddl.sql` ghi chú triển khai): cả `dang_ky_hoc.khoa_id` **và** `lop_id` đều **chỉ gán qua Import `phan_lop_hoc_vien` bởi Quản trị hệ thống** — không tự động theo hồ sơ duyệt, không phải học viên tự chọn/đăng ký. `ten_lop` trong file import là tùy chọn: để trống → chỉ ghi danh vào khóa (`lop_id=NULL`); có giá trị → ghi danh + phân lớp cùng lúc. Không có API gán tay từng người (số lượng lớn). | 🔴 (quy trình) | API (không expose endpoint tạo/sửa `dang_ky_hoc` ngoài luồng import) |

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
| 64 | Mỗi TRƯỜNG thay đổi giá trị (so với hồ sơ trước đó, không phải mỗi request) → 1 dòng `lich_su_thay_doi_ho_so`, cùng transaction với `hoc_vien.update`. `la_truong_goc_moet=true` cho đúng 7 trường: `ho_ten`, `ngay_sinh`, `thang_sinh`, `nam_sinh`, `don_vi_cong_tac_id`, `chuc_vu`, `so_dien_thoai_lien_he` (+ `chuyen_mon` qua POST/DELETE riêng) — các trường khác (CCCD, nơi sinh, phường xã, email, trình độ, cấp/môn giảng dạy, ghi chú) vẫn ghi lịch sử nhưng `la_truong_goc_moet=false` | 🔴 | DB (bảng `lich_su_thay_doi_ho_so`) + API (`HocVienService.tinhDiffHoSo`) |
| 65 | Nếu học viên đã có xác nhận còn hiệu lực (`xac_nhan_ho_so.con_hieu_luc=true`) ở đợt đang mở mà sửa hồ sơ/chuyên môn tiếp → xác nhận đó `con_hieu_luc=false`, `vo_hieu_luc_luc=now()`; response của endpoint sửa trả thêm `xac_nhan_bi_huy: true` | 🔴 | API (`DotXacNhanService.huyXacNhanNeuCo`, cùng transaction) |
| 66 | Đổi ngày sinh **không** đổi mật khẩu (mật khẩu chỉ đổi qua `POST /auth/doi-mat-khau`, không có logic nào tự sync lại theo `ngay_sinh` sau lần đăng nhập đầu — rule #35) | 🔴 | API |
| 67 | `POST /hoc-vien/toi/xac-nhan` (`import_moet`): bắt buộc đợt đang mở **và** `day_du=true` (T9) — thiếu 1 trong 2 → lỗi tương ứng (`403 DOT_XAC_NHAN_DONG` hoặc `400 VALIDATION_ERROR` kèm `fields`=danh sách thiếu); tạo `xac_nhan_ho_so.du_lieu` = bản chụp response `GET /hoc-vien/toi` tại thời điểm xác nhận; gửi lại email `hoc_vien_xac_nhan` | 🔴 | API |
| 68 | Ngoài giờ đợt: học viên chỉ xem (`GET` không bị chặn); Quản trị vẫn sửa được qua `PATCH /hoc-vien/{id}` (không bị chặn bởi đợt), ghi lịch sử với `vai_tro_nguoi_sua='quan_tri'` | 🔴 | API |
