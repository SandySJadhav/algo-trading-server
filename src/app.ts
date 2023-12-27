import express from 'express';
import createHttpError from 'http-errors';
import userRouter from './routes/user';

const app = express();
app.use(express.json());

app.use('/user', userRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createHttpError(404));
});

export default app;