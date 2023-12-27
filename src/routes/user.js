import { Router } from 'express';
import cache from '../utils/cache';
const router = Router();

router.get('/:id', function (req, res, next) {
    const { id } = req.params;
    return res.status(200).json({
        status: "SUCCESS",
        statusCode: 200,
        message: "Session fetched",
        data: cache.get(id)
    });
});

router.post('/:id', function (req, res, next) {
    const { id, token } = req.params;
    cache.set(id, token);
    return res.status(200).json({
        status: "SUCCESS",
        statusCode: 200,
        message: "Session updated"
    });
});

export default router;
