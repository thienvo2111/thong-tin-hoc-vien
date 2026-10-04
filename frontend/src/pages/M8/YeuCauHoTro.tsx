import { useState } from 'react';
import {
  Anchor,
  Badge,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import type { ComboboxItem, ComboboxParsedItem, OptionsFilter } from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useDanhGiaYeuCauHoTro,
  useDanhSachYeuCauHoTroCuaToi,
  useDongYeuCauHoTro,
  useTaoYeuCauHoTro,
} from '@/api/yeuCauHoTro';
import type { TrangThaiYeuCauHoTro } from '@/api/types';
import { huongDan, idPhanTheoSo, NHAN_NHOM_LOI, type NhomLoi, type TinhHuongLoi } from '@/content/huongDan';
import { TextMarkup } from '@/components/TextMarkup';
import { khopTimKiem } from '@/lib/timKiemTiengViet';
import { taoYeuCauHoTroSchema, type TaoYeuCauHoTroForm } from '@/schemas/yeuCauHoTro';
import { StatusBanner } from '@/components/StatusBanner';
import { thongDiepLoiChung } from '@/lib/loiApi';

const MAU_TRANG_THAI: Record<TrangThaiYeuCauHoTro, string> = {
  cho_xu_ly: 'yellow',
  da_phan_hoi: 'blue',
  da_dong: 'gray',
};

const NHAN_TRANG_THAI: Record<TrangThaiYeuCauHoTro, string> = {
  cho_xu_ly: 'Đang chờ xử lý',
  da_phan_hoi: 'Đã có trả lời',
  da_dong: 'Đã đóng',
};

// Danh sách vấn đề lấy thẳng từ mục "Lỗi thường gặp và cách khắc phục" của trang Hướng dẫn
// (content/huongDan.ts) — sửa nội dung ở đó, trang này tự cập nhật. Value = tên tình huống, được
// lưu vào yeu_cau_ho_tro.tinh_huong khi gửi.
const TINH_HUONG_KHAC = 'Khác';

/** Resolver cho TextMarkup: "Phần N" -> "/huong-dan#id" vì trang này không có các phần đó, phải
 * điều hướng sang trang Hướng dẫn (M9). */
function lienKetPhanSangHuongDan(so: number): string | undefined {
  const id = idPhanTheoSo(so);
  return id ? `/huong-dan#${id}` : undefined;
}

const TINH_HUONG_THEO_TEN = new Map<string, TinhHuongLoi>(
  huongDan.troubleshooting.map((t) => [t.tinhHuong, t]),
);

const TUY_CHON_TINH_HUONG = [
  ...(Object.keys(NHAN_NHOM_LOI) as NhomLoi[])
    .map((nhom) => ({
      group: NHAN_NHOM_LOI[nhom],
      items: huongDan.troubleshooting.filter((t) => t.nhom === nhom).map((t) => t.tinhHuong),
    }))
    .filter((g) => g.items.length > 0),
  { group: 'Khác', items: [{ value: TINH_HUONG_KHAC, label: 'Vấn đề khác (không có trong danh sách)' }] },
];

// Tìm không phân biệt dấu (gõ "mat khau" vẫn ra "Quên mật khẩu"), giữ nguyên nhóm.
const locTinhHuong: OptionsFilter = ({ options, search }) => {
  if (!search.trim()) return options;
  return options
    .map((o: ComboboxParsedItem) =>
      'group' in o
        ? { ...o, items: o.items.filter((it: ComboboxItem) => khopTimKiem(it.label, search)) }
        : o,
    )
    .filter((o) => ('group' in o ? o.items.length > 0 : khopTimKiem((o as ComboboxItem).label, search)));
};

/** M8 — Yêu cầu hỗ trợ: chọn vấn đề trong danh sách "Lỗi thường gặp" -> đọc nguyên nhân + cách khắc
 * phục; vẫn còn thắc mắc thì gõ nội dung gửi yêu cầu. Chọn "Khác" thì gõ nội dung gửi ngay. */
export default function YeuCauHoTroPage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Yêu cầu hỗ trợ
        </Title>
        <Anchor component={Link} to="/huong-dan#loi" size="sm">
          Xem lỗi thường gặp và cách khắc phục
        </Anchor>
        <FormTaoTicket />
        <DanhSachCuaToi />
      </Stack>
    </Container>
  );
}

function CachKhacPhuc({ tinhHuong }: { tinhHuong: TinhHuongLoi }) {
  return (
    <StatusBanner loai="info" tieuDe="Cách khắc phục">
      <Stack gap={8}>
        <Text fz={13} c="dimmed">
          <TextMarkup text={tinhHuong.nguyenNhan} lienKetPhan={lienKetPhanSangHuongDan} />
        </Text>
        <Stack gap={6} component="ol" m={0} pl={20}>
          {tinhHuong.cachXuLy.map((b, i) => (
            <Text key={i} component="li" fz={14} lh={1.5}>
              <TextMarkup text={b} lienKetPhan={lienKetPhanSangHuongDan} />
            </Text>
          ))}
        </Stack>
      </Stack>
    </StatusBanner>
  );
}

