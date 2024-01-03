import { Router } from 'express';
import { searchTerm } from '../utils/angelOne/instance';

const router = Router();

router.post('/', async (req, res) => {
    const { searchText, exchange } = req.body;
    if (searchText?.length > 2) {
        const result = await searchTerm(searchText?.toUpperCase(), exchange?.toUpperCase());
        console.log(result);
        if (result?.status) {
            return res.status(result.statusCode || 200).json({
                status: result.status ? result?.message : "ERROR",
                statusCode: result.statusCode || 200,
                data: result.data
            });
        } else {
            return res.status(200).json({
                status: "SUCCESS",
                statusCode: 200,
                data: result
            });
        }
    } else {
        return res.status(200).json({
            status: "SUCCESS",
            statusCode: 200,
            data: []
        });
    }
});

export default router;