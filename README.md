# Hệ thống thu thập thông tin học viên

Công cụ phối hợp giữa Sở Giáo dục & Đào tạo, Phòng Văn hóa - Xã hội (UBND cấp Xã), Trường/đơn vị đào tạo và học viên để thu thập, quản lý thông tin học viên tham gia các khóa bồi dưỡng.

## Trạng thái

Đang ở giai đoạn **thiết kế** (chưa có code triển khai). Bản thiết kế đầy đủ (kiến trúc hệ thống, mô hình dữ liệu, sơ đồ use case, wireframe màn hình, lộ trình triển khai) nằm ở:

- **Canvas thiết kế (bản sống, chỉnh sửa được):** https://claude.ai/artifact/7RrH2dCcRYi6VsUgqVNRoc
- **Bản export tĩnh (snapshot):** thư mục [`design/`](design/) trong repo này — mỗi file `.dc.html` là một board của canvas, `canvas.json` là bố cục.

## Nội dung thiết kế

| Board | Nội dung |
|---|---|
| `Main.dc.html` | Kiến trúc hệ thống (4 tầng: người dùng, frontend, backend services, dữ liệu) |
| `MoHinhDuLieu.dc.html` | ERD: HocVien, DiaDanh, DonViCongTac, NguoiDung, MonHoc, NhatKyImport |
| `MoHinhKhoaHoc.dc.html` | ERD: KhoaBoiDuong, GiaiDoanKhoa, LopHoc, LichHocLop, LopHoc_NhanSu, DangKyHoc |
| `SoDoUseCase.dc.html` | Sơ đồ use case theo tác nhân (Trường, Sở, Phòng VHXH, Học viên, Quản trị hệ thống) |
| `FormNhapThongTin.dc.html` | Wireframe: form học viên tự khai báo thông tin |
| `XacNhanThongTin.dc.html` | Wireframe: màn hình xem lại & xác nhận trước khi lưu chính thức |
| `QuanLyDanhMuc.dc.html` | Wireframe: quản trị & import danh mục dùng chung |
| `LoTrinhTrienKhai.dc.html` | Lộ trình triển khai đề xuất (~11 tuần, 5 giai đoạn) |

## Các quyết định thiết kế chính

Xem chi tiết đầy đủ trong các board ở trên. Tóm tắt:

- **Chính quyền 2 cấp:** không còn Phòng Giáo dục cấp huyện. Sở GD&ĐT quản lý trực tiếp Trường THPT; Phòng Văn hóa - Xã hội (thuộc UBND cấp Xã) quản lý Trường Mầm non/Tiểu học/THCS trên địa bàn.
- **Duyệt hồ sơ theo cấp giảng dạy của từng học viên** (`HocVien.cap_giang_day`), không theo trường — đúng cho cả trường liên cấp.
- **Phân quyền scope-based:** suy ra động qua cây `DonViCongTac.don_vi_cha_id`, không có bảng phân quyền riêng. Cấp trên (Sở) duyệt thay được cấp dưới (Phòng VHXH).
- **Khóa bồi dưỡng do Trường tự tạo & quản lý**, Sở/Phòng VHXH chỉ duyệt danh sách & xem thống kê.
- **Học viên là tác nhân tự phục vụ:** tự đăng ký, tài khoản tự sinh (tên đăng nhập = ĐDCN, mật khẩu mặc định = ngày sinh) — bắt buộc đổi mật khẩu lần đầu.
- **Màn hình xác nhận bắt buộc** trước khi lưu chính thức + gửi email bản sao dữ liệu ngay sau khi lưu.
- **Phân lớp học viên do Quản trị hệ thống thực hiện qua Import** (Excel/CSV), không thao tác tay từng người.
- **Mọi dữ liệu chọn lựa** (địa danh, đơn vị công tác, môn học) đều là khóa ngoại vào danh mục dùng chung, import được qua Excel/CSV có validate theo dòng — không nhập tự do.
- **Chuyên môn đào tạo** là text tự do có gợi ý autocomplete (không phải danh mục do admin quản lý) — chấp nhận dữ liệu không đồng nhất 100%, chưa cần bước chuẩn hóa thủ công.

## Bước tiếp theo

Soạn tài liệu kỹ thuật chính thức từ bộ thiết kế này: API contract (REST endpoints theo từng dịch vụ), DDL PostgreSQL đầy đủ (constraints, index, enum), checklist quy tắc ràng buộc/validate — rồi triển khai.

## Development setup

