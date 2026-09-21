import { defineConfig } from 'vite';
import { parkApi } from './server/park-api.js';
export default defineConfig({plugins: [parkApi()], server: {port: 5173, strictPort: true}, preview: {port: 4173, strictPort: true}});
