import Firebase from "./instance";

type SearchProps = {
  searchTerm: string;
};

export const searchInFirestore = async (params: SearchProps) => {
  try {
    const { searchTerm } = params;
    const keywords = searchTerm.toUpperCase();
    const qry = Firebase.db.collection("instruments");
    let response;
    const allKeywords = keywords.split(" ");

    if (allKeywords.length > 1) {
      response = await qry
        .where(
          "rel_keywords",
          "array-contains-any",
          keywords.substring(allKeywords[0].length + 1).split(" ")
        )
        .orderBy("name")
        .startAt(allKeywords[0])
        .endAt(allKeywords[0] + "\uf8ff")
        .limit(10)
        .get();
    } else {
      response = await qry
        .orderBy("name")
        .startAt(allKeywords[0])
        .endAt(allKeywords[0] + "\uf8ff")
        .limit(10)
        .get();
    }

    if (response.empty) {
      return {
        status: "SUCCESS",
        statusCode: 200,
        data: [],
      };
    }
    const results: any = [];
    response.forEach((res: any) => {
      results.push(res.data());
    });
    return {
      status: "SUCCESS",
      statusCode: 200,
      data: results,
    };
  } catch (error) {
    console.log(error);
    let responseJSON;
    try {
      const jsonRes = JSON.parse(JSON.stringify(error));
      if (jsonRes.code === 8) {
        // daily quota exceeded in firestore;
        responseJSON = {
          status: "ERROR",
          statusCode: 503,
          message: "Service Unavailable",
          error: jsonRes,
        };
      } else {
        responseJSON = {
          status: "ERROR",
          statusCode: 500,
          message: "Internal Server Error",
          error: jsonRes,
        };
      }
    } catch (err) {
      responseJSON = {
        status: "ERROR",
        statusCode: 500,
        message: "Internal Server Error",
        error,
      };
    }
    return responseJSON;
  }
};
