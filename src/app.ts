import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
config();
import { startCronerToSyncInstruments } from './utils/firebase/base';
import heartBeatRouter from './routes/index';
import AngelLogin, { forceKillOrders } from './utils/angelOne/instance';

// region: 'asia-south1,
const PORT = process.env.PORT || '3001';
const app = express();

app.use(cors());
app.use(express.json());

app.use('/', heartBeatRouter);

// catch 404
app.use(function (req, res) {
  res.status(404).send({
    statusCode: 404,
    message: '🔥 Resource not found!'
  });
});

const server = app.listen(PORT, () => {
  console.info(`🚀 Server is running on http://localhost:${PORT}`);
  // start daily instrument sync job
  startCronerToSyncInstruments();
  // create angel instance and login
  AngelLogin();
});

const shutDown = () => {
  forceKillOrders();
  server.close(() => {
    console.log('🚀 Server closed ***********');
    process.exit(0);
  });
};

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