**Stack:** Node.js + [NestJS](https://nestjs.com/) + TypeScript, PostgreSQL, [Prisma](https://www.prisma.io/) ORM/migrations. Modular monolith — không tách microservices, vì một số luồng (vd. luồng đăng ký học viên ở `docs/api-contract.md` mục "Luồng đăng ký") cần 1 transaction DB duy nhất trải qua nhiều "dịch vụ" logic.

**Cấu trúc thư mục:** code backend nằm ở [`backend/`](backend/) (subfolder riêng, không đặt ở gốc repo) để chừa chỗ cho một `frontend/` sibling sau này. `design/` (canvas snapshot) và `docs/` (spec chính thức) giữ nguyên ở gốc repo.

### Cài đặt

```bash
cd backend
npm install
cp .env.example .env   # chỉnh DATABASE_URL nếu cần
```

### Chạy PostgreSQL cục bộ

Repo có sẵn `docker-compose.yml` ở gốc, khởi động Postgres 16:

```bash
docker compose up -d
```

Việc này tạo container `thong-tin-hoc-vien-db`, database `thong_tin_hoc_vien`, cổng `5432`, khớp với `DATABASE_URL` mặc định trong `backend/.env.example`. Nếu không dùng Docker, trỏ `DATABASE_URL` trong `backend/.env` tới một Postgres 14+ bất kỳ có cài được extension `pgcrypto` và `pg_trgm`.

### Chạy migration

```bash
cd backend
npx prisma migrate deploy
```

Migration khởi tạo (`prisma/migrations/20260924000000_init/`) dịch nguyên trạng từ [`docs/database-ddl.sql`](docs/database-ddl.sql) — bảng, enum, index, và cả những phần Prisma schema DSL không biểu diễn được (extension `pgcrypto`/`pg_trgm`, mọi `CHECK` constraint, GIN trgm index, 2 trigger function `trg_dang_ky_lop_thuoc_khoa` và `trg_set_updated_at`) được nối thêm dưới dạng raw SQL ở cuối file migration, chép nguyên văn từ DDL gốc.

Schema Prisma (`prisma/schema.prisma`) đặt tên model/field trùng chính xác tên bảng/cột trong DDL, và mọi quan hệ khóa ngoại khai báo tường minh `onDelete`/`onUpdate` để khớp đúng ngữ nghĩa gốc (`NoAction` mặc định — DDL không hard-delete các bảng danh mục, chỉ soft-disable qua `trang_thai`; `Cascade` chỉ ở những FK DDL khai báo `ON DELETE CASCADE` tường minh) thay vì để Prisma tự suy luận `SetNull`/`Restrict`.

### Tạo tài khoản quan_tri đầu tiên (seed)

Chưa có luồng tự cấp tài khoản Sở/Phòng VHXH/Trường/QuảnTrị (chỉ Học viên tự đăng ký) — chạy seed 1 lần để có tài khoản `quan_tri` đăng nhập/quản lý danh mục/import:

```bash
cd backend
npx prisma db seed
```

In ra `ten_dang_nhap` + mật khẩu (tự sinh nếu không đặt `SEED_QUAN_TRI_MAT_KHAU` trong `.env`) — đổi mật khẩu ngay qua `POST /auth/doi-mat-khau` sau khi đăng nhập lần đầu. Idempotent: chạy lại không tạo trùng nếu tài khoản đã tồn tại.

Nhớ đặt `JWT_SECRET` riêng (đủ dài/ngẫu nhiên) trong `backend/.env` trước khi deploy thật — xem `backend/.env.example`.

### Chạy dev server

```bash
npm run start:dev
```

### Cấu trúc module backend

7 module NestJS, mỗi module ứng với 1 dịch vụ trong `docs/api-contract.md`: `auth`, `hoc-vien`, `khoa-boi-duong`, `danh-muc`, `import`, `bao-cao`, `thong-bao`.

Đã triển khai (2026-09-24): **`auth`** (đăng nhập/đổi mật khẩu/thông tin tài khoản, JWT guard, phân quyền scope-based qua `ScopeService`) và **`danh-muc`** + **`import`** (CRUD danh mục địa danh/đơn vị công tác/môn học dùng chung 1 bộ validate với luồng import Excel — chỉ 3/5 loại import, xem ghi chú trong `src/import/import.service.ts`). Còn lại (`hoc-vien`, `khoa-boi-duong`, `bao-cao`, `thong-bao`) vẫn là module rỗng.
