import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { cauHinhKhaoSatHandlers } from './cauHinhKhaoSat';
import { ssoHandlers } from './sso';

export const server = setupServer(...handlers, ...cauHinhKhaoSatHandlers, ...ssoHandlers);
