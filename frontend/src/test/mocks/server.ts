import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { cauHinhKhaoSatHandlers } from './cauHinhKhaoSat';

export const server = setupServer(...handlers, ...cauHinhKhaoSatHandlers);
