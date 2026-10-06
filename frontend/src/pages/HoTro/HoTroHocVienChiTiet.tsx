import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useChiTietHocVienHoTro } from '@/api/hoTro';
import type { HocVienHoTroChiTiet, LoaiLop } from '@/api/types';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { TEN_BAI_KHAO_SAT } from '@/lib/trangThaiKhaoSat';
import { nhanMucNangLuc } from '@/lib/mucNangLuc';
import { DOI_TUONG_OPTIONS, nhanTuTuyChon } from '@/lib/tuyChonHoSo';

const NHAN_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' };
const NHAN_KHAO_SAT: Record<string, string> = { da_mo: 'Đã mở, chưa nộp', dang_lam: 'Đang làm', hoan_thanh: 'Đã hoàn thành' };
const NHAN_YEU_CAU: Record<string, string> = { cho_xu_ly: 'Chờ xử lý', da_phan_hoi: 'Đã phản hồi', da_dong: 'Đã đóng' };

function Muc({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <div>
      <Text fz="xs" c="dimmed">
        {nhan}
      </Text>
      <Text fz="sm">{children ?? '—'}</Text>
    </div>
  );
}

function Khung({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return (
    <Paper withBorder radius={14} p="md">
      <Stack gap="sm">
        <Title order={5}>{tieuDe}</Title>
        {children}
      </Stack>
    </Paper>
  );
}

function LienKet({ url }: { url: string | null }) {
  if (!url) return <>—</>;
  const href = chuanHoaLienKet(url);
  return href ? (
    <Anchor href={href} target="_blank" rel="noreferrer" fz="sm" style={{ wordBreak: 'break-all' }}>
      {url}
    </Anchor>
  ) : (
    <>{url}</>
  );
}

function HocTap({ hocTap }: { hocTap: HocVienHoTroChiTiet['hoc_tap'] }) {
  if (hocTap.length === 0) return <Text c="dimmed">Chưa ghi danh khóa nào.</Text>;
  return (
    <Stack gap="md">
      {hocTap.map((dk) => (
        <Stack key={dk.id} gap="xs">
          <Group gap="xs">
            <Text fw={600}>{dk.khoa.ten_khoa}</Text>
            <Text fz="sm" c="dimmed">
              {dk.khoa.ma_khoa}
            </Text>
            {dk.cum && <Badge variant="light">{dk.cum.ten_cum}</Badge>}
            {dk.muc_dau_vao && <Badge variant="outline">Đầu vào: {nhanMucNangLuc(dk.muc_dau_vao)}</Badge>}
          </Group>
          {dk.giai_doan.map((gd) => (
            <Paper key={gd.id} withBorder radius={10} p="sm" bg="gray.0">
              <Text fz="sm" fw={600}>
                GĐ{gd.thu_tu} – {gd.ten_giai_doan}
              </Text>
              {!gd.lop ? (
                <Text fz="sm" c="dimmed">
                  Chưa phân lớp. {gd.link_hoac_dia_diem && <>Thông tin chung: <LienKet url={gd.link_hoac_dia_diem} /></>}
                </Text>
              ) : (
                <Stack gap={4} mt={4}>
                  <Text fz="sm">
                    Lớp <b>{gd.lop.ten_lop}</b> ({NHAN_LOAI_LOP[gd.lop.loai_lop]})
                    {gd.lop.nhan_su.length > 0 &&
                      ` · ${gd.lop.nhan_su
                        .map((n) => `${n.vai_tro === 'giang_vien' ? 'GV' : 'Hỗ trợ'}: ${n.ho_ten}${n.so_dien_thoai ? ` (${n.so_dien_thoai})` : ''}`)
                        .join('; ')}`}
                  </Text>
                  {gd.lop.lich_hoc.map((b) => (
                    <Group key={b.id} gap="xs" wrap="nowrap" align="flex-start">
                      <Text fz="sm" w={64} c="dimmed">
                        Buổi {b.buoi_so}
                      </Text>
                      <Text fz="sm" w={150}>
                        {dinhDangNgayGio(b.thoi_gian_bat_dau)}
                      </Text>
                      <Text fz="sm" style={{ flex: 1 }}>
                        <LienKet url={b.dia_diem_hoac_link} />
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

/** Chi tiết 1 học viên trong cụm của người hỗ trợ (ADR 0003 H5) — chỉ xem; ngoài cụm backend trả 404. */
export default function HoTroHocVienChiTiet() {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useChiTietHocVienHoTro(id);

  return (
    <Container size="lg" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Anchor component={Link} to="/ho-tro/hoc-vien" fz="sm">
          ← Danh sách học viên
        </Anchor>
        {isLoading && <Skeleton height={240} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && (
          <>
            <Group gap="sm">
              <Title order={3}>{data.ho_so.ho_ten}</Title>
              <Badge color={data.ho_so.day_du ? 'green' : 'orange'} variant="light">
                {data.ho_so.day_du ? 'Hồ sơ đủ' : 'Hồ sơ chưa đủ'}
              </Badge>
            </Group>

            <Khung tieuDe="Hồ sơ">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                <Muc nhan="Mã định danh MOET">{data.ho_so.ma_dinh_danh_moet}</Muc>
                <Muc nhan="Số CCCD">{data.ho_so.so_dinh_danh_ca_nhan}</Muc>
                <Muc nhan="Ngày sinh">
                  {data.ho_so.ngay_sinh}/{data.ho_so.thang_sinh}/{data.ho_so.nam_sinh}
                </Muc>
                <Muc nhan="Đơn vị công tác">{data.ho_so.don_vi_cong_tac_ten}</Muc>
                <Muc nhan="Chức vụ">{data.ho_so.chuc_vu}</Muc>
                <Muc nhan="Đối tượng">{data.ho_so.doi_tuong ? nhanTuTuyChon(DOI_TUONG_OPTIONS, data.ho_so.doi_tuong) : null}</Muc>
                <Muc nhan="Số điện thoại">{data.ho_so.so_dien_thoai_lien_he}</Muc>
                <Muc nhan="Email">{data.ho_so.email_lien_he}</Muc>
                <Muc nhan="Môn giảng dạy">{data.ho_so.mon_giang_day_ten}</Muc>
              </SimpleGrid>
              {!data.ho_so.day_du && data.ho_so.thieu.length > 0 && (
                <Alert color="orange" variant="light" title="Còn thiếu">
                  {data.ho_so.thieu
                    .map((t) => (t.field === 'doi_tuong' ? t.message : `${nhanCuaTruong(t.field)}: ${t.message.toLowerCase()}`))
                    .join('; ')}
                </Alert>
              )}
            </Khung>

            <Khung tieuDe="Tài khoản">
              {!data.tai_khoan ? (
                <Text c="dimmed">Chưa có tài khoản đăng nhập.</Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  <Muc nhan="Tên đăng nhập">
                    <Text span ff="monospace" fz="sm">
                      {data.tai_khoan.ten_dang_nhap}
                    </Text>
                  </Muc>
                  <Muc nhan="Lần đăng nhập cuối">
                    {data.tai_khoan.dang_nhap_lan_cuoi ? dinhDangNgayGio(data.tai_khoan.dang_nhap_lan_cuoi) : 'Chưa đăng nhập'}
                  </Muc>
                  <Muc nhan="Trạng thái">
                    {data.tai_khoan.trang_thai !== 'active'
                      ? 'Đã khóa'
                      : data.tai_khoan.dang_bi_khoa
                        ? `Tạm khóa tới ${dinhDangNgayGio(data.tai_khoan.khoa_den!)}`
                        : data.tai_khoan.phai_doi_mat_khau
                          ? 'Chưa đổi mật khẩu lần đầu'
                          : 'Bình thường'}
                  </Muc>
                  <Muc nhan="Email">{data.tai_khoan.email_da_xac_minh ? 'Đã xác minh' : 'Chưa xác minh'}</Muc>
                </SimpleGrid>
              )}
            </Khung>

            <Khung tieuDe="Học tập">
              <HocTap hocTap={data.hoc_tap} />
            </Khung>

            <Khung tieuDe="Khảo sát">
              {data.khao_sat.length === 0 ? (
                <Text c="dimmed">Chưa mở bài khảo sát nào.</Text>
              ) : (
                <Stack gap={4}>
                  {data.khao_sat.map((k) => (
                    <Text key={k.loai} fz="sm">
                      {TEN_BAI_KHAO_SAT[k.loai as keyof typeof TEN_BAI_KHAO_SAT] ?? k.loai}: {NHAN_KHAO_SAT[k.trang_thai]}
                      {k.muc ? ` · ${nhanMucNangLuc(k.muc)}` : ''}
                    </Text>
                  ))}
                </Stack>
              )}
            </Khung>

            <Khung tieuDe="Yêu cầu hỗ trợ">
              {data.yeu_cau_ho_tro.length === 0 ? (
                <Text c="dimmed">Chưa gửi yêu cầu nào.</Text>
              ) : (
                <Stack gap={6}>
                  {data.yeu_cau_ho_tro.map((y) => (
                    <Group key={y.id} gap="xs" wrap="nowrap" align="flex-start">
                      <Badge variant="light" miw={96}>
                        {NHAN_YEU_CAU[y.trang_thai]}
                      </Badge>
                      <Text fz="sm" c="dimmed" w={90}>
                        {dinhDangNgay(y.thoi_gian_tao)}
                      </Text>
                      <Text fz="sm" lineClamp={2} style={{ flex: 1 }}>
                        {y.tinh_huong ? `[${y.tinh_huong}] ` : ''}
                        {y.noi_dung_hoi}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Khung>

            <Khung tieuDe="Lịch sử thay đổi hồ sơ">
              {data.lich_su_thay_doi.length === 0 ? (
                <Text c="dimmed">Chưa có thay đổi.</Text>
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing={6}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Thời gian</Table.Th>
                        <Table.Th>Trường</Table.Th>
                        <Table.Th>Cũ → Mới</Table.Th>
                        <Table.Th>Người sửa</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.lich_su_thay_doi.map((l, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{dinhDangNgayGio(l.sua_luc)}</Table.Td>
                          <Table.Td>{nhanCuaTruong(l.truong)}</Table.Td>
                          <Table.Td>
                            {l.gia_tri_cu ?? '—'} → {l.gia_tri_moi ?? '—'}
                          </Table.Td>
                          <Table.Td>{l.nguoi_sua_ten}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Khung>
          </>
        )}
      </Stack>
    </Container>
  );
}
