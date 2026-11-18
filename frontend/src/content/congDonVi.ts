// src/content/congDonVi.ts
// Nội dung tĩnh của Cổng đơn vị – Bồi dưỡng giáo viên HCMUE (issue #55, ADR 0015 P4/T6).
// NỘI DUNG TẠM (tam: true): HCMUE sẽ thay lời văn, số điện thoại hỗ trợ và bổ sung ảnh chụp màn hình sau.
// Chỉ sửa file này để đổi nội dung; không sửa component.
// tenCong/moTa còn được vite.config.ts đọc bằng regex để điền meta cong-don-vi.html — giữ dạng chuỗi 1 dòng nháy đơn.

export interface BuocHuongDan {
  tieuDe: string;
  noiDung: string;
}

export interface NoiDungCongDonVi {
  tam: boolean;
  tenCong: string;
  moTa: string;
  thongDiep: string;
  soDienThoaiHoTro: string;
  huongDan: BuocHuongDan[];
}

export const congDonVi: NoiDungCongDonVi = {
  tam: true,
  tenCong: 'Cổng đơn vị – Bồi dưỡng giáo viên HCMUE',
  moTa: 'Cổng dành cho trường, Sở và Phòng phối hợp với Trường Đại học Sư phạm Thành phố Hồ Chí Minh trong các chương trình bồi dưỡng giáo viên.',
  thongDiep: 'Đơn vị xác nhận danh sách giáo viên tham gia và khai hồ sơ đơn vị trực tuyến.',
  soDienThoaiHoTro: '(chưa cập nhật)',
  huongDan: [
    {
      tieuDe: 'Đăng nhập',
      noiDung:
        'Nhập tên tài khoản và mật khẩu tạm do HCMUE cấp. Tên tài khoản của trường là mã trường viết thường, không có khoảng trắng.',
    },
    {
      tieuDe: 'Đổi mật khẩu lần đầu',
      noiDung:
        'Lần đầu đăng nhập, hệ thống yêu cầu đổi mật khẩu tạm sang mật khẩu riêng của đơn vị. Đơn vị ghi nhớ mật khẩu mới để đăng nhập các lần sau.',
    },
    {
      tieuDe: 'Xem danh sách tham gia (sắp có)',
      noiDung:
        'Đơn vị xem danh sách giáo viên tham gia bồi dưỡng, xác nhận danh sách hoặc gửi đề nghị sửa. Chức năng sẽ mở khi có đợt bồi dưỡng.',
    },
    {
      tieuDe: 'Khai hồ sơ đơn vị (sắp có)',
      noiDung:
        'Đơn vị khai thông tin phục vụ hợp đồng bồi dưỡng (người đại diện, tài khoản nhận chuyển khoản...). Chức năng sẽ mở sau.',
    },
    {
      tieuDe: 'Liên hệ hỗ trợ',
      noiDung:
        'Quên mật khẩu hoặc gặp sự cố khi sử dụng, đơn vị liên hệ HCMUE qua số điện thoại hỗ trợ ghi ở trang đăng nhập.',
    },
  ],
};
