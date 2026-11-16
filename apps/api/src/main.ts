import { server } from "./server";
import { pool } from "db/client";
import { validateAuthConfig } from "./auth";

async function main() {
  try {
    validateAuthConfig();
    const hostname = process.env.HOSTNAME || "localhost";
    const port = Number(process.env.PORT) || 4000;
    await server.listen({
      port,
      host: hostname,
    });
    server.log.info(
      { hostname, port, url: `http://${hostname}:${port}` },
      "Server listening"
    );
  } catch (error) {
    server.log.error(error, "Failed to start server");
    process.exit(1);
  }
}

main();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => { await server.close(); await pool.end(); });
}
