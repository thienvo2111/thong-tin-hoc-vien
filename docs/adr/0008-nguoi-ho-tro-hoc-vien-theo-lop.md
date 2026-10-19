# ADR 0008 — Người hỗ trợ học viên được gắn vào lớp (ngoài cụm) + xuất danh sách lớp

- Ngày: 2026-10-16
- Trạng thái: Đã chấp nhận
- Bổ sung (không thay thế): ADR 0003 — phân công theo **cụm** (`phan_cong_ho_tro`) giữ nguyên
- Đặc tả: [2026-10-16-ho-tro-theo-lop-design.md](../superpowers/specs/2026-10-16-ho-tro-theo-lop-design.md)

## Bối cảnh

Lớp Zoom có nhân sự hỗ trợ riêng theo lớp (mở phòng, điểm danh, nhắn học viên vào học), không theo cụm Zalo địa lý. Có người vừa hỗ trợ một cụm vừa hỗ trợ lớp Zoom; có người hỗ trợ nhiều lớp Zoom cùng lúc. Hiện người hỗ trợ học viên chỉ thấy học viên trong cụm của mình (ADR 0003 H1/H3), nên với học viên lớp mình phụ trách nhưng ở cụm khác thì không tra cứu, không sửa hồ sơ, không cấp lại mật khẩu được, và không có danh sách lớp để đối chiếu khi điểm danh.

## Quyết định

| # | Quyết định |
|---|---|
| L1 | **Bảng phân công lớp, cùng vai trò `ho_tro_hoc_vien`.** Bảng mới `phan_cong_ho_tro_lop (nguoi_dung_id, lop_id)` nhiều–nhiều, song song `phan_cong_ho_tro` (cụm). Chỉ nhận tài khoản `vai_tro = 'ho_tro_hoc_vien'`. Không tạo vai trò/tài khoản mới — 1 người vừa giữ cụm vừa giữ lớp dùng 1 tài khoản. Quản trị gán qua `PUT /khoa-boi-duong/{id}/lop/{lopId}/nguoi-ho-tro` (thay toàn bộ, rỗng = gỡ hết) ở bảng Lớp học của chi tiết khóa. |
| L2 | **Phạm vi = cụm ∪ lớp gốc.** Học viên thuộc phạm vi khi có `dang_ky_hoc` thuộc cụm của tôi **hoặc** có `phan_lop_giai_doan` vào lớp được gắn. **Đổi buổi không tính** (nhất quán ADR 0007: đọc theo lớp giữ lớp gốc). `HoTroHocVienScopeService` vẫn là điểm kiểm tra duy nhất, truy vấn động mỗi request (gỡ phân công có hiệu lực ngay); ngoài phạm vi vẫn `404`. |
| L3 | **Quyền với học viên của lớp = như học viên trong cụm**: tra cứu chi tiết, sửa hồ sơ (bắt buộc lý do), gửi link đặt lại/cấp mật khẩu tạm/mở khóa, báo vắng, đề nghị đổi lớp (đăng ký học được chọn khi thuộc cụm của tôi **hoặc** có phân lớp vào lớp của tôi). |
| L4 | **Vẫn chỉ theo cụm**: định tuyến yêu cầu hỗ trợ, nhắc lịch cụm, thống kê, duyệt đổi buổi, danh sách học viên hiện có (`GET /ho-tro-hoc-vien/hoc-vien` + `/xuat`), lịch học. Người hỗ trợ lớp xem học viên lớp qua trang riêng `/ho-tro/lop`. |
| L5 | **Excel lớp có NGÀY SINH** theo yêu cầu người dùng (đối chiếu khi hỗ trợ Zoom). Rủi ro: ngày sinh là mật khẩu mặc định, file có thể bị chuyển qua Zalo — người dùng **chấp nhận**. **Sửa 2026-10-17 (yêu cầu người dùng):** file lớp, file buổi và màn hình có thêm **mã MOET** ngay sau Họ tên (ô văn bản, giữ số 0 đầu). Vẫn **không** có CCCD/số định danh, nơi sinh. ADR 0003 H6 (không ngày sinh) chỉ áp cho file **cụm**. Mỗi lần xuất ghi nhật ký `ho_tro_xuat_danh_sach_lop`. |
| L6 | **Gán theo lớp, không theo buổi.** Một lớp có thể nhiều người hỗ trợ; một người nhiều lớp. |
| L7 | **Danh sách theo BUỔI (bổ sung 2026-10-17).** Trang lớp có thêm tab "Theo buổi": danh sách 1 buổi = phân lớp (lớp, giai đoạn) − người đổi ra + người đổi vào, đọc qua `DoiBuoiHocQueryService.dieuChinhTheoBuoi` (chỉ đổi buổi `da_duyet` còn hiệu lực; chờ duyệt/từ chối không làm đổi danh sách). Người **đổi vào** xuất hiện trong danh sách và file buổi, **kể cả ngày sinh**, ghi chú "Đổi buổi – từ lớp <lớp nguồn>" — nhưng vẫn **ngoài phạm vi sửa** (L2 không đổi: không có link chi tiết, mở chi tiết → `404`). Người **đổi ra** không tính vào danh sách buổi, liệt kê riêng ("Đã chuyển sang lớp <lớp chốt> – không học buổi này") để người hỗ trợ không điểm vắng nhầm. Xuất Excel theo buổi (1 sheet/buổi, cột Ghi chú) ghi nhật ký `ho_tro_xuat_danh_sach_buoi`. Tab "Cả lớp" và file lớp giữ lớp gốc như L5. |
| L8 | **Điểm danh trên DS buổi + chuyên cần trên DS lớp (bổ sung 2026-10-17).** Mỗi dòng DS buổi (thường + đổi vào) có `diem_danh` đọc tại **chính buổi đó** theo `dang_ky_hoc_id` của dòng (người đổi vào: đăng ký của họ — điểm danh ở buổi chốt gắn với đăng ký gốc): có dòng `diem_danh` → `co_mat` ("Có mặt – tự điểm danh HH:mm" giờ VN khi có `tu_diem_danh_luc`, ngược lại "Có mặt (Zoom/Ký tên/QR/Thủ công)" theo `nguon`), "Vắng", "Vắng có phép"; không có dòng nhưng có `bao_vang` → "Đã báo vắng: <lý do>"; không có gì → "Chưa đến giờ" (buổi chưa bắt đầu) hoặc "Chưa điểm danh". Người đổi ra: `diem_danh = null`. `buoi.tong_diem_danh` đếm trên DS buổi (không gồm đổi ra). DS lớp: `chuyen_can = { co_mat, da_dien_ra }` (hiển thị "x/y", cột "Có mặt / đã diễn ra") — với mỗi buổi L của lớp thuộc giai đoạn mà đăng ký được phân vào **lớp này**, buổi hiệu dụng E = buổi chốt nếu có đổi buổi `da_duyet` còn hiệu lực ra khỏi L (`DoiBuoiHocQueryService.doiBuoiDaDuyetCuaDangKy`), ngược lại L; tính *đã diễn ra* khi E đã bắt đầu, *có mặt* khi điểm danh (đăng ký, E) = `co_mat` (nhất quán ADR 0007: chuyên cần tính ở buổi chốt). ~~Khác `tinhChuyenCan` (dashboard, ADR 0005 Z8): không xét `che_do_chuyen_can`/điểm danh lớp cũ~~ — **sửa 2026-10-19 (ADR 0010 T7):** trạng thái mỗi buổi (DS buổi, `tong_diem_danh`, *có mặt* của `chuyen_can`) = kết quả `tinhChuyenCan` cho `(giai_doan, buoi_so)` của buổi — tính cả học bù / lớp cũ theo `che_do_chuyen_can` như dashboard, `diem_danh` thêm `nguon_tinh`, `lop_tinh`, nhãn "Có mặt – ở lớp X" khi dòng ở lớp khác. Vẫn chỉ trong lớp đang xem; mẫu số là số buổi đã diễn ra (E đã bắt đầu), không phải số buổi có dòng điểm danh. Nhãn tính ở backend (`ho-tro-hoc-vien/diem-danh-lop-buoi.util.ts`), màn hình và Excel dùng chung. Không migration. |

