import fetch from "./fetch";

export const postRequest = async (
  url: string,
  body?: object,
  headers?: object
) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : null,
      headers: headers ?? {
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return {
      statusCode: response.status,
      status: response.statusText,
    };
  } catch (error) {
    console.log("🚀 API RESPONSE ERROR -> url ", error);
    return error;
  }
};
