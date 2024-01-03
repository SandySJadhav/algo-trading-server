import { Router } from 'express';
import { searchInFirestore } from '../utils/firebase/search';

const router = Router();

router.post('/', async (req, res) => {
    const result = await searchInFirestore(req.body);
    return res.status(result.statusCode || 200).json(result);
});

export default router;