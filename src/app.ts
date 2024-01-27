import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import searchRouter from './routes/search';
import heartBeatRouter from './routes/index';
config();
import { startCronerToSyncInstruments } from './utils/firebase/base';
import AngelLogin from './utils/angelOne/instance';

// setGlobalOptions({
//   maxInstances: 10,
//   region: 'asia-south1,
//   timeoutSeconds: 5
// });

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', heartBeatRouter);
app.use('/search', searchRouter);

// catch 404
app.use(function (req, res) {
  res.status(404).send({
    statusCode: 404,
    message: '🔥 Resource not found!'
  });
});

const PORT = process.env.PORT || '3001';

app.listen(PORT, () => {
  console.info(`🚀 Server is running on http://localhost:${PORT}`);
  // start daily instrument sync job
  startCronerToSyncInstruments();
  // create angel instance and login
  AngelLogin();
});
