import http from "http";
import app from "./app";
import { normalizePort, onError, onListening } from "./utils/helpers";
import { config } from "dotenv";
import { startCronerToSyncInstruments } from "./utils/firebase/base";
import AngelLogin from "./utils/angelOne/instance";
config();

const port = normalizePort(process.env.PORT || "3001");
// set port
app.set("port", port);
// create http server instance
const server = http.createServer(app);
// start server and check for success or error events of server start
server.listen(port);
server.on("error", (e) => onError(e, port));
server.on("listening", async () => {
  onListening(server);
  console.log("Environment: ", process.env.environment);
  // start daily instrument sync job
  startCronerToSyncInstruments();
  // create angel instance and login
  AngelLogin();
});
