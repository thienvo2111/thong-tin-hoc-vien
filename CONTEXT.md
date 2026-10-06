# CONTEXT.md

Ngôn ngữ domain và các quyết định nền tảng của hệ thống "Thu thập thông tin học viên". Đọc trước khi khám phá codebase hoặc đặt tên khái niệm mới (issue, test, biến). Nguồn sự thật chi tiết hơn: [docs/api-contract.md](docs/api-contract.md), [docs/database-ddl.sql](docs/database-ddl.sql) (⚠️ xem ghi chú lệch pha bên dưới), [docs/validation-checklist.md](docs/validation-checklist.md), [README.md](README.md), và khi nghi ngờ tài liệu lệch với code — **tin `backend/prisma/schema.prisma` làm nguồn sự thật cuối cùng**.

**⚠️ Lệch pha tài liệu đã biết (phát hiện 2026-10-01):** `docs/database-ddl.sql` và `docs/mo-rong-nls-an-giang.md` chưa được cập nhật theo QĐ10 và T12 dù 2 việc này **đã code xong thật** trong `backend/prisma/schema.prisma` (model `dang_ky_hoc_lop`, `cum_hoc_vien`, `diem_danh`, `ket_qua_giai_doan` đều đã tồn tại, có service + import + unit test). Đừng tin README/tài liệu kế hoạch nói "T12 chưa làm" — luôn verify lại bằng code trước khi tạo issue cho các task đã có vẻ "chưa làm" theo tài liệu.

## Hệ thống là gì

Công cụ phối hợp giữa **Sở GD&ĐT**, **Phòng Văn hóa - Xã hội** (thuộc UBND cấp Xã), **Trường/đơn vị đào tạo** và **Học viên** để thu thập, xác nhận và quản lý thông tin học viên tham gia các **khóa bồi dưỡng**. Mô hình monolith: NestJS + Prisma + PostgreSQL ở `backend/`, React (Vite) ở `frontend/`.

## Tác nhân (vai_tro)

| Vai trò | Phạm vi (scope) |
|---|---|
| `quan_tri` | Toàn hệ thống (`'ALL'`), không gắn `don_vi_id` |
| `so_gddt` | Đơn vị mình + mọi đơn vị con (BFS theo `don_vi_cha_id`) |
| `phong_vhxh` | Đơn vị mình + mọi đơn vị con |
| `truong` | Chỉ đơn vị mình (trường) |
| `hoc_vien` | Không có scope đơn vị — chỉ truy cập hồ sơ của chính mình qua `hoc_vien_id` |
| `ho_tro_hoc_vien` | (ADR 0003, 2026-10-06 — đã code đủ: tài khoản, phân công, tra cứu/xuất, sửa hồ sơ có lý do, mật khẩu, yêu cầu hỗ trợ theo cụm) Cán bộ HCMUE. Không có scope đơn vị — chỉ học viên có `dang_ky_hoc.cum_id` thuộc các cụm trong `phan_cong_ho_tro` của mình, kiểm tra động mỗi request qua `HoTroHocVienScopeService`. Khu làm việc `/ho-tro` |
| `ho_tro_giang_vien`, `giang_vien` | **Đề xuất — chưa code** (ADR 0004, 2026-10-06). Phân vai: Quản trị = thiết lập + chốt + giám sát; Người hỗ trợ giảng viên = vận hành lớp/đợt (nhóm theo **khóa** qua `phan_cong_ho_tro_gv`, scope service lộ API cấp lớp) — sửa giờ/điểm học buổi có lý do, phân công GV, hậu cần, thực địa theo đợt–lớp, nạp điểm danh/kết quả, duyệt đề nghị đổi lớp; Người hỗ trợ học viên thêm báo vắng + đề nghị đổi lớp. Giảng viên: chỉ đọc lớp có `phan_cong_giang_day` của mình (đảo một phần QĐ5). Mẫu biểu do Quản trị tải lên theo khóa; nhắc lịch = tin nhắn soạn sẵn, không email. Tiên quyết T10/T11 |

**1 tài khoản = 1 vai trò.** Nhóm hỗ trợ giảng viên sau này = vai trò riêng `ho_tro_giang_vien` + bảng phân công + service phạm vi riêng (ADR 0003); cán bộ làm cả 2 việc dùng 2 tài khoản.

**Chính quyền 2 cấp:** không còn Phòng Giáo dục cấp huyện. Sở GD&ĐT quản lý trực tiếp Trường THPT; Phòng Văn hóa - Xã hội quản lý Trường Mầm non/Tiểu học/THCS trên địa bàn.