## Phương án đã loại

- **Gắn theo từng buổi (`lich_hoc_lop`)** — Quản trị phải gán quá nhiều (lớp Zoom nhiều buổi × nhiều giai đoạn), dễ sót.
- **Nối `lop_hoc_nhan_su` (vai trò hỗ trợ, chữ tự do từ import) với tài khoản** — dữ liệu nhập tay không khóa, khớp theo tên dễ sai, trộn thông tin liên hệ với phân quyền.
- **Tài khoản/vai trò riêng cho hỗ trợ Zoom** — người làm cả cụm lẫn lớp phải có 2 tài khoản, 2 lần đăng nhập, quyền tách rời trên cùng một học viên.

## Hệ quả

- 1 migration chỉ thêm bảng (`20261016200000_phan_cong_ho_tro_lop`), không đụng dữ liệu cũ; sau deploy chưa ai được gắn lớp — hành vi hiện có không đổi.
- `GET /khoa-boi-duong/{id}` trả thêm `lop_hoc[].nguoi_ho_tro` (chỉ Quản trị); `GET /nguoi-dung/ho-tro` thêm `lop_phu_trach`.
- API mới cho người hỗ trợ: `GET /ho-tro-hoc-vien/lop-cua-toi`, `GET /ho-tro-hoc-vien/lop/{lopId}/hoc-vien`, `GET /ho-tro-hoc-vien/lop/xuat`.
- Người hỗ trợ lớp thấy được hồ sơ học viên ở cụm khác — chấp nhận vì cùng là cán bộ HCMUE hỗ trợ học viên đó trong lớp.
- Học viên đổi buổi **vào** lớp của tôi không nằm trong **phạm vi** của tôi (không xem chi tiết/sửa); người hỗ trợ cụm của học viên đó vẫn xử lý. Từ L7 họ **có** trong danh sách theo buổi của buổi chốt (để điểm danh), không có trong tab "Cả lớp".
- L7 (2026-10-17): API `GET /ho-tro-hoc-vien/lop/{lopId}/buoi`, `GET /ho-tro-hoc-vien/lop/{lopId}/buoi/{lichId}/hoc-vien`, `GET /ho-tro-hoc-vien/lop/{lopId}/buoi/xuat?lich_id=`; không migration.
- L5 sửa + L8 (2026-10-17): DS/file lớp và buổi thêm `ma_dinh_danh_moet`; DS buổi thêm `diem_danh` mỗi dòng + `buoi.tong_diem_danh`, file buổi thêm cột Điểm danh, Giờ tự điểm danh và dòng tổng hợp; DS/file lớp thêm `chuyen_can` ("Có mặt / đã diễn ra"). File cụm không đổi. Không migration.
