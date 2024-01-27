import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  return res.status(202).json({
    statusCode: 202,
    message: 'Heartbeat!'
  });
});

export default router;
