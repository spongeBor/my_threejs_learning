import { defineConfig } from 'vite';

// 端口策略：首选 5174，被占用就自动往后找（5175、5176…），不会直接退出。
// 所以终端里打印的才是真实地址，别死记 5174。
export default defineConfig( {
	server: {
		host: '127.0.0.1',
		port: 5174,
		strictPort: false,
	},
	preview: {
		host: '127.0.0.1',
		port: 5175,
		strictPort: false,
	},
} );
