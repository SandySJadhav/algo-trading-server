import express from 'express';
import createHttpError from 'http-errors';
import http from 'http';

const app = express();
app.use(express.json());

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createHttpError(404));
});

const port = normalizePort(process.env.PORT || '3001');
app.set('port', port);

const server = http.createServer(app)

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: any) {
  let port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
* Event listener for HTTP server "error" event.
*/

function onError(error: any) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
* Event listener for HTTP server "listening" event.
*/

function onListening() {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr?.port;
  console.log(`Server started on ${bind}`);
}


server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
