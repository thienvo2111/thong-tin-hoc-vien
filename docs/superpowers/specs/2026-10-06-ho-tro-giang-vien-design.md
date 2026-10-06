# Đặc tả — Người hỗ trợ giảng viên, phân vai vận hành, Hồ sơ chuẩn bị lớp, Cổng giảng viên, Tin nhắn nhắc lịch (2026-10-06)

Quyết định nền: [ADR 0004](../../adr/0004-ho-tro-giang-vien-va-cong-giang-vien.md) (G1–G15; Q1–Q7 đã chốt 2026-10-06, Q8 chờ mẫu). Mẫu đã làm: [ADR 0003](../../adr/0003-nguoi-ho-tro-hoc-vien.md) + [đặc tả hỗ trợ học viên](2026-10-06-ho-tro-hoc-vien-design.md). Ngôn ngữ domain: [CONTEXT.md](../../../CONTEXT.md).

## 0. Thuật ngữ

| Thuật ngữ | Nghĩa | Tài khoản |
|---|---|---|
| **Người hỗ trợ học viên** (`ho_tro_hoc_vien`) | Cán bộ HCMUE phụ trách 1 **cụm** Zalo (ADR 0003) | Có |
| **Người hỗ trợ giảng viên** (`ho_tro_giang_vien`) | Cán bộ HCMUE trong **nhóm hỗ trợ GV của khóa** — cả nhóm thấy mọi lớp của khóa | Có |
| **Giảng viên** (`giang_vien`) | Người dạy, phân công vào buổi qua `phan_cong_giang_day` (T11) | Có, chỉ đọc |
| **Người hỗ trợ thực địa** | Người có mặt tại điểm học trong đợt (đón GV, mở phòng, thiết bị, ký tên) | Không |
| **Trợ giảng** (`lop_hoc_nhan_su.ho_tro`) | Liên hệ trợ giảng của lớp (đã có) | Không |
| **Đợt (của lớp)** | (lớp, giai đoạn `truc_tiep`) — các buổi của lớp trong giai đoạn đó | — |
| **Hồ sơ chuẩn bị lớp** | Trang tổng hợp 1 đợt | — |
| **Mẫu biểu khóa** | File `.xlsx` Quản trị tải lên cho khóa, có ký hiệu `{{...}}` | — |
| **Tin nhắn nhắc lịch** | Nội dung hệ thống soạn sẵn, cán bộ tự gửi qua Zalo/SMS rồi bấm "Đã gửi" | — |
| **Báo vắng** | Ghi nhận trước học viên sẽ vắng 1 buổi, có lý do | — |
| **Đề nghị đổi lớp** | Yêu cầu chuyển học viên sang lớp khác cùng giai đoạn, chờ nhóm hỗ trợ GV duyệt | — |

**Cụm** (địa lý, của học viên) ≠ **lớp** (học tập). Liên thông đi qua **học viên** (`dang_ky_hoc.cum_id` × `phan_lop_giai_doan.lop_id`).

## 1. Phân vai — ai làm gì (chốt Q2, mục tiêu giảm tải Quản trị)

Ký hiệu: **T** = thực hiện, **D** = duyệt/chốt, **X** = xem, — = không.

