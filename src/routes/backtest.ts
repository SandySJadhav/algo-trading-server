import { Router } from 'express';
import { backtest } from '../utils/angelOne/instance';

const router = Router();

router.get('/', async (req, res) => {
  const result = await backtest();
  return res.status(200).json({
    statusCode: 200,
    data: result
  });
});

export default router;
