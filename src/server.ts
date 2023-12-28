import http from 'http';
import app from './app';
import { normalizePort, onError, onListening } from './utils/helpers';
import { config } from 'dotenv';
import Alice from './utils/aliceBlue/base';
config();

const port = normalizePort(process.env.PORT || '3001');
// set port
app.set('port', port);
// create http server instance
const server = http.createServer(app)
// start server and check for success or error events of server start
server.listen(port);
server.on('error', (e) => onError(e, port));
server.on('listening', async () => {
    onListening(server);
    const alice = new Alice(process.env.USERID + "", process.env.API_KEY + "")
    await alice.apiEncryptionKey()
    await alice.getSessionId()
    await alice.WebSocket()
});
