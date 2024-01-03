import { Router } from 'express';
import { searchInFirestore } from '../utils/firebase/search';

const router = Router();

router.post('/', async (req, res) => {
    const result = await searchInFirestore(req.body);
    console.log(result);
    // if (result?.status) {
    //     return res.status(result.statusCode || 200).json({
    //         status: result.status ? result?.message : "ERROR",
    //         statusCode: result.statusCode || 200,
    //         data: result.data
    //     });
    // } else {
    //     return res.status(200).json({
    //         status: "SUCCESS",
    //         statusCode: 200,
    //         data: result
    //     });
    // }
});

export default router;