import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
config();
import { startCronerToSyncInstruments } from './utils/firebase/base';
import AngelLogin from './utils/angelOne/instance';

// region: 'asia-south1,

const app = express();

app.use(cors());
app.use(express.json());

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
