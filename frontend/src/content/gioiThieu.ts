// src/content/gioiThieu.ts
// Nội dung trang giới thiệu (M0). Dùng chung cho nhiều tỉnh — KHÔNG ghi tên tỉnh.
// Khối có `tam: true` là nội dung tạm, đơn vị tổ chức sẽ thay. Chuỗi bắt đầu bằng "[CHỜ" là thông tin còn thiếu.
// Chỉ sửa file này để đổi nội dung; không sửa component.

export interface Khoi {
  hien: boolean;
  tam?: boolean;
}

export interface NoiDungGioiThieu {
  meta: { tieuDe: string; moTa: string; anhChiaSe: string };
  thongBaoNoiBat: string | null;
  moDau: Khoi & { tenChuongTrinh: string; thongDiep: string; nutChinh: string; nutPhu: string };
  conSo: Khoi & { muc: { so: string; nhan: string }[] };
  viSao: Khoi & {
    tieuDe: string;
    doanMo: string;
    loiIch: string[];
    cacMuc: { ten: string; moTa: string }[];
  };
  loTrinh: Khoi & { tieuDe: string; buoc: { ten: string; moTa: string }[] };
  noiDung: Khoi & { tieuDe: string; moDun: { ten: string; moTa: string; hinhThuc: string }[] };
  huongDan: Khoi & { tieuDe: string; buoc: { ten: string; moTa: string }[] };
  hoiDap: Khoi & { tieuDe: string; cau: { hoi: string; dap: string }[] };
  lienHe: Khoi & { tieuDe: string; hotline: string; zalo: string; email: string; gioHoTro: string };
  donVi: Khoi & {
    toChuc: { ten: string; logo: string; diaChi: string };
    phoiHop: { ten: string; logo: string; hien: boolean }[];
  };
}

