import express from 'express';
import http from 'http';
import createHttpError from 'http-errors';
import { normalizePort, onError, onListening } from './utils/common';

const port = normalizePort(process.env.PORT || '3001');
const app = express();
app.use(express.json());

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createHttpError(404));
});

// set port
app.set('port', port);
// create http server instance
const server = http.createServer(app)
// start server and check for success or error events of server start
server.listen(port);
server.on('error', (e) => onError(e, port));
server.on('listening', () => onListening(server));