**Phân quyền scope-based suy ra động** qua cây `DonViCongTac.don_vi_cha_id` (`ScopeService`, BFS cycle-safe) — không có bảng phân quyền riêng. Cấp trên duyệt thay được cấp dưới.

**R1/R2** (ADR 0001, 2026-10-03) — 2 quy tắc xem khóa bồi dưỡng cho `so_gddt`/`phong_vhxh`/`truong`, thay cơ chế "đơn vị theo dõi" đã xóa: **R1 (đặt hàng)** — `khoa.don_vi_dat_hang_id` nằm trong phạm vi của caller → thấy khóa + TOÀN BỘ học viên của khóa; **R2 (tham gia)** — không thỏa R1 nhưng có học viên thuộc phạm vi caller ghi danh vào khóa → thấy khóa, chỉ thấy học viên thuộc phạm vi mình. Thỏa cả 2 → theo R1. Cài đặt: `ScopeService.getKhoaIdsXemDuoc`/`getHocVienScopeTrongKhoa`.

## Thực thể cốt lõi (và tên gọi chuẩn — dùng đúng, đừng đổi từ đồng nghĩa)

- **HocVien** (hồ sơ học viên) — `trang_thai`: `nhap → cho_duyet → da_duyet` (hoặc `tu_choi`). `nguon_tao`: `tu_dang_ky` (tự đăng ký) hoặc `import_moet` (import từ MOET).
- **DonViCongTac** — đơn vị công tác (`loai_don_vi`: `truong` | `khac`), cây cha-con qua `don_vi_cha_id`.
- **DiaDanh** — địa danh (tỉnh/xã), dùng cho `noi_sinh`/`dia_ban`.
- **NguoiDung** — tài khoản đăng nhập, gắn `vai_tro` + (`don_vi_id` hoặc `hoc_vien_id`).
- **Tài khoản đơn vị** (ADR 0002, 2026-10-03) — `NguoiDung` vai trò `so_gddt`/`phong_vhxh`/`truong`, **đúng 1 / đơn vị**, do Quản trị cấp ở `/admin/nguoi-dung` (tạo lẻ hoặc import `tai_khoan_don_vi`). Tên đăng nhập = mã đơn vị viết thường hoặc tên gợi nhớ (vd `sgd-angiang`), khớp không phân biệt hoa/thường; email tùy chọn.
- **Mật khẩu tạm** — mật khẩu ngẫu nhiên 10 ký tự Quản trị nhận **1 lần** (màn hình hoặc file `.xlsx` của import) để tự gửi cho đơn vị; buộc đổi ở lần đăng nhập đầu. Khác "mật khẩu mặc định = ngày sinh" của học viên.
- **Link kích hoạt** — token `kich_hoat_tai_khoan` (72 giờ, 1 lần) gửi qua email cho tài khoản đơn vị có email; mở trang `/dat-lai-mat-khau` dùng chung với quên mật khẩu.
- **MonHoc**, **ChuyenMon** (text tự do có autocomplete, KHÔNG phải danh mục quản trị).
- **KhoaBoiDuong** — khóa bồi dưỡng. **Từ ADR 0001 (2026-10-03, `docs/adr/0001-don-vi-dat-hang.md`):** chỉ **Quản trị** (= **Đơn vị tổ chức (HCMUE)** — Trường ĐHSP TP.HCM, hằng số hiển thị, **không lưu** trong DB, mọi khóa đều do HCMUE tổ chức) tạo và quản lý khóa; Sở/Phòng VHXH/Trường chỉ xem (không còn Trường tự tạo, không còn luồng nộp duyệt/duyệt). Khóa có `trang_thai='da_duyet'` ngay khi tạo (enum `trang_thai_khoa` giữ nguyên `nhap`/`cho_duyet`/`tu_choi`/`da_duyet`/`dong_dang_ky` cho dữ liệu lịch sử, nhưng khóa mới chỉ dùng `da_duyet`/`dong_dang_ky`). Mỗi khóa có đúng 1 **Đơn vị đặt hàng** (`don_vi_dat_hang_id`, FK `DonViCongTac` loại `so_gddt`/`truong`/`khac` — không nhận `phong_vhxh`) — khác hẳn khái niệm "Đơn vị tổ chức": đơn vị đặt hàng là ai THUÊ/YÊU CẦU khóa (một Sở, một trường, hoặc 1 đơn vị khác đặt cho nhiều Sở), còn HCMUE luôn là bên tổ chức thực hiện.
- **GiaiDoanKhoa** — giai đoạn của khóa = **hình thức × nhóm** (vd "Zoom – nhóm 1", "Trực tiếp – đợt 5"); không có thực thể "đợt" riêng. `link_hoac_dia_diem` / `huong_dan` (spec 2026-10-02) — thông tin chung hiện ở M7 cho học viên **không được gán lớp** ở giai đoạn đó (điển hình: đánh giá đầu vào/đầu ra).
- **LopHoc** — `loai_lop` (`truc_tiep`|`zoom`|`vle`) là **3 loại lớp ĐỘC LẬP HOÀN TOÀN** (không phải lớp cha/con) — 1 học viên có thể cùng lúc ở 1 lớp trực tiếp + 1 lớp zoom + 1 "lớp" vle không liên quan thành viên nhau. Unique theo `(khoa_id, loai_lop, ten_lop)` — được phép trùng tên lớp giữa các loại khác nhau trong cùng khóa.
- **LichHocLop** — 1 lớp có nhiều buổi (`buoi_so`) trong cùng giai đoạn; unique `(lop_id, giai_doan_id, buoi_so)`.
- **PhanLopGiaiDoan** (spec 2026-10-02 `docs/superpowers/specs/2026-10-02-phan-lop-theo-giai-doan-design.md`) — gán 1 `DangKyHoc` vào tối đa 1 `LopHoc` **cho mỗi `GiaiDoanKhoa`**, unique `(dang_ky_hoc_id, giai_doan_id)`. Thay hoàn toàn `DangKyHocLop` (QĐ10, 1 lớp mỗi `loai_lop` — đã drop, migration `20261002100000`). **`DangKyHoc` KHÔNG có cột `lop_id`** — mọi gán lớp đi qua bảng này. Import `phan_lop_hoc_vien`: mỗi học viên 1 dòng, mỗi giai đoạn 1 cột `GĐ<n> - <tên>`, ô trống = giữ, `-` = gỡ; bắt buộc `ma_khoa`. Học bù (import điểm danh) so với lớp được gán ở **đúng giai đoạn của buổi**.
- **CumHocVien** (cụm học viên, QĐ10) — nhóm Zalo hỗ trợ theo địa lý, khái niệm **độc lập hoàn toàn với cây đơn vị công tác và với lớp**; gán trực tiếp qua `DangKyHoc.cum_id`, không qua lớp nào. Trên giao diện gọi là **"Cụm hỗ trợ N"**. Với học viên đã đăng nhập, cụm trong DB là nguồn sự thật; `frontend/src/content/nhomZaloTheoCum.ts` chỉ là bản tra cứu công khai (theo tên trường) cho người chưa đăng nhập — Quản trị giữ 2 nguồn khớp nhau.
- **Người hỗ trợ học viên** (`ho_tro_hoc_vien`, ADR 0003) / **Phân công hỗ trợ** (`phan_cong_ho_tro`, nhiều–nhiều người ↔ cụm, vận hành 1 người/1 cụm, Quản trị gán ở màn chi tiết khóa). **KHÁC** "Nhân sự lớp – hỗ trợ" (`lop_hoc_nhan_su.vai_tro = 'ho_tro'`): đó chỉ là thông tin liên hệ trợ giảng của 1 lớp, không có tài khoản. Người hỗ trợ học viên tra cứu, sửa hồ sơ (bắt buộc lý do), gửi link đặt lại mật khẩu/cấp mật khẩu tạm/mở khóa, trả lời yêu cầu hỗ trợ — chỉ trong cụm của mình.
- **DangKyHoc** — ghi danh học viên vào khóa. `khoa_id` **chỉ được gán qua import `phan_lop_hoc_vien` bởi Quản trị hệ thống** — không có tự ghi danh, không có tự động hóa (đã bị gỡ bỏ sau khi phát hiện giả định sai, xem lịch sử trong memory dự án). Có `muc_dau_vao`/`muc_dau_ra` (enum `muc_nang_luc`: `co_ban`/`thanh_thao`/`nang_cao`, T5) và `ket_qua` (enum `ket_qua_hoc`: `dang_hoc`/`dat`/`khong_dat`/`vang`).
- **DiemDanh** (T12, đã code xong) — điểm danh học viên theo từng buổi (`LichHocLop`), nhập qua import, unique `(dang_ky_hoc_id, lich_hoc_id)`, upsert khi chạy lại.
- **KetQuaGiaiDoan** (T12, đã code xong) — tiến độ/điểm theo từng `GiaiDoanKhoa` (vd tỉ lệ hoàn thành VLE), nhập qua import, unique `(dang_ky_hoc_id, giai_doan_id)`.
- **DotXacNhan** / **XacNhanHoSo** / **LichSuThayDoiHoSo** — cửa sổ xác nhận hồ sơ theo đợt; mỗi lần sửa trường trong đợt mở ghi 1 dòng lịch sử; hồ sơ `import_moet` chỉ sửa được khi có đợt đang mở.
- **TaiKhoanVLE** — tài khoản hệ thống học trực tuyến (VLE), `mat_khau_tam` mã hóa AES-256-GCM ở tầng ứng dụng — **không bao giờ lưu plaintext**, kể cả trong file lỗi import.
- **NhatKyImport**, **NhatKyThongBao** — bảng nhật ký/audit trail.
- **DiemHoc** (T10, #2, 2026-10-07) — danh mục điểm học trực tiếp; buổi thuộc giai đoạn `truc_tiep` bắt buộc có `lich_hoc_lop.diem_hoc_id`. `lich_hoc_lop.cap_nhat_luc` chỉ đổi khi giờ/địa điểm/điểm học/phòng thật sự đổi — mọi sửa buổi đã có đi qua `LichHocThayDoiService`.
- **GiangVien** / **PhanCongGiangDay** (T11, #3, 2026-10-07) — danh mục giảng viên (SĐT duy nhất bắt buộc, email duy nhất tùy chọn) và phân công vào từng buổi; luật (không trùng giờ, không gỡ phân công đã xác nhận giờ) chỉ ở `PhanCongGiangDayService`. Giờ dạy chỉ tính phân công `da_xac_nhan_gio`. `lop_hoc_nhan_su` vẫn giữ (text liên hệ cũ).
- **Chưa tồn tại:** `ChungNhan` (T13, #6).

## Luồng nghiệp vụ chính

- **Chế độ triển khai** (2026-10-02; quản trị cấu hình ở `/admin/cau-hinh-khao-sat`, lưu bảng `cau_hinh_he_thong` khóa `khao_sat_dau_vao`, `GET /cau-hinh-khao-sat` công khai; mặc định khi chưa lưu ở `frontend/src/content/trienKhai.ts`): `che_do_hoc_vien` = `khao_sat` (giai đoạn 1 kiểu An Giang — học viên KHÔNG đăng nhập, làm tuần tự các phiếu khảo sát ngoài ở khối `khaoSatDauVao` trang chủ, bổ sung thông tin ngay trong phiếu; Quản trị đổ dữ liệu về qua import `ho_so_nhan_su_moet`/`ket_qua_danh_gia`/`phan_lop_hoc_vien`) hoặc `dang_nhap` (cổng học viên). `danh_gia_dau_vao_trong_cong` bật/tắt menu M6; danh sách phiếu (thứ tự = thứ tự làm, nhiều đường dẫn/phiếu khi tách theo đối tượng GV/CBQL). Quyền **sửa** hồ sơ `import_moet` vẫn chỉ do Đợt xác nhận quyết định — không mở đợt = học viên chỉ xem (Quản trị và Người hỗ trợ học viên sửa hộ được ngoài đợt). **Điều chỉnh 2026-10-06:** học viên An Giang phải **đăng nhập cổng mới làm được khảo sát** — không còn kịch bản "học viên không đăng nhập".
- **Yêu cầu hỗ trợ** (`yeu_cau_ho_tro`, M8): 1 hỏi – 1 đáp, hỏi tiếp = ticket mới (cờ `hoi_lai`). Ticket tới người hỗ trợ theo cụm **tính động** từ `dang_ky_hoc.cum_id`; học viên chưa có cụm → chỉ Quản trị. Trả lời = UPDATE có điều kiện `cho_xu_ly` (đã có người trả lời → 409, không ghi đè). Chỉ Quản trị "Sửa câu trả lời" → email học viên + reset đánh giá (ADR 0003 H11–H12).
- **Cấu hình khảo sát theo khóa** (2026-10-02, bảng `cau_hinh_khao_sat_khoa`): cấu hình chung là MẶC ĐỊNH; khóa nào chọn phương án khác thì có cấu hình riêng + gắn 1 tỉnh. Học viên đăng nhập nhận cấu hình theo **khóa đã ghi danh** (`GET /cau-hinh-khao-sat/cua-toi`); trang chủ công khai theo **tỉnh người xem chọn** (`?tinh=`). Vì vậy nên **ghi danh học viên vào khóa ngay sau import MOET** (import `phan_lop_hoc_vien` chỉ có `ma_khoa`, để trống cột lớp), phân lớp làm sau.
- **Đối tượng học viên** (`hoc_vien.doi_tuong`, 2026-10-02): `giao_vien` | `can_bo_quan_ly`, học viên **tự chọn** ở M4 (KHÔNG suy từ `chuc_vu` — cột đó là chữ tự do lộn xộn). NULL = chưa chọn → hồ sơ **chưa đầy đủ** (quy tắc nằm ở `danhGiaDayDu`, không ở `validateHocVien`).
- **SSO sang hệ thống khảo sát** (2026-10-02, `backend/src/sso/`, api-contract mục 10): khi `kenh_danh_gia = sso`, M6 chỉ cần hồ sơ đầy đủ; bấm nút → `POST /sso/cap-ma` (mã 1 lần, 5 phút, chỉ lưu hash) → chuyển tới `SSO_KHAO_SAT_URL?code=&target=` → máy chủ khảo sát đổi mã qua `POST /sso/doi-ma` (header `X-API-Key`). Kênh `vle` = luồng T15 cũ (mặc định). Hệ thống khảo sát **chưa triển khai**.
- **Kết quả khảo sát** (2026-10-04, `ket_qua_khao_sat`, api-contract mục 10.1): trạng thái từng bài (`chua_lam`/`da_mo`/`dang_lam`/`hoan_thanh` + mức) — cổng tự ghi "đã mở" khi đổi mã SSO, hệ thống khảo sát báo về `POST /sso/ket-qua`, hoặc quản trị import Excel `ket_qua_khao_sat`. "Cần kiểm tra lại" = đã mở/đang làm quá 24 giờ chưa nộp. Mức chỉ để theo dõi — **không** thay `muc_dau_vao` (quản trị chốt qua `ket_qua_danh_gia`).
- **Tự phục vụ:** học viên tự đăng ký, tài khoản tự sinh (tên đăng nhập = ĐDCN/CCCD, mật khẩu mặc định = ngày sinh ddmmyyyy), **bắt buộc đổi mật khẩu lần đầu**.
- **Xác nhận bắt buộc** trước khi hồ sơ chuyển trạng thái chính thức + gửi email bản sao dữ liệu.
- **Phân lớp học viên chủ yếu qua Import** (Excel/CSV, `phan_lop_hoc_vien`) do Quản trị hệ thống thực hiện; từ QĐ10, Admin UI cũng cho sửa tay phân lớp theo từng giai đoạn + cụm Zalo ở màn chi tiết học viên — xem [frontend/src/pages/Admin/AdminHocVienChiTiet.tsx](frontend/src/pages/Admin/AdminHocVienChiTiet.tsx).
- **Danh mục dùng chung** (địa danh, đơn vị công tác, môn học) là khóa ngoại, import có validate theo dòng — không nhập tự do; `ChuyenMon` là ngoại lệ (text tự do).
- **Điều kiện vào đánh giá đầu vào** (`GET /hoc-vien/toi/danh-gia-dau-vao`): cần đợt xác nhận `xac_nhan_truoc_danh_gia` đang mở + hồ sơ "đầy đủ" (`day_du`, tính động, không lưu cột sẵn) — kiểm tra tại thời điểm gọi, không cache.

## Quy ước code

- Tên biến/bảng/API field: **tiếng Việt không dấu, snake_case** (vd. `hoc_vien`, `don_vi_cong_tac_id`, `trang_thai`). Giữ nguyên quy ước này khi thêm field/endpoint mới.
- Response field có hậu tố `_ten` (vd. `noi_sinh_ten`) = tên đã join sẵn cho hiển thị — chỉ một số endpoint cụ thể trả về (`toResponseVoiTen`), không phải mặc định toàn bộ.
- `trang_thai` là state machine rõ ràng theo từng thực thể — không tự suy luận trạng thái mới ngoài enum đã định nghĩa trong DDL.

## Trước khi thêm khái niệm mới

Nếu một khái niệm chưa có trong CONTEXT.md này — hoặc là bạn đang bịa ngôn ngữ mới (cân nhắc lại, dùng từ đã có), hoặc đây là một khoảng trống thật sự (ghi chú lại, cập nhật file này khi khái niệm được chốt).
