/**
 * Normalize a port into a number, string, or false.
 */
export const normalizePort = (val: any) => {
  const port = parseInt(val, 10);
  if (isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
};

/**
 * Event listener for HTTP server "error" event.
 */
export const onError = (error: any, port: any) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

/**
 * Event listener for HTTP server "listening" event.
 */
export const onListening = (server: any) => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;
  console.log(
    `Server is running on http://localhost:${
      typeof addr !== "string" ? addr?.port : addr
    } Ok`
  );
};

/**
 * @param text String
 * @returns String
 */
export const generateHash = async (text: string) => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text, "utf-8").digest("hex");
};

/**
 * @param text String
 * @returns String
 */
export const sanitizeText = (text: string) =>
  text
    .replace(/[^a-zA-Z0-9\s:]/g, "")
    .split(" ")
    .join("")
    .toUpperCase();
