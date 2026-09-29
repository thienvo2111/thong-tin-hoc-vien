import { IsUUID } from 'class-validator';

// Body của POST /khoa-boi-duong/{id}/don-vi-theo-doi — T2 (QĐ2), chỉ quan_tri.
export class ThemDonViTheoDoiDto {
  @IsUUID()
  don_vi_id: string;
}
