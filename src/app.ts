import express from 'express';
import createHttpError from 'http-errors';
import searchRouter from './routes/search';
import cors from 'cors';

const app = express();
const corsOpts = {
  origin: 'http://localhost:3000',
  methods: [
    'GET',
    'POST',
    'DELETE',
    'PUT'
  ]
};
app.use(cors(corsOpts))
app.use(express.json());

app.use('/search', searchRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createHttpError(404));
});

export default app;