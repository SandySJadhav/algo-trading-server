import Firebase from "./instance";

type SearchProps = {
    searchTerm?: string;
};

export const searchInFirestore = async (params: SearchProps) => {
    const { searchTerm } = params;
    let collection: any = await Firebase.db.collection("instruments").get();
    if (searchTerm) {
        collection = collection.where('symbol', '>=', searchTerm);
    }
    const response = await collection.limit(10).get();
    if (response.empty) {
        return [];
    }
    const results: any = [];
    response.forEach((res: any) => {
        results.pop(res.data());
    });
    return results;
};