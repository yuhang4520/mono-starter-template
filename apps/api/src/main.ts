import { server } from "./server";

async function main() {
  try {
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