| Việc | Quản trị | Hỗ trợ GV (khóa) | Hỗ trợ HV (cụm) | Giảng viên |
|---|---|---|---|---|
| **Cấu trúc** | | | | |
| Tạo khóa, giai đoạn, lớp; thêm/xóa buổi (import `lop_va_lich_hoc`) | T | X | X | — |
| Ghi danh, phân lớp, gán cụm **hàng loạt** (import) | T | X | X | — |
| Cấp tài khoản người hỗ trợ (2 loại), phân công nhóm/cụm | T | — | — | — |
| Cấu hình bảng kiểm + mẫu biểu của khóa | T | X | — | — |
| **Vận hành lớp / đợt** | | | | |
| Sửa giờ / điểm học / phòng của buổi chưa diễn ra (lý do bắt buộc) | T | **T** | X | X |
| Danh mục điểm học: tạo/sửa | T | **T** | — | — |
| Danh mục điểm học / giảng viên: ngưng, gộp trùng | T | — | — | — |
| Danh mục giảng viên: tạo/sửa liên hệ | T | **T** | — | — |
| Phân công giảng viên vào buổi | T | **T** | X (họ tên) | X (của mình) |
| Gửi link kích hoạt tài khoản giảng viên | T | **T** | — | — |
| Khóa tài khoản giảng viên | T | — | — | — |
| Hậu cần GV (chỗ ở, phương tiện), người thực địa | X | **T** | X (thực địa) | X (của mình) |
| Đánh dấu mục bảng kiểm thủ công | X | **T** | — | — |
| Tải mẫu biểu đã điền | T | **T** | — | **T** |
| Nạp điểm danh / kết quả giai đoạn của lớp | T | **T** | — | — |
| Nhắc giảng viên (tin nhắn + "Đã gửi") | X | **T** | — | — |
| **Vận hành học viên** | | | | |
| Sửa hồ sơ, tài khoản, trả lời yêu cầu hỗ trợ (ADR 0003) | T | — | **T** | — |
| Báo vắng (G13) | T | X | **T** | X |
| Đề nghị đổi lớp (G14) | T | **D** | **T** | — |
| Nhắc lịch nhóm Zalo cụm (tin nhắn + "Đã gửi") | X | X | **T** | — |
| **Chốt** | | | | |
| Xác nhận giờ dạy (T11), kết quả cuối khóa `ket_qua`/`muc_dau_ra`, chứng nhận, duyệt hồ sơ | **T/D** | — | — | — |
| Đặt lại mật khẩu về ngày sinh, sửa câu trả lời yêu cầu hỗ trợ (ADR 0003) | **T** | — | — | — |
| **Giám sát** — màn "Vận hành" (G15) | **X** | — | — | — |

Ràng buộc khi người hỗ trợ GV sửa buổi (G12): chỉ buổi `thoi_gian_bat_dau > now()` **và** chưa có dòng `diem_danh` (ngược lại 400); giữ luật T11 giảng viên không trùng giờ (400) và cảnh báo vượt `so_phong` của T10 (không chặn); ghi `nhat_ky_hoat_dong` (`hanh_dong = 'sua_lich_hoc'`, `chi_tiet = {truoc, sau, ly_do}`); set `cap_nhat_luc` → kích hoạt "Cần nhắc lại" (G11).

## 2. Mô hình dữ liệu (chỉ thêm)

