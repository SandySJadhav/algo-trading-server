import Firebase from "./instance";

type SearchProps = {
    searchTerm?: string;
};

export const searchInFirestore = async (params: SearchProps) => {
    try {
        const { searchTerm } = params;
        let collection: any = await Firebase.db.collection("instruments");
        if (searchTerm) {
            collection = collection.where('symbol', '>=', searchTerm.toUpperCase());
        }
        const response = await collection.limit(10).get();
        if (response.empty) {
            return {
                status: "SUCCESS",
                statusCode: 200,
                data: []
            };
        }
        const results: any = [];
        response.forEach((res: any) => {
            results.push(res.data());
        });
        return {
            status: "SUCCESS",
            statusCode: 200,
            data: results
        };
    } catch (error) {
        let responseJSON;
        try {
            const jsonRes = JSON.parse(JSON.stringify(error));
            if (jsonRes.code === 8) {
                // daily quota exceeded in firestore;
                responseJSON = {
                    status: "ERROR",
                    statusCode: 503,
                    message: "Service Unavailable",
                    error: jsonRes
                };
            } else {
                responseJSON = {
                    status: "ERROR",
                    statusCode: 500,
                    message: "Internal Server Error",
                    error: jsonRes
                };
            }
        } catch (err) {
            responseJSON = {
                status: "ERROR",
                statusCode: 500,
                message: "Internal Server Error",
                error
            };
        }
        return responseJSON;
    }
};