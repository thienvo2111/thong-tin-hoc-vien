import { createTheme } from '@mantine/core';

// Mobile-first: ô nhập lớn, dễ bấm bằng ngón tay (CLAUDE.md § Người dùng).
export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontSizes: { md: '16px' },
  components: {
    TextInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
    Autocomplete: { defaultProps: { size: 'md' } },
    TagsInput: { defaultProps: { size: 'md' } },
    Button: { defaultProps: { size: 'md' } },
    Checkbox: { defaultProps: { size: 'md' } },
  },
});
