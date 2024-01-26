import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import searchRouter from './routes/search';
config();
import { startCronerToSyncInstruments } from './utils/firebase/base';
import AngelLogin from './utils/angelOne/instance';
import { onRequest } from 'firebase-functions/v2/https';
import { logger, setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({
  maxInstances: 10,
  region: 'asia-east2',
  timeoutSeconds: 5
});

const app = express();

app.use(cors());
app.use(express.json());

app.use('/search', searchRouter);

// catch 404
app.use(function (req, res) {
  res.status(404).send({
    statusCode: 404,
    message: '🔥 Resource not found!'
  });
});

app.listen('3001', () => {
  logger.info(`🚀 Server is running on http://localhost:3001`);
  // start daily instrument sync job
  startCronerToSyncInstruments();
  // create angel instance and login
  AngelLogin();
});

exports.api = onRequest(app);
