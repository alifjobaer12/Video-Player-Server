import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cwd } from "node:process";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, cwd(), "");

	return {
		plugins: [react(), tailwindcss()],
		define: {
			"import.meta.env.VITE_ADMIN_ROUTE_TOKEN": JSON.stringify(
				env.ADMIN_ROUTE_TOKEN ?? "",
			),
		},
	};
});
