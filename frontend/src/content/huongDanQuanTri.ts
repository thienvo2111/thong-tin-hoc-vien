// src/content/huongDanQuanTri.ts
// Hướng dẫn sử dụng trang quản trị (/admin/huong-dan) — nguồn duy nhất cho trang web và bản Word
// (scripts/huong-dan/tao-docx.mjs --quan-tri). Chỉ sửa nội dung ở đây. Markup: **đậm**, *nghiêng*,
// [[Nhãn nút/giao diện]] (xem src/components/TextMarkup.tsx). Nhãn nút phải khớp ĐÚNG chữ trên giao diện.
import type { BangDuLieu, GhiChu } from './huongDan';

/** 'tat_ca' = mọi tài khoản vào trang quản trị (Quản trị, Sở, Phòng, Trường); 'quan_tri' = chỉ Quản trị. */
export type PhamViVaiTro = 'tat_ca' | 'quan_tri';

export interface MucQuanTri {
  tieuDe?: string;
  buoc?: string[];
  bang?: BangDuLieu[];
  ghiChu?: GhiChu[];
}

export interface PhanQuanTri extends MucQuanTri {
  id: string;
  tieuDe: string;
  moTa: string;
  vaiTro: PhamViVaiTro;
  /** Nút "Mở màn hình" trên web; bản Word ghi thành "Màn hình: menu …". */
  manHinh?: { nhan: string; duongDan: string };
  muc?: MucQuanTri[];
}

export interface HoiDapQuanTri {
  hoi: string;
  dap: string;
  vaiTro: PhamViVaiTro;
}