function FormTaoTicket() {
  const taoTicket = useTaoYeuCauHoTro();
  const [conThacMac, setConThacMac] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaoYeuCauHoTroForm>({
    resolver: zodResolver(taoYeuCauHoTroSchema),
    defaultValues: { tinh_huong: '', noi_dung_hoi: '' },
  });

  const tinhHuongChon = watch('tinh_huong');
  const chiTiet = TINH_HUONG_THEO_TEN.get(tinhHuongChon);
  const laKhac = tinhHuongChon === TINH_HUONG_KHAC;
  const hienForm = laKhac || (!!chiTiet && conThacMac);

  function guiTicket(values: TaoYeuCauHoTroForm) {
    taoTicket.mutate(
      { tinh_huong: values.tinh_huong.normalize('NFC'), noi_dung_hoi: values.noi_dung_hoi.normalize('NFC') },
      {
        onSuccess: () => {
          reset();
          setConThacMac(false);
        },
      },
    );
  }

  return (
    <Stack gap="md">
      <Controller
        name="tinh_huong"
        control={control}
        render={({ field }) => (
          <Select
            label="Vấn đề Thầy/Cô đang gặp"
            placeholder="Chọn hoặc gõ vài chữ để tìm, ví dụ: mật khẩu"
            data={TUY_CHON_TINH_HUONG}
            filter={locTinhHuong}
            searchable
            nothingFoundMessage="Không thấy? Chọn mục Vấn đề khác"
            maxDropdownHeight={320}
            value={field.value || null}
            onChange={(v) => {
              field.onChange(v ?? '');
              setConThacMac(false);
            }}
            error={errors.tinh_huong?.message}
          />
        )}
      />

      {chiTiet && <CachKhacPhuc tinhHuong={chiTiet} />}

      {chiTiet && !conThacMac && (
        <Button variant="default" onClick={() => setConThacMac(true)}>
          Vẫn còn thắc mắc, gửi câu hỏi
        </Button>
      )}

      {hienForm && (
        <form onSubmit={handleSubmit(guiTicket)} noValidate>
          <Stack gap="sm">
            <Textarea
              label={laKhac ? 'Nội dung cần hỗ trợ' : 'Nội dung thắc mắc'}
              description="Mô tả cụ thể Thầy/Cô đã làm gì và thấy thông báo gì trên màn hình."
              minRows={3}
              autosize
              error={errors.noi_dung_hoi?.message}
              {...register('noi_dung_hoi')}
            />
            {taoTicket.isError && (
              <StatusBanner loai="error">{thongDiepLoiChung(taoTicket.error)}</StatusBanner>
            )}
            <Button type="submit" loading={taoTicket.isPending}>
              Gửi yêu cầu
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}

function DanhSachCuaToi() {
  const { data, isLoading, isError, error } = useDanhSachYeuCauHoTroCuaToi();
  const dong = useDongYeuCauHoTro();
  const danhGia = useDanhGiaYeuCauHoTro();

  if (isLoading) {
    return (
      <Center py="lg">
        <Loader />
      </Center>
    );
  }
  if (isError) return <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>;
  if (!data || data.length === 0) return null;

  return (
    <Stack gap="sm">
      <Title order={2} size="h4">
        Yêu cầu của tôi
      </Title>
      {data.map((yc) => (
        <Stack
          key={yc.id}
          gap={6}
          p="sm"
          style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
        >
          <Group justify="space-between">
            <Text fw={600}>{yc.chu_de}</Text>
            <Badge color={MAU_TRANG_THAI[yc.trang_thai]}>{NHAN_TRANG_THAI[yc.trang_thai]}</Badge>
          </Group>
          <Text size="sm">{yc.noi_dung_hoi}</Text>
          {yc.noi_dung_tra_loi && (
            <Text size="sm" c="dimmed">
              <b>Trả lời:</b> {yc.noi_dung_tra_loi}
            </Text>
          )}
          {yc.trang_thai === 'da_phan_hoi' && (
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => dong.mutate(yc.id)}>
                Đã giải quyết
              </Button>
              {!yc.danh_gia && (
                <>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => danhGia.mutate({ id: yc.id, danh_gia: 'hai_long' })}
                  >
                    👍 Hài lòng
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => danhGia.mutate({ id: yc.id, danh_gia: 'chua_hai_long' })}
                  >
                    👎 Chưa hài lòng
                  </Button>
                </>
              )}
            </Group>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