export const gioiThieu: NoiDungGioiThieu = {
  meta: {
    tieuDe: 'Bồi dưỡng năng lực số cho giáo viên',
    moTa: 'Chương trình bồi dưỡng năng lực số cho giáo viên do Trường Đại học Sư phạm Thành phố Hồ Chí Minh tổ chức. Đăng nhập để kiểm tra hồ sơ và theo dõi lộ trình học.',
    anhChiaSe: '/og-image.png', // [CHỜ] ảnh 1200×630
  },

  // Dải thông báo trên cùng; null = ẩn. Ví dụ: 'Đợt kiểm tra hồ sơ mở đến 23:59 ngày 04/10/2026.'
  thongBaoNoiBat: null,

  moDau: {
    hien: true,
    tam: true,
    tenChuongTrinh: 'Bồi dưỡng năng lực số cho giáo viên',
    thongDiep: 'Cùng thầy cô làm chủ công nghệ số trong dạy học và công tác chuyên môn.',
    nutChinh: 'Đăng nhập cổng học viên',
    nutPhu: 'Tìm hiểu chương trình',
  },

  conSo: {
    hien: false, // bật khi có số liệu chính thức
    tam: true,
    muc: [
      { so: '[CHỜ]', nhan: 'tỉnh, thành đã triển khai' },
      { so: '[CHỜ]', nhan: 'giáo viên tham gia' },
    ],
  },

  viSao: {
    hien: false, // bật khi Ban chuyên môn duyệt nội dung
    tam: true,
    tieuDe: 'Vì sao cần năng lực số?',
    doanMo: '[CHỜ BCM] Mục tiêu của chương trình.',
    loiIch: [
      'Học theo đúng mức năng lực của bản thân, xác định qua bài đánh giá đầu vào.',
      'Kết hợp học trực tuyến và tập huấn trực tiếp, thuận tiện cho giáo viên đang công tác.',
      'Được cấp giấy chứng nhận khi hoàn thành chương trình.',
    ],
    cacMuc: [
      { ten: 'Cơ bản', moTa: '[CHỜ BCM] Mô tả ngắn mức Cơ bản.' },
      { ten: 'Thành thạo', moTa: '[CHỜ BCM] Mô tả ngắn mức Thành thạo.' },
      { ten: 'Nâng cao', moTa: '[CHỜ BCM] Mô tả ngắn mức Nâng cao.' },
    ],
  },

  loTrinh: {
    hien: true,
    tam: true,
    tieuDe: 'Lộ trình học',
    buoc: [
      { ten: 'Kiểm tra hồ sơ', moTa: 'Đăng nhập, kiểm tra và bổ sung thông tin cá nhân, xác nhận hồ sơ.' },
      { ten: 'Đánh giá đầu vào', moTa: 'Làm bài đánh giá trực tuyến để xác định mức năng lực và xếp lớp phù hợp.' },
      { ten: 'Học trực tuyến qua Zoom', moTa: 'Các buổi học trực tuyến cùng giảng viên theo lịch của lớp.' },
      { ten: 'Học trên hệ thống VLE', moTa: 'Tự học theo tiến độ trên hệ thống học tập trực tuyến.' },
      { ten: 'Tập huấn trực tiếp', moTa: 'Học tập, thực hành cùng giảng viên tại điểm học gần nơi công tác.' },
      { ten: 'Học trên VLE lần 2', moTa: 'Củng cố và hoàn thiện các nội dung đã học.' },
      { ten: 'Đánh giá đầu ra & chứng nhận', moTa: 'Làm bài đánh giá cuối khóa; học viên đạt yêu cầu được cấp giấy chứng nhận.' },
    ],
  },

  noiDung: {
    hien: false, // bật khi có danh sách mô-đun chính thức
    tam: true,
    tieuDe: 'Nội dung chương trình',
    moDun: [{ ten: '[CHỜ BCM] Tên mô-đun', moTa: '[CHỜ BCM] Mô tả ngắn.', hinhThuc: '[CHỜ BCM]' }],
  },

  huongDan: {
    hien: true,
    tieuDe: 'Bắt đầu trong 4 bước',
    buoc: [
      { ten: 'Nhận mã định danh', moTa: 'Nhà trường gửi cho thầy cô mã định danh trên cơ sở dữ liệu ngành.' },
      { ten: 'Đăng nhập', moTa: 'Đăng nhập bằng mã định danh. Mật khẩu lần đầu là ngày sinh viết liền ngày-tháng-năm, ví dụ 08121983. Hệ thống sẽ yêu cầu đổi mật khẩu mới.' },
      { ten: 'Bổ sung và xác nhận hồ sơ', moTa: 'Kiểm tra thông tin, sửa nếu chưa đúng, bổ sung phần còn thiếu, rồi bấm Xác nhận trong thời gian quy định.' },
      { ten: 'Làm bài đánh giá đầu vào', moTa: 'Khi hồ sơ đã đầy đủ và được xác nhận, đường dẫn làm bài sẽ hiện trên trang của thầy cô.' },
    ],
  },

  hoiDap: {
    hien: true,
    tam: true,
    tieuDe: 'Câu hỏi thường gặp',
    cau: [
      { hoi: 'Tôi không biết mã định danh của mình?', dap: 'Thầy cô liên hệ bộ phận phụ trách của nhà trường hoặc số hỗ trợ ở cuối trang.' },
      { hoi: 'Mật khẩu lần đầu là gì?', dap: 'Là ngày sinh viết liền theo dạng ngày-tháng-năm, đủ 8 chữ số. Ví dụ: sinh ngày 8/12/1983 thì nhập 08121983.' },
      { hoi: 'Tôi quên mật khẩu mới đã đổi?', dap: 'Thầy cô liên hệ số hỗ trợ. Sau khi xác minh thông tin, cán bộ hỗ trợ sẽ đặt lại mật khẩu về ngày sinh để thầy cô đăng nhập và đổi lại.' },
      { hoi: 'Tài khoản báo tạm khóa?', dap: 'Do nhập sai mật khẩu nhiều lần. Vui lòng chờ 15 phút rồi thử lại, hoặc liên hệ số hỗ trợ.' },
      { hoi: 'Thông tin của tôi trên hệ thống chưa đúng?', dap: 'Trong thời gian mở đợt kiểm tra, thầy cô tự sửa trực tiếp trên trang Hồ sơ. Họ tên và ngày sinh sẽ in trên giấy chứng nhận, vì vậy cần kiểm tra kỹ.' },
      { hoi: 'Vì sao tôi chưa thấy đường dẫn làm bài đánh giá?', dap: 'Đường dẫn chỉ hiện khi hồ sơ đã đầy đủ và thầy cô đã xác nhận trong đợt xác nhận trước đánh giá. Nếu đã sửa hồ sơ sau khi xác nhận, thầy cô cần xác nhận lại.' },
      { hoi: 'Tôi có thể làm trên điện thoại không?', dap: 'Có. Trang được thiết kế để dùng tốt trên điện thoại, kể cả khi mở từ Zalo.' },
    ],
  },

  lienHe: {
    hien: true,
    tam: true,
    tieuDe: 'Liên hệ hỗ trợ',
    hotline: '[CHỜ]',
    zalo: '[CHỜ]',
    email: '[CHỜ]',
    gioHoTro: '[CHỜ]',
  },

  donVi: {
    hien: true,
    tam: true,
    toChuc: {
      ten: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
      logo: '/logo-hcmue.svg', // [CHỜ] file logo
      diaChi: '[CHỜ]',
    },
    phoiHop: [],
  },
};