Tiên quyết T10 (#2), T11 (#3) — sửa issue theo G1/G8/G12.

```
phan_cong_ho_tro_gv   (id, nguoi_dung_id FK CASCADE, khoa_id FK CASCADE, created_at)
                      UNIQUE(nguoi_dung_id, khoa_id), INDEX(khoa_id)
                      -- Mở rộng (G3): thêm lop_id NULL (NULL = cả khóa); chỉ sửa ScopeService.

muc_kiem_tra          (id, khoa_id NULL FK CASCADE   -- NULL = bộ mặc định hệ thống
                       thu_tu, ten, mo_ta NULL, loai loai_muc_kiem_tra ('tu_dong'|'thu_cong'),
                       ma_quy_tac NULL, han_truoc_ngay smallint NULL, trang_thai)
                      CHECK (loai = 'tu_dong') = (ma_quy_tac IS NOT NULL)
trang_thai_muc_kiem_tra (id, muc_id FK CASCADE, lop_id, giai_doan_id, da_xong, ghi_chu,
                       cap_nhat_boi, cap_nhat_luc)  UNIQUE(muc_id, lop_id, giai_doan_id)

hau_can_giang_vien    (id, lop_id, giai_doan_id, giang_vien_id,
                       noi_o_ten, noi_o_dia_chi, nhan_phong date, tra_phong date,
                       phuong_tien, don_luc timestamptz, diem_don, lien_he_don, ghi_chu,
                       da_xac_nhan_noi_o, da_xac_nhan_di_chuyen, cap_nhat_boi, cap_nhat_luc)
                      UNIQUE(lop_id, giai_doan_id, giang_vien_id)
                      -- PUT kèm cap_nhat_luc đã đọc; lệch → 409 (cả nhóm cùng sửa)

nhan_su_thuc_dia      (id, lop_id, giai_doan_id, ho_ten, so_dien_thoai, nhiem_vu NULL, ghi_chu NULL)
                      INDEX(lop_id, giai_doan_id)            -- Q4: theo đợt – lớp

mau_bieu_khoa         (id, khoa_id FK CASCADE, loai loai_mau_bieu ('diem_danh'|'nhap_diem'|'danh_sach'),
                       ten, ten_file, noi_dung Bytes (≤ 2 MB), ky_hieu jsonb  -- kết quả phân tích lúc tải lên
                       trang_thai, tai_len_boi, tai_len_luc)
                      UNIQUE(khoa_id, loai) WHERE trang_thai = 'active' AND loai <> 'danh_sach'

nhat_ky_nhac_lich     (id, doi_tuong doi_tuong_nhac ('giang_vien'|'cum'),
                       giang_vien_id NULL, cum_id NULL, lich_hoc_ids uuid[],
                       noi_dung text, nguoi_gui FK nguoi_dung, gui_luc)
                      CHECK đúng 1 trong giang_vien_id/cum_id theo doi_tuong; GIN(lich_hoc_ids)

bao_vang              (id, dang_ky_hoc_id, lich_hoc_id, ly_do, nguoi_ghi, ghi_luc)
                      UNIQUE(dang_ky_hoc_id, lich_hoc_id)

de_nghi_doi_lop       (id, dang_ky_hoc_id, giai_doan_id, lop_hien_tai_id NULL, lop_de_nghi_id,
                       ly_do, trang_thai trang_thai_de_nghi ('cho_duyet'|'da_duyet'|'tu_choi'|'da_huy'),
                       nguoi_tao, tao_luc, nguoi_xu_ly NULL, xu_ly_luc NULL, ghi_chu_xu_ly NULL)
                      UNIQUE(dang_ky_hoc_id, giai_doan_id) WHERE trang_thai = 'cho_duyet'

lich_hoc_lop          + cap_nhat_luc timestamptz NOT NULL DEFAULT now(), + phong varchar(100) NULL
diem_hoc, giang_vien  + tao_boi uuid NULL FK nguoi_dung
nguoi_dung            + giang_vien_id uuid NULL FK giang_vien
                      CHECK vai_tro = 'giang_vien' ⇔ giang_vien_id NOT NULL (don_vi_id/hoc_vien_id NULL)
                      CHECK email bắt buộc: + ho_tro_giang_vien, giang_vien
```

Enum: thêm `vai_tro_nguoi_dung` += `ho_tro_giang_vien`, `giang_vien` — **mỗi giá trị 1 migration riêng**. Enum tạo mới (`loai_muc_kiem_tra`, `loai_mau_bieu`, `doi_tuong_nhac`, `trang_thai_de_nghi`) tạo cùng migration với bảng.

## 3. Ma trận liên thông (ai thấy gì của 1 lớp)

| Dữ liệu | QT | Hỗ trợ GV | Giảng viên (lớp mình) | Hỗ trợ HV (lớp có HV cụm mình) | Học viên |
|---|---|---|---|---|---|
| Lịch buổi, điểm học, phòng | ✓ | ✓ | ✓ | ✓ | ✓ (buổi của mình) |
| Giảng viên của buổi: họ tên, vai trò | ✓ | ✓ | ✓ | ✓ | ✓ |
| Giảng viên: SĐT, email | ✓ | ✓ | — | — | — |
| Hậu cần GV | ✓ | ✓ | ✓ chỉ của mình | — | — |
| Người thực địa (tên, SĐT, nhiệm vụ) | ✓ | ✓ | ✓ | ✓ | ✓ (tên, SĐT) |
| Nhóm hỗ trợ GV của khóa (tên, SĐT) | ✓ | ✓ | ✓ | ✓ | — |
| DS học viên: họ tên, giới tính, đơn vị, đối tượng, chức vụ, mức đầu vào | ✓ | ✓ | ✓ | ✓ (cụm mình) | — |
| Học viên: SĐT, email | ✓ | ✓ | — | ✓ (cụm mình) | — |
| Học viên: CCCD, ngày sinh, mã MOET | ✓ | — | — | — | — |
| Cụm + người hỗ trợ HV của cụm | ✓ | ✓ | — | ✓ | ✓ (tên cụm) |
| Báo vắng | ✓ | ✓ | ✓ | ✓ (cụm mình) | — |
| Đề nghị đổi lớp | ✓ | ✓ | — | ✓ (cụm mình) | — |
| Điểm danh, kết quả giai đoạn | ✓ | ✓ | ✓ | ✓ (cụm mình) | ✓ (của mình) |
| Bảng kiểm | ✓ | ✓ | — | trạng thái tổng | — |
| Nhật ký nhắc / cờ "Cần nhắc lại" | ✓ | ✓ (giảng viên) | — | ✓ (cụm mình) | — |

Cài đặt: `TrangLopService.layTrangLop(lopId, giaiDoanId)` lấy đủ, rồi **1 hàm lọc trường theo vai trò** (bảng trên = bộ test K6). Mỗi khu gọi scope service của mình trước.

## 4. Mẫu biểu theo khóa (G6, G7)

**Quản trị** (chi tiết khóa → mục **Mẫu biểu**): tải lên `.xlsx`, chọn loại, đặt tên; "Sao chép từ khóa khác"; "Tải thử" với 1 lớp bất kỳ của khóa; thay mẫu (bản cũ `inactive`).

**Ký hiệu hợp lệ** (đặt trong ô; ký hiệu lạ → 400 liệt kê ô lỗi):

| Nhóm | Ký hiệu | Ghi chú |
|---|---|---|
| Ô đơn | `{{khoa.ten}}` `{{khoa.ma}}` `{{lop.ten}}` `{{giai_doan.ten}}` `{{dot.tu_ngay}}` `{{dot.den_ngay}}` `{{diem_hoc.ten}}` `{{diem_hoc.dia_chi}}` `{{giang_vien.ds}}` `{{si_so}}` `{{ngay_xuat}}` | |
| Tiêu đề buổi | `{{buoi.N.ngay}}` `{{buoi.N.gio}}` (N = 1..) | Ô trống nếu đợt ít buổi hơn |
| Dòng lặp — đặt trên **1 dòng mẫu**, hệ thống nhân dòng giữ định dạng | `{{hv.stt}}` `{{hv.ma_noi_bo}}` `{{hv.ho_ten}}` `{{hv.gioi_tinh}}` `{{hv.don_vi}}` `{{hv.doi_tuong}}` `{{hv.chuc_vu}}` `{{hv.cum}}` | Chỉ trường cột "Giảng viên" ở §3 (mẫu cũng giao cho GV). Cần trường khác → quyết định riêng. |
| Điểm danh (trong dòng lặp) | `{{dd.N}}` | Điền sẵn `P` nếu có báo vắng |
| Kết quả (trong dòng lặp) | `{{kq.diem}}` `{{kq.ty_le_hoan_thanh}}` `{{kq.ghi_chu}}` | Q8: điểm thành phần |

- Loại `diem_danh`/`nhap_diem` **bắt buộc** có `{{hv.ma_noi_bo}}` (= `dang_ky_hoc.id`) — thiếu → 400; khuyến nghị ẩn cột. `danh_sach` chỉ xuất, không nạp.
- Lúc tải lên lưu vị trí ký hiệu vào `ky_hieu` (sheet, dòng mẫu, cột) → **nạp lại** đọc file đã điền theo đúng vị trí đó: tìm dòng theo `ma_noi_bo`; `dd.N`: `x`/`có` → `co_mat`, `v` → `vang` (có báo vắng → `vang_co_phep`), `p` → `vang_co_phep`, trống → bỏ qua; giá trị khác → dòng lỗi. Dòng có `ma_noi_bo` không thuộc lớp/giai đoạn → dòng lỗi. Ghi bằng upsert T12, `nguon_diem_danh = 'ky_ten'`, `nguon_import_id` từ `nhat_ky_import`.
- Học viên trong lớp được sắp theo họ tên (tên → họ đệm, so sánh tiếng Việt).

## 5. Tin nhắn nhắc lịch (G10, G11)

| Ai gửi | Cho ai | Ở đâu | Nội dung soạn sẵn |
|---|---|---|---|
| Hỗ trợ GV | Từng giảng viên của đợt | Hồ sơ chuẩn bị lớp → tab Giảng viên, nút "Tin nhắn nhắc" | Lớp, các buổi (ngày giờ), điểm học + địa chỉ + link bản đồ, phòng, chỗ ở, phương tiện / giờ đón / điểm đón, người thực địa, người hỗ trợ GV |
| Hỗ trợ HV | Nhóm Zalo cụm | Lịch học → chọn ngày → "Tin nhắn nhắc cụm" | Các buổi trong ngày chọn của các lớp có học viên cụm mình: lớp, giờ, điểm học / link, người thực địa |

- Hộp thoại hiện nội dung + nút **Sao chép** + nút **Đã gửi** → ghi `nhat_ky_nhac_lich` (kèm `lich_hoc_ids` và nội dung). Không bấm "Đã gửi" = chưa nhắc.
- **Cờ "Chưa nhắc" / "Cần nhắc lại"** theo (buổi, người nhận): chưa có nhật ký chứa buổi → chưa nhắc; có nhưng `lich_hoc_lop.cap_nhat_luc` > `gui_luc` → cần nhắc lại.
- **Mốc nhắc giảng viên** = mục bảng kiểm tự động `da_nhac_giang_vien` với `han_truoc_ngay` do khóa đặt (vd 3). Hỗ trợ HV: số đếm menu = buổi trong **2 ngày tới** chưa nhắc / cần nhắc lại.
- Mẫu câu chữ cố định trong code (v1). Email nhắc = để sau: chỉ cần thêm cron đọc cùng dữ liệu + cùng bảng nhật ký.

## 6. Trang

### 6.1 Khu người hỗ trợ giảng viên — trang FE `/ho-tro-gv/*`, API `/ho-tro-giang-vien/*` (chốt khi code #14: không dùng chung tiền tố, xem bài học `/ho-tro` của ADR 0003; bảng route dưới đây đọc `/ho-tro-giang-vien` là FE `/ho-tro-gv`)

| Route | Nội dung |
|---|---|
| `/ho-tro-giang-vien` — **Việc cần làm** | Đợt trong 21 ngày tới (màu bảng kiểm + mục quá hạn), đề nghị đổi lớp chờ duyệt, giảng viên "cần nhắc lại". Số đếm menu = đợt đỏ + đề nghị chờ. |
| `/ho-tro-giang-vien/lop` | Lớp trong phạm vi, lọc khóa / loại / giai đoạn. |
| `/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId` — **Hồ sơ chuẩn bị lớp** | **Tổng quan** (bảng kiểm) · **Lịch & điểm học** (sửa giờ/điểm học/phòng có lý do; thực địa của đợt) · **Giảng viên & hậu cần** (phân công GV vào buổi, thẻ hậu cần, tin nhắn nhắc, gửi link tài khoản) · **Học viên** (DS + cụm + người hỗ trợ HV + báo vắng + đề nghị đổi lớp) · **Biểu mẫu & nạp** |
| `/ho-tro-giang-vien/de-nghi-doi-lop` | Hàng chờ, duyệt/từ chối (409 nếu đã xử lý hoặc phân lớp đã đổi) |
| `/ho-tro-giang-vien/lich-day` | Lịch theo ngày, lọc giảng viên / điểm học |
| `/ho-tro-giang-vien/danh-muc` | Điểm học, giảng viên (tạo/sửa; tìm trùng theo SĐT/email trước khi tạo) |

Bảng kiểm động (G5b): danh mục quy tắc tự động — `co_diem_hoc`, `co_giang_vien`, `khong_vuot_so_phong`, `hau_can_da_xac_nhan`, `co_thuc_dia`, `giang_vien_co_tai_khoan`, `co_hoc_vien`, `da_nhac_giang_vien`, `khong_de_nghi_cho` (mỗi quy tắc 1 hàm thuần `(dữ liệu đợt) → {dat, ly_do}`). Màu: đỏ = có mục quá hạn; vàng = chưa đạt, chưa tới hạn; xanh = đạt hết.

### 6.2 Khu `/ho-tro-hoc-vien/*` (bổ sung cho ADR 0003)

- **Lịch học**: mỗi buổi thêm điểm học, phòng, thực địa, nhóm hỗ trợ GV; cờ "Chưa nhắc / Cần nhắc lại"; nút "Tin nhắn nhắc cụm" theo ngày.
- **Chi tiết học viên → Học tập**: nút **Báo vắng** trên buổi chưa diễn ra; nút **Đề nghị đổi lớp** trên từng giai đoạn (chọn lớp cùng giai đoạn có buổi, hiện sĩ số); trạng thái đề nghị.
- Menu: số đếm buổi cần nhắc.

### 6.3 Khu `/giang-vien/*`

`/giang-vien` — Lịch dạy (thẻ buổi gần nhất: giờ, điểm học + bản đồ, phòng, đón, thực địa, nhóm hỗ trợ GV); `/giang-vien/lop/:lopId/giai-doan/:gdId` — trang lớp chỉ đọc (§3) + tải mẫu biểu. Đăng nhập như tài khoản đơn vị.

### 6.4 Quản trị

- `/admin/nguoi-ho-tro`: lọc **Loại**; tạo tài khoản chọn loại.
- Chi tiết khóa: mục **Nhóm hỗ trợ GV**, **Bảng kiểm chuẩn bị**, **Mẫu biểu** (§4).
- Bộ mặc định bảng kiểm ở trang cấu hình chung.
- **`/admin/van-hanh`** (G15): đợt đỏ, đề nghị chờ > 48 giờ, thay đổi lịch 7 ngày (ai, lý do, trước → sau), khóa chưa có nhóm hỗ trợ GV / mẫu biểu, cụm chưa có người hỗ trợ, danh mục điểm học / giảng viên do người hỗ trợ tạo trong 7 ngày (để gộp trùng).

### 6.5 Cổng học viên

Thẻ **"Buổi học sắp tới"** (≤ 7 ngày): giờ, điểm học / link, phòng, người thực địa.

## 7. API (tóm tắt)

Quản trị: `POST/PATCH /nguoi-dung/ho-tro` (+`vai_tro`); `PUT /khoa-boi-duong/{id}/nhom-ho-tro-gv`; bảng kiểm `GET/PUT /bang-kiem/mac-dinh`, `GET /khoa-boi-duong/{id}/bang-kiem`, `POST .../bang-kiem/tuy-chinh`, `POST/PATCH .../bang-kiem/muc[/{mucId}]`, `GET /bang-kiem/quy-tac`; mẫu biểu `GET/POST /khoa-boi-duong/{id}/mau-bieu`, `POST .../mau-bieu/sao-chep {tu_khoa_id}`, `PATCH /mau-bieu/{id}` (ngưng), `GET /mau-bieu/{id}/tai-thu?lop_id=&giai_doan_id=`; `GET /van-hanh`.

`/ho-tro-giang-vien` (mọi endpoint qua `HoTroGiangVienScopeService` trước):
- `GET /lop-cua-toi`, `GET /viec-can-lam`, `GET /viec-can-lam/dem`, `GET /lich-day`
- `GET /lop/{lopId}/giai-doan/{gdId}`; `PUT .../bang-kiem/{mucId}`; `PUT .../hau-can/{giangVienId}`; `PUT .../thuc-dia {nhan_su: [...]}` (thay toàn bộ)
- `PATCH /lich-hoc/{id} {thoi_gian_bat_dau?, thoi_gian_ket_thuc?, diem_hoc_id?, phong?, ly_do}`
- `PUT /lich-hoc/{id}/giang-vien {phan_cong: [{giang_vien_id, vai_tro, so_gio?}]}`
- `GET/POST/PATCH /diem-hoc`, `GET/POST/PATCH /giang-vien` (phạm vi: dùng trong khóa của nhóm + tìm trùng)
- `POST /giang-vien/{id}/gui-link-kich-hoat` (GV có phân công trong khóa của nhóm)
- `GET .../bieu-mau/{mauId}`; `POST .../nap/{mauId}`
- `GET .../tin-nhan-nhac/{giangVienId}`; `POST /nhac-lich {doi_tuong:'giang_vien', giang_vien_id, lich_hoc_ids, noi_dung}`
- `GET /de-nghi-doi-lop?trang_thai=`; `PATCH /de-nghi-doi-lop/{id}/duyet`, `.../tu-choi {ghi_chu}`

`/ho-tro-hoc-vien` (bổ sung): `GET /lich-hoc` (+ điểm học, phòng, thực địa, nhóm hỗ trợ GV, cờ nhắc); `GET /cum/{cumId}/tin-nhan-nhac?ngay=`; `POST /nhac-lich {doi_tuong:'cum', cum_id, lich_hoc_ids, noi_dung}`; `POST/DELETE /hoc-vien/{id}/bao-vang[/{baoVangId}]`; `POST /hoc-vien/{id}/de-nghi-doi-lop`, `PATCH /de-nghi-doi-lop/{id}/huy`.

`/giang-vien`: `GET /lich-day`, `GET /lop/{lopId}/giai-doan/{gdId}`, `GET .../bieu-mau/{mauId}`.

Mọi thao tác ghi + mọi lần tải mẫu biểu / nạp → `nhat_ky_hoat_dong`.

## 8. Lát cắt dọc

| Lát | Nội dung | Phụ thuộc |
|---|---|---|
| P0 (#2, #3) | T10 #2, T11 #3 (sửa theo G1/G8/G12); `lich_hoc_lop.cap_nhat_luc`, `phong` + 1 hàm cập nhật lịch dùng chung | — |
| L1 (#14) | Vai trò `ho_tro_giang_vien`, nhóm theo khóa, scope service cấp lớp, admin cấp/phân công | P0 |
| L2 (#15) | Trang lớp (đọc) + ma trận §3 + lịch dạy; bổ sung Lịch học của hỗ trợ HV | L1 |
| L3 (#16) | Vận hành lớp: sửa buổi có lý do, danh mục điểm học/GV, phân công GV vào buổi, hậu cần (409), thực địa đợt | L2 |
| L4 (#17) | Bảng kiểm động + Việc cần làm + số đếm | L3 |
| L5 (#18) | Báo vắng + đề nghị đổi lớp (hỗ trợ HV ↔ hỗ trợ GV) | L2 |
| L6 (#19) | Mẫu biểu theo khóa: tải lên/kiểm ký hiệu/sao chép/tải thử, xuất, nạp | L2, **mẫu HCMUE + Q8** |
| L7 (#20) | Vai trò `giang_vien` + khu `/giang-vien` + gửi link kích hoạt | L3 |
| L8 (#21) | Tin nhắn nhắc lịch (GV + cụm), cờ cần nhắc lại, thẻ "Buổi học sắp tới" | L3, L7 |
| L9 (#22) | Màn giám sát `/admin/van-hanh` | L3, L5 |

## 9. Kịch bản kiểm thử bắt buộc

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| K1 | Hỗ trợ GV khóa A gọi endpoint lớp/buổi/đề nghị của khóa B | 404 |
| K2 | Gỡ khỏi nhóm khi đang đăng nhập | Request kế tiếp 404 |
| K3 | Giảng viên xem lớp không có buổi của mình | 404 |
| K4 | Giảng viên xem trang lớp / tải mẫu | Không SĐT/email/ngày sinh học viên; không hậu cần GV khác |
| K5 | Hỗ trợ HV xem lịch học | Có điểm học/thực địa/nhóm hỗ trợ GV; không hậu cần |
| K6 | Mỗi vai trò gọi trang lớp | Đúng từng ô ma trận §3 |
| K7 | Hỗ trợ GV sửa giờ buổi chưa diễn ra, có lý do | Thành công; nhật ký có trước/sau/lý do; `cap_nhat_luc` đổi |
| K8 | Sửa buổi đã diễn ra / đã có điểm danh / thiếu lý do | 400 |
| K9 | Sửa giờ làm GV trùng giờ buổi khác | 400 |
| K10 | Hỗ trợ GV thêm/xóa buổi, xác nhận giờ dạy, sửa `ket_qua` cuối khóa | 403 |
| K11 | 2 người cùng sửa hậu cần 1 GV | Người sau 409 |
| K12 | Mỗi quy tắc bảng kiểm đạt/không đạt; khóa dùng mặc định / tùy chỉnh; đánh dấu mục tự động | Đúng `{dat, ly_do}`, đúng màu; 400 |
| K13 | Tải lên mẫu có ký hiệu lạ / mẫu điểm danh thiếu `hv.ma_noi_bo` | 400 liệt kê ô |
| K14 | Tải mẫu điểm danh lớp có báo vắng | Đúng học viên phân lớp ở giai đoạn đó, ô buổi có `P`, giữ định dạng mẫu |
| K15 | Nạp mẫu đã điền (lần 1, lần 2) | Ghi đúng; lần 2 không trùng; `v` + báo vắng → `vang_co_phep` |
| K16 | Nạp dòng `ma_noi_bo` lớp khác / giá trị điểm danh lạ | Dòng lỗi, dòng khác vẫn nạp |
| K17 | Giảng viên gọi endpoint nạp / sửa | 403 |
| K18 | Hỗ trợ HV báo vắng / đề nghị đổi lớp cho học viên cụm khác | 404 |
| K19 | 2 người cùng duyệt 1 đề nghị | Đúng 1 thành công, 1 nhận 409 |
| K20 | Duyệt đề nghị khi phân lớp hiện tại đã đổi | 409 |
| K21 | Tạo đề nghị thứ 2 cùng (học viên, giai đoạn) khi đề nghị 1 đang chờ | 409 |
| K22 | Bấm "Đã gửi" rồi sửa giờ buổi | Cờ "Cần nhắc lại" ở cả hỗ trợ GV (GV của buổi) và hỗ trợ HV (cụm có HV trong lớp) |
| K23 | Tin nhắn nhắc cụm | Chỉ buổi của lớp có học viên cụm mình, đúng ngày |
| K24 | Vai trò khác gọi `/ho-tro-giang-vien/*`, `/giang-vien/*` | 403 |
| K25 | CHECK `nguoi_dung` vai trò `giang_vien` ↔ `giang_vien_id` | Chặn |

## 10. Ngoài phạm vi

Email / cron nhắc lịch (để sau, G10); giảng viên tự nạp (Q3); phân công hỗ trợ GV theo lớp (để dành, G3); người hỗ trợ GV thêm/xóa buổi hay tạo lớp; tự động đặt phòng/xe; chi phí hậu cần; Zalo OA/SMS gateway; điểm danh QR; chat trong hệ thống; đa vai trò; mẫu câu chữ tin nhắn cấu hình theo khóa.
