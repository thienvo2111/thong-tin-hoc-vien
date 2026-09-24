import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Đánh dấu route bỏ qua JwtAuthGuard toàn cục — theo docs/api-contract.md
// mục "Quy ước chung > Auth": chỉ POST /auth/dang-nhap và POST /hoc-vien
// (đăng ký) là công khai.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
