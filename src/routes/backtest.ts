import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  return res.status(200).json({
    statusCode: 200,
    message: 'Heartbeat!'
  });
});

export default router;