export const huongDanQuanTri: {
  gioiThieu: string;
  quyTrinh: string[];
  parts: PhanQuanTri[];
  hoiDap: HoiDapQuanTri[];
} = {
  gioiThieu:
    'Trang quản trị dùng để theo dõi học viên, khóa bồi dưỡng, báo cáo và vận hành khảo sát. Tài khoản **Quản trị** (HCMUE) làm được mọi việc; tài khoản **đơn vị** (Sở GD&ĐT, Phòng Văn hóa – Xã hội, Trường) chỉ **xem** dữ liệu trong phạm vi đơn vị mình.',

  quyTrinh: [
    'Kiểm tra danh mục **địa danh** và **đơn vị công tác** (trường) đã đủ; sửa địa bàn trường sai ở [[Danh mục trường]].',
    'Tạo **khóa bồi dưỡng** và các **giai đoạn** của khóa (mục Khóa bồi dưỡng).',
    'Nhập **hồ sơ nhân sự từ CSDL MOET** (Nhập dữ liệu → *Hồ sơ nhân sự (CSDL MOET)*). Hệ thống tạo sẵn tài khoản học viên: tên đăng nhập là mã định danh, mật khẩu lần đầu là ngày sinh.',
    '**Ghi danh** học viên vào khóa ngay sau bước trên: nhập *Phân lớp học viên (MOET)* với mã định danh, để trống mọi cột giai đoạn. Ghi danh sớm để học viên nhận đúng cấu hình khảo sát của khóa.',
    'Thiết lập **Cấu hình khảo sát** (chế độ, kênh đánh giá, công tắc khảo sát, thang mức) và tạo **Đợt xác nhận** để học viên bổ sung hồ sơ.',
    'Theo dõi học viên làm khảo sát ở [[Tình hình khảo sát]], trả lời [[Yêu cầu hỗ trợ]], hỗ trợ tài khoản ở [[Tài khoản học viên]].',
    'Chốt mức đầu vào bằng nhập *Kết quả đánh giá (đầu vào/đầu ra)*.',
    'Tạo **lớp và lịch học** (nhập *Lớp và lịch học* hoặc tạo tay), thêm nhân sự lớp, rồi **phân lớp** (nhập lại *Phân lớp học viên (MOET)* có điền cột giai đoạn) và gán **cụm Zalo**.',
    'Trong khóa: nhập *Điểm danh*, *Kết quả giai đoạn*; cuối khóa mở đợt xác nhận, khảo sát đầu ra, xuất báo cáo.',
  ],

  parts: [
    {
      id: 'dang-nhap',
      tieuDe: 'Đăng nhập và giao diện quản trị',
      moTa: 'Cách vào trang quản trị, đổi mật khẩu và các thành phần chung của giao diện.',
      vaiTro: 'tat_ca',
      buoc: [
        'Mở **boiduongnls.hcmue.edu.vn/dang-nhap**, nhập tên đăng nhập và mật khẩu. Tài khoản đơn vị nhập tên đăng nhập không phân biệt chữ hoa, chữ thường.',
        'Lần đầu đăng nhập bằng mật khẩu tạm, hệ thống bắt đổi mật khẩu mới rồi mới vào được trang quản trị.',
        'Sau khi đăng nhập, hệ thống mở [[Tổng quan]]. Menu bên trái chỉ hiện các mục tài khoản được dùng; trên điện thoại bấm biểu tượng ba gạch để mở menu.',
        'Góc dưới menu hiện tên đăng nhập, vai trò và nút [[Đăng xuất]]. Dùng máy chung thì luôn đăng xuất khi xong việc.',
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Khóa tạm khi nhập sai',
          noiDung:
            'Nhập sai mật khẩu 5 lần liên tiếp, tài khoản bị khóa tạm 15 phút. Tài khoản đơn vị đã có email dùng được [[Quên mật khẩu?]]; không thì liên hệ Quản trị để được cấp mật khẩu tạm.',
        },
      ],
    },
    {
      id: 'pham-vi',
      tieuDe: 'Vai trò và phạm vi dữ liệu',
      moTa: 'Mỗi tài khoản chỉ thấy dữ liệu trong phạm vi của mình; tài khoản đơn vị chỉ xem, không sửa.',
      vaiTro: 'tat_ca',
      bang: [
        {
          cot: ['Vai trò', 'Thấy dữ liệu', 'Được làm'],
          hang: [
            ['**Quản trị**', 'Toàn hệ thống.', 'Mọi thao tác: tạo khóa, nhập dữ liệu, cấu hình, tài khoản, hỗ trợ.'],
            ['**Sở GD&ĐT**', 'Đơn vị mình và mọi đơn vị trực thuộc.', 'Xem học viên, khóa, báo cáo trong phạm vi.'],
            ['**Phòng Văn hóa – Xã hội**', 'Đơn vị mình và các đơn vị trực thuộc.', 'Xem học viên, khóa, báo cáo trong phạm vi.'],
            ['**Trường**', 'Chỉ trường mình.', 'Xem học viên, khóa, báo cáo của trường.'],
          ],
        },
        {
          cot: ['Trường hợp với một khóa', 'Đơn vị thấy'],
          hang: [
            ['Đơn vị là **đơn vị đặt hàng** của khóa (hoặc khóa do đơn vị cấp trên đặt hàng)', 'Khóa và **toàn bộ** học viên của khóa.'],
            ['Đơn vị chỉ có học viên **tham gia** khóa', 'Khóa, nhưng chỉ học viên thuộc đơn vị mình (trang khóa hiện dòng nhắc màu xanh).'],
          ],
        },
      ],
    },
    {
      id: 'tong-quan',
      tieuDe: 'Tổng quan',
      moTa: 'Bảng số liệu chung và các việc cần xử lý.',
      vaiTro: 'tat_ca',
      manHinh: { nhan: 'Tổng quan', duongDan: '/admin/tong-quan' },
      buoc: [
        'Ba thẻ trên cùng: **Tổng học viên**, **Hồ sơ chờ duyệt**, **Đơn vị tham gia** (trong phạm vi quyền, không theo bộ lọc bên dưới).',
        'Khung *Hồ sơ chờ duyệt gần nhất*: bấm [[Xem hồ sơ]] để mở từng hồ sơ, [[Xem tất cả →]] để mở danh sách lọc sẵn.',
        'Phần thống kê bên dưới lọc theo **Khóa bồi dưỡng**, **Từ ngày**, **Đến ngày** (theo ngày ghi danh) và **Đơn vị công tác**: số học viên tham gia, đã đăng nhập, đã chỉnh sửa hồ sơ, biểu đồ khảo sát đầu vào/đầu ra và kết quả học theo hình thức.',
        'Bấm [[⇩ Xuất Excel]] để tải số liệu đang lọc.',
      ],
    },
    {
      id: 'hoc-vien',
      tieuDe: 'Học viên',
      moTa: 'Tra cứu hồ sơ học viên, xem khóa, lớp và nhật ký hoạt động.',
      vaiTro: 'tat_ca',
      manHinh: { nhan: 'Học viên', duongDan: '/admin/hoc-vien' },
      buoc: [
        'Tìm theo tên, số CCCD hoặc mã MOET; lọc theo trạng thái hồ sơ, đơn vị, cấp giảng dạy.',
        'Bấm vào một dòng (hoặc [[Xem →]]) để mở **Chi tiết hồ sơ học viên**: thông tin cá nhân, công tác, liên hệ (chỉ xem).',
      ],
      muc: [
        {
          tieuDe: 'Phân lớp và cụm Zalo cho từng học viên (Quản trị)',
          buoc: [
            'Trong chi tiết hồ sơ, khối **Khóa & lớp** liệt kê các khóa học viên đã ghi danh.',
            'Mỗi giai đoạn có ô chọn lớp: chọn lớp rồi bấm [[Lưu]]; chọn *-- Bỏ gán --* để gỡ. Hệ thống cảnh báo nếu mức của lớp khác mức đầu vào của học viên.',
            'Ô **Cụm hỗ trợ Zalo**: chọn cụm rồi bấm [[Lưu]].',
          ],
        },
        {
          tieuDe: 'Nhật ký hoạt động (Quản trị)',
          buoc: [
            'Khối **Nhật ký hoạt động** ghi đăng nhập, sửa hồ sơ, xác nhận, khảo sát, kết quả, phân lớp, email, hỗ trợ kèm thời gian, địa chỉ IP, thiết bị — dùng để đối chiếu khi học viên phản ánh.',
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'info',
          tieuDe: 'Sửa hồ sơ học viên',
          noiDung:
            'Học viên tự sửa hồ sơ khi có **đợt xác nhận** đang mở. Trang quản trị hiện chưa có nút sửa hồ sơ hộ học viên.',
        },
      ],
    },
    {
      id: 'khoa',
      tieuDe: 'Khóa bồi dưỡng',
      moTa: 'Tạo khóa, giai đoạn, lớp học, lịch học, nhân sự và cụm Zalo. Tài khoản đơn vị chỉ xem.',
      vaiTro: 'tat_ca',
      manHinh: { nhan: 'Khóa bồi dưỡng', duongDan: '/admin/khoa-boi-duong' },
      buoc: [
        'Danh sách khóa lọc theo mã/tên khóa, trạng thái, đơn vị đặt hàng; bấm vào khóa để xem chi tiết.',
        '(Quản trị) Bấm [[+ Tạo khóa mới]], nhập Mã khóa, Tên khóa, Địa điểm, Ngày bắt đầu, Ngày kết thúc, chọn **Đơn vị đặt hàng** (Sở GD&ĐT, Trường hoặc đơn vị khác), bấm [[Tạo khóa]]. Khóa có hiệu lực ngay; đơn vị tổ chức luôn là Trường ĐHSP TP.HCM.',
        '(Quản trị) Trong chi tiết khóa, [[Sửa khóa]] để đổi thông tin.',
      ],
      muc: [
        {
          tieuDe: 'Tab Giai đoạn',
          buoc: [
            'Tạo giai đoạn **trước** khi tạo lịch học hay phân lớp: [[+ Tạo giai đoạn]], nhập Thứ tự, Tên, Hình thức (Trực tiếp/Trực tuyến/Đánh giá/Khác), thời gian.',
            '**Link hoặc địa điểm** và **Hướng dẫn** hiện cho học viên chưa được gán lớp ở giai đoạn đó (ví dụ link bài đánh giá).',
            'Giai đoạn có hình thức **Đánh giá** sớm nhất là đánh giá đầu vào; khi cấu hình dùng kênh trang khảo sát, học viên làm bài ngay trên thẻ giai đoạn.',
          ],
        },
        {
          tieuDe: 'Tab Lớp học',
          buoc: [
            '[[+ Tạo lớp mới]]: Tên lớp, Loại lớp (Trực tiếp/Zoom/VLE), Sĩ số tối đa. Nhóm học viên và mức năng lực đặt sau qua [[Sửa]].',
            '[[Xem chi tiết ▾]] trên từng lớp để thêm **Buổi học** ([[+ Thêm buổi học]]) và **Nhân sự** ([[+ Thêm nhân sự]]: giảng viên/hỗ trợ). Xóa nhân sự là xóa hẳn.',
            '[[⇪ Import Excel]] trên tab này nhập nhanh *Lớp & lịch học*, *Nhân sự lớp* hoặc *Phân lớp học viên* cho đúng khóa đang xem (cột mã khóa để trống được).',
          ],
        },
        {
          tieuDe: 'Tab Cụm hỗ trợ Zalo',
          buoc: [
            '[[+ Tạo cụm]]: Tên cụm, Link Zalo, Ghi chú. Học viên được gán cụm sẽ thấy nút [[Vào nhóm Zalo]] ở trang Lớp học.',
            'Gán cụm hàng loạt bằng cột *ten_cum* trong file phân lớp, hoặc từng người ở chi tiết hồ sơ.',
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'info',
          tieuDe: 'Vô hiệu hóa thay vì xóa',
          noiDung:
            'Lớp, giai đoạn, cụm chỉ **vô hiệu hóa** (bật lại được bằng [[Kích hoạt lại]]); học viên đang gắn không bị ảnh hưởng ngay nhưng cần rà soát lại.',
        },
      ],
    },
    {
      id: 'bao-cao',
      tieuDe: 'Báo cáo',
      moTa: 'Xem trực tuyến hoặc xuất Excel. Một số báo cáo cần chọn khóa hoặc đợt trước.',
      vaiTro: 'tat_ca',
      manHinh: { nhan: 'Báo cáo', duongDan: '/admin/bao-cao' },
      bang: [
        {
          cot: ['Báo cáo', 'Nội dung', 'Cần chọn', 'Ai dùng'],
          hang: [
            ['Báo cáo tổng hợp', 'Số liệu học viên, hồ sơ theo đơn vị, địa bàn hoặc khóa.', 'Thống kê theo; từ ngày – đến ngày', 'Mọi tài khoản'],
            ['Báo cáo xác nhận', 'Học viên đã/chưa xác nhận theo từng đợt.', 'Đợt xác nhận; trạng thái', 'Quản trị'],
            ['Vận hành theo lớp', 'Sĩ số, hồ sơ đầy đủ, mức đầu vào theo lớp.', 'Khóa (bỏ trống = mọi khóa)', 'Mọi tài khoản'],
            ['Sửa trường MOET', 'Trường hợp cần hiệu chỉnh dữ liệu MOET gốc.', 'Khóa', 'Quản trị'],
            ['Xuất cho VLE', 'Danh sách để Phòng CNTT tạo tài khoản VLE (chỉ xuất Excel).', 'Khóa', 'Quản trị'],
            ['Điều kiện đánh giá đầu vào', 'Học viên đủ/thiếu điều kiện làm đánh giá đầu vào, lý do.', 'Khóa', 'Quản trị'],
          ],
        },
      ],
      buoc: [
        'Chọn điều kiện trên thẻ báo cáo, bấm [[Xem]] để xem nhanh hoặc [[⇩ Xuất Excel]] để tải file.',
        'Số liệu luôn giới hạn trong phạm vi quyền của tài khoản.',
      ],
    },
    {
      id: 'danh-muc-truong',
      tieuDe: 'Danh mục trường',
      moTa: 'Tra cứu trường và sửa địa bàn (phường/xã) của trường theo địa giới hiện tại.',
      vaiTro: 'tat_ca',
      manHinh: { nhan: 'Danh mục trường', duongDan: '/admin/danh-muc-truong' },
      buoc: [
        'Lọc theo tỉnh/thành, tìm theo tên trường.',
        '(Quản trị) Bấm [[Sửa địa bàn]], chọn Tỉnh/thành và Phường/xã đúng, bấm [[Lưu]]. Học viên chọn trường theo xã sẽ thấy trường ở đúng xã mới.',
      ],
      ghiChu: [
        { loai: 'info', tieuDe: 'Phạm vi sửa', noiDung: 'Chỉ sửa được địa bàn; tên và mã trường giữ nguyên theo danh mục.' },
      ],
    },
    {
      id: 'nhap-du-lieu',
      tieuDe: 'Nhập dữ liệu từ Excel',
      moTa: 'Nạp dữ liệu hàng loạt theo 2 bước: tải lên để kiểm tra, rồi xác nhận nạp.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Nhập dữ liệu', duongDan: '/admin/nhap-du-lieu' },
      buoc: [
        'Chọn **Loại dữ liệu**; với *Phân lớp học viên (MOET)* chọn thêm **Khóa bồi dưỡng**.',
        'Bấm [[⇩ Tải file mẫu Excel]], điền dữ liệu đúng cột theo ghi chú trong file mẫu. Luôn tải mẫu mới, nhất là khi khóa thêm/bớt giai đoạn.',
        'Chọn file .xlsx, bấm [[Tải lên & kiểm tra]]. Hệ thống kiểm tra từng dòng và báo số dòng thành công, lỗi, cảnh báo cùng lý do.',
        'Xem lỗi; tải [[Tải file lỗi]] để sửa và nhập lại các dòng lỗi sau.',
        'Bấm [[Xác nhận nạp dữ liệu]]: chỉ các dòng hợp lệ được nạp, dòng lỗi bị bỏ qua.',
        'Khung **Lịch sử nhập dữ liệu** liệt kê các lần nhập; lần nào chưa xác nhận bấm [[Xác nhận →]] để nạp mà không phải tải lại file.',
      ],
      bang: [
        {
          cot: ['Loại dữ liệu', 'Dùng để', 'Lưu ý chính'],
          hang: [
            ['Hồ sơ nhân sự (CSDL MOET)', 'Tạo hồ sơ + tài khoản học viên từ danh sách MOET.', 'Mỗi dòng cần mã định danh hoặc CCCD 12 số. Mật khẩu lần đầu là ngày sinh (ddmmyyyy). Có Mã đơn vị thì khớp theo mã (tránh trùng tên trường).'],
            ['Phân lớp học viên (MOET)', '**Ghi danh** học viên vào khóa, phân lớp theo giai đoạn, gán cụm.', 'Cách duy nhất để ghi danh. Ô giai đoạn trống = giữ nguyên, "-" = gỡ lớp. Cột ten_cum trống = giữ cụm.'],
            ['Lớp và lịch học', 'Tạo lớp và buổi học.', 'Mỗi dòng 1 buổi; thời gian "dd/mm/yyyy hh:mm" giờ Việt Nam.'],
            ['Nhân sự lớp (giảng viên/hỗ trợ)', 'Thêm giảng viên, hỗ trợ cho lớp.', 'Lớp phải tạo trước. Nhập lại cùng tên thì cập nhật, không trùng.'],
            ['Kết quả đánh giá (đầu vào/đầu ra)', '**Chốt mức** đầu vào/đầu ra của học viên trong khóa.', 'Cách duy nhất đặt mức chính thức (Cơ bản/Thành thạo/Nâng cao). Học viên phải đã ghi danh. Nhập lại thì ghi đè.'],
            ['Kết quả khảo sát (từ hệ thống khảo sát)', 'Nạp trạng thái/kết quả bài khảo sát khi hệ thống khảo sát không gửi về được.', 'Mức gốc theo **thang mức** đã cấu hình. Chỉ để theo dõi, không đổi mức chốt.'],
            ['Tài khoản VLE', 'Tài khoản VLE cho học viên (kênh VLE).', 'Mật khẩu tạm được mã hóa, không hiện lại.'],
            ['Điểm danh', 'Điểm danh từng buổi.', 'Bắt buộc loại lớp. Học bù ở lớp khác phải ghi chú.'],
            ['Kết quả giai đoạn', 'Tỉ lệ hoàn thành, điểm theo giai đoạn.', 'Học viên phải đã ghi danh.'],
            ['Tài khoản đơn vị', 'Tạo tài khoản Sở/Phòng/Trường hàng loạt.', 'Xem phần Tài khoản đơn vị.'],
            ['Danh mục đơn vị công tác / địa danh / môn học', 'Danh mục nền.', 'Nhập trước hồ sơ MOET.'],
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Thứ tự nhập',
          noiDung:
            'Danh mục → Hồ sơ MOET → Ghi danh (phân lớp chỉ mã định danh) → Kết quả đánh giá → Lớp và lịch học → Phân lớp (điền cột giai đoạn) → Nhân sự lớp, Điểm danh, Kết quả giai đoạn.',
        },
      ],
    },
    {
      id: 'dot-xac-nhan',
      tieuDe: 'Đợt xác nhận',
      moTa: 'Khoảng thời gian học viên (hồ sơ nhập từ MOET) được sửa và xác nhận hồ sơ.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Đợt xác nhận', duongDan: '/admin/dot-xac-nhan' },
      buoc: [
        'Bấm [[+ Tạo đợt mới]], nhập **Tên đợt**, chọn **Loại đợt**, **Khóa bồi dưỡng** (để *Không giới hạn* nếu áp dụng mọi học viên), **Mở lúc**, **Đóng lúc**, bấm [[Tạo đợt]].',
        'Muốn kéo dài: bấm [[Gia hạn]], chọn **Đóng lúc (mới)**, bấm [[Xác nhận gia hạn]]. Chỉ đổi được giờ đóng.',
      ],
      bang: [
        {
          cot: ['Loại đợt', 'Mục đích'],
          hang: [
            ['Kiểm tra/bổ sung hồ sơ', 'Học viên rà soát, bổ sung hồ sơ (đợt 1). Sau đợt dùng báo cáo *Xuất cho VLE*.'],
            ['Xác nhận trước đánh giá', 'Xác nhận lần cuối trước đánh giá đầu vào (đợt 2, cần cho kênh VLE).'],
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Quy tắc',
          noiDung:
            'Không tạo 2 đợt chồng thời gian trong cùng phạm vi, dù khác loại. Ngoài đợt, học viên không sửa được hồ sơ. Học viên đã xác nhận chỉ xác nhận lại được sau khi sửa hồ sơ; sửa hồ sơ làm hủy lần xác nhận trước. Quá đợt, học viên được hướng dẫn gửi Hỗ trợ.',
        },
      ],
    },
    {
      id: 'cau-hinh-khao-sat',
      tieuDe: 'Cấu hình khảo sát',
      moTa: 'Quyết định học viên thấy gì ở trang giới thiệu, trang chủ cá nhân và cách làm bài khảo sát/đánh giá.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Cấu hình khảo sát', duongDan: '/admin/cau-hinh-khao-sat' },
      buoc: [
        'Ô **Áp dụng cho**: *Cấu hình chung* dùng cho mọi khóa; chọn một khóa để tạo **cấu hình riêng** ([[Tạo cấu hình riêng (sao chép từ cấu hình chung)]]). Muốn bỏ cấu hình riêng: [[Dùng lại cấu hình chung]].',
        'Với cấu hình riêng, **Tỉnh/thành của khóa** quyết định người xem trang giới thiệu chọn tỉnh nào thì thấy cấu hình này (mỗi tỉnh một khóa).',
        'Chỉnh các mục ở bảng dưới, bấm [[Lưu cấu hình]]. Có hiệu lực ngay.',
      ],
      bang: [
        {
          cot: ['Mục', 'Tác dụng'],
          hang: [
            ['Học viên vào hệ thống bằng cách nào?', '*Khảo sát (chưa mở đăng nhập)*: trang giới thiệu mời làm phiếu. *Đăng nhập cổng học viên*: trang giới thiệu mời đăng nhập.'],
            ['Kênh làm bài đánh giá đầu vào', '*Trang khảo sát (đăng nhập một lần)*: chỉ cần hồ sơ đầy đủ. *Tài khoản VLE*: cần đã xác nhận ở đợt xác nhận trước đánh giá và có tài khoản VLE.'],
            ['Hiện mục "Đánh giá đầu vào" trong cổng học viên', 'Hiện/ẩn mục Đánh giá đầu vào trên menu học viên.'],
            ['Mở khảo sát đầu vào cho học viên', 'Trang chủ của học viên (sau đăng nhập) hiện mục Khảo sát đầu vào.'],
            ['Mở khảo sát đầu ra', 'Trang chủ học viên hiện mục Khảo sát đầu ra.'],
            ['Hiện khối khảo sát trên trang giới thiệu (công khai)', 'Chỉ trang giới thiệu trước đăng nhập; độc lập với trang chủ học viên. Bắt buộc bật khi chế độ là Khảo sát.'],
            ['Phiếu 1, 2…', 'Tên, mô tả, nút và đường dẫn từng phiếu (đường dẫn trống hiện nút khóa). Thêm nhiều đường dẫn để tách theo đối tượng. Mũi tên ↑ ↓ đổi thứ tự làm.'],
          ],
        },
      ],
      muc: [
        {
          tieuDe: 'Thang mức kết quả khảo sát',
          buoc: [
            'Hệ thống khảo sát chỉ gửi **mã mức** (ví dụ M1); cổng hiện "mã – nhãn" (M1 – Chưa đạt) cho học viên.',
            'Sửa nhãn, [[Thêm mức]] hoặc xóa mức, bấm [[Lưu thang mức]]. Đổi nhãn có hiệu lực ngay, kể cả kết quả đã nhận; mã không có trong thang bị từ chối.',
          ],
        },
        {
          tieuDe: 'Thử tích hợp SSO với trang khảo sát',
          buoc: [
            'Nhập mã định danh của một học viên, chọn Target, bấm [[Tạo mã thử]]. Hệ thống tạo đường dẫn chuyển sang trang khảo sát và lệnh thử API cho đội khảo sát. Mã hết hạn sau 5 phút, dùng 1 lần.',
          ],
        },
      ],
    },
    {
      id: 'tinh-hinh-khao-sat',
      tieuDe: 'Tình hình khảo sát',
      moTa: 'Theo dõi học viên làm từng bài trên hệ thống khảo sát và kết quả.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Tình hình khảo sát', duongDan: '/admin/tinh-hinh-khao-sat' },
      buoc: [
        'Chọn **Khóa bồi dưỡng** và **loại bài** (Phiếu khảo sát kĩ năng số / Phiếu đánh giá năng lực số / Khảo sát đầu ra).',
        'Năm ô số: Chưa làm, Đã mở chưa nộp, Đang làm, Đã hoàn thành, Cần kiểm tra lại. Bấm vào ô để lọc danh sách, bấm lại để bỏ lọc.',
        'Danh sách hiện trạng thái, mức (mã – nhãn và mức quy đổi nếu có), điểm dạng "13,75 / 44 (31,25%)", link [[Xem kết quả chi tiết]], số lần vào bài, thời điểm và nguồn cập nhật.',
      ],
      ghiChu: [
        {
          loai: 'info',
          tieuDe: '"Cần kiểm tra lại"',
          noiDung:
            'Học viên đã mở hoặc đang làm nhưng quá 24 giờ không có cập nhật — thường là chưa bấm nộp bài. Liên hệ nhắc học viên vào lại trang khảo sát nộp bài.',
        },
        {
          loai: 'warning',
          tieuDe: 'Mức khảo sát khác mức chốt',
          noiDung:
            'Mức hiện ở đây chỉ để theo dõi. Mức đầu vào chính thức (dùng xếp lớp) chỉ đặt qua nhập *Kết quả đánh giá (đầu vào/đầu ra)*.',
        },
      ],
    },
    {
      id: 'yeu-cau-ho-tro',
      tieuDe: 'Yêu cầu hỗ trợ',
      moTa: 'Trả lời câu hỏi học viên gửi qua mục Hỗ trợ.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Yêu cầu hỗ trợ', duongDan: '/admin/yeu-cau-ho-tro' },
      buoc: [
        'Mặc định hiện các yêu cầu **Chờ xử lý**; chuyển bộ lọc để xem Đã phản hồi, Đã đóng, Tất cả.',
        'Bấm [[Trả lời]], nhập nội dung, bấm [[Gửi trả lời]]. Mỗi yêu cầu trả lời **một lần**; học viên nhận email báo đã có trả lời.',
        'Cột **Đánh giá** hiện học viên hài lòng hay chưa; cột **Hỏi lại?** báo học viên gửi tiếp yêu cầu cùng chủ đề trong 7 ngày sau khi được trả lời.',
      ],
      ghiChu: [
        {
          loai: 'info',
          tieuDe: 'Tự đóng',
          noiDung: 'Yêu cầu đã phản hồi quá 7 ngày được hiện là Đã đóng. Học viên chưa đăng nhập được thì liên hệ qua email hỗ trợ, không qua mục này.',
        },
      ],
    },
    {
      id: 'tai-khoan-don-vi',
      tieuDe: 'Tài khoản đơn vị (Người dùng)',
      moTa: 'Cấp và quản lý tài khoản cho Sở GD&ĐT, Phòng Văn hóa – Xã hội, Trường. Mỗi đơn vị một tài khoản.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Người dùng', duongDan: '/admin/nguoi-dung' },
      buoc: [
        'Bấm [[+ Tạo tài khoản]], chọn **Đơn vị** (chỉ hiện đơn vị chưa có tài khoản). Tên đăng nhập mặc định là mã đơn vị viết thường; người phụ trách mặc định là tên đơn vị.',
        'Chọn **Cách cấp mật khẩu**: [[Sinh mật khẩu tạm]] (hiện một lần, sao chép gửi cho đơn vị) hoặc [[Gửi email kích hoạt]] (cần email, link dùng trong 72 giờ). Bấm [[Tạo tài khoản]].',
        'Tạo hàng loạt: [[Nhập từ Excel]] (loại *Tài khoản đơn vị*). Khi xác nhận, hệ thống tải về file mật khẩu tạm cho các đơn vị không có email.',
        'Menu [[⋯]] trên từng dòng: [[Sửa]], [[Cấp mật khẩu tạm]], [[Gửi email kích hoạt]], [[Khóa]]/[[Mở khóa]].',
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Bảo mật mật khẩu tạm',
          noiDung:
            'Mật khẩu tạm chỉ hiện một lần, hệ thống không lưu lại. File mật khẩu tạm tải về là tài liệu nhạy cảm: gửi xong thì xóa. Đổi người phụ trách thì sửa chính tài khoản đó rồi cấp mật khẩu mới; cần chặn ngay thì [[Khóa]] trước.',
        },
      ],
    },
    {
      id: 'tai-khoan-hoc-vien',
      tieuDe: 'Tài khoản học viên',
      moTa: 'Hỗ trợ học viên quên mật khẩu, bị khóa tạm, chưa đăng nhập được.',
      vaiTro: 'quan_tri',
      manHinh: { nhan: 'Tài khoản học viên', duongDan: '/admin/tai-khoan-hoc-vien' },
      buoc: [
        'Tìm theo họ tên, CCCD, số điện thoại, tên đăng nhập; lọc *Đang tạm khóa*, *Chưa đăng nhập lần nào*, *Chưa đổi mật khẩu mặc định*.',
        'Menu [[⋯]]: [[Cấp lại mật khẩu]] (đưa về ngày sinh ddmmyyyy, bắt đổi khi đăng nhập), [[Gỡ tạm khóa]] (giữ mật khẩu), [[Khóa tài khoản]]/[[Mở khóa tài khoản]], [[Xem nhật ký]], [[Xem hồ sơ]].',
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Xác minh trước khi cấp lại mật khẩu',
          noiDung:
            'Hỏi người yêu cầu và đối chiếu **họ tên, ngày sinh, đơn vị công tác, số điện thoại** (hiện sẵn trong hộp thoại) trước khi bấm [[Cấp lại mật khẩu]]. Không gửi mật khẩu qua nhóm Zalo chung.',
        },
      ],
    },
  ],

  hoiDap: [
    {
      hoi: 'Tài khoản Trường/Phòng/Sở có sửa được dữ liệu không?',
      dap: 'Không. Tài khoản đơn vị chỉ xem học viên, khóa, báo cáo trong phạm vi đơn vị. Cần điều chỉnh, liên hệ Quản trị.',
      vaiTro: 'tat_ca',
    },
    {
      hoi: 'Vì sao tôi không thấy một khóa hoặc một số học viên?',
      dap: 'Dữ liệu giới hạn theo phạm vi đơn vị. Khóa chỉ hiện khi đơn vị là đơn vị đặt hàng hoặc có học viên tham gia; trường hợp tham gia thì chỉ thấy học viên của đơn vị mình.',
      vaiTro: 'tat_ca',
    },
    {
      hoi: 'Quên mật khẩu tài khoản đơn vị?',
      dap: 'Tài khoản đã có email: bấm [[Quên mật khẩu?]] ở trang đăng nhập (link dùng trong 30 phút). Chưa có email: liên hệ Quản trị cấp mật khẩu tạm.',
      vaiTro: 'tat_ca',
    },
    {
      hoi: 'Học viên chưa có tên trong danh sách thì làm sao?',
      dap: 'Chưa có hồ sơ thì chưa có tài khoản. Bổ sung học viên vào file *Hồ sơ nhân sự (CSDL MOET)*, nhập lại, rồi ghi danh vào khóa.',
      vaiTro: 'quan_tri',
    },
    {
      hoi: 'Học viên báo không đăng nhập được?',
      dap: 'Mở [[Tài khoản học viên]], tìm học viên: đang tạm khóa thì [[Gỡ tạm khóa]]; quên mật khẩu thì xác minh rồi [[Cấp lại mật khẩu]]. Xem [[Xem nhật ký]] để biết lần đăng nhập gần nhất.',
      vaiTro: 'quan_tri',
    },
    {
      hoi: 'Học viên đã làm khảo sát nhưng cổng vẫn báo chưa làm?',
      dap: 'Xem [[Tình hình khảo sát]]: "Đã mở, chưa nộp" hoặc "Cần kiểm tra lại" nghĩa là chưa nộp bài hoặc hệ thống khảo sát chưa gửi kết quả. Nhắc học viên nộp bài; nếu đã nộp, nhập kết quả bằng file *Kết quả khảo sát*.',
      vaiTro: 'quan_tri',
    },
    {
      hoi: 'Học viên không thấy mục khảo sát đầu vào trên trang chủ?',
      dap: 'Kiểm tra [[Cấu hình khảo sát]] (đúng khóa nếu có cấu hình riêng): công tắc **Mở khảo sát đầu vào cho học viên** phải bật; hồ sơ học viên phải đầy đủ (kể cả mục Đối tượng).',
      vaiTro: 'quan_tri',
    },
    {
      hoi: 'Học viên cần sửa hồ sơ khi đã hết đợt xác nhận?',
      dap: 'Học viên gửi Yêu cầu hỗ trợ. Quản trị mở một đợt mới (hoặc gia hạn đợt đang chạy nếu chưa đóng) để học viên tự sửa và xác nhận lại.',
      vaiTro: 'quan_tri',
    },
    {
      hoi: 'Nhập file báo lỗi nhiều dòng?',
      dap: 'Tải [[Tải file lỗi]] (có cột Lý do), sửa đúng các dòng đó rồi nhập lại; dòng hợp lệ vẫn có thể [[Xác nhận nạp dữ liệu]] trước. Lỗi hay gặp: sai định dạng ngày giờ, mã khóa/lớp không tồn tại, học viên chưa ghi danh.',
      vaiTro: 'quan_tri',
    },
    {
      hoi: 'Mức "M1 – Chưa đạt" ở Tình hình khảo sát có tự xếp học viên vào lớp không?',
      dap: 'Không. Mức khảo sát chỉ để theo dõi. Mức chính thức để xếp lớp đặt bằng nhập *Kết quả đánh giá (đầu vào/đầu ra)*.',
      vaiTro: 'quan_tri',
    },
  ],
};
