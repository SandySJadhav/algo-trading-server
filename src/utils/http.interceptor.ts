import cache from './cache';
import fetch from './fetch';

export const postRequest = async (url: string, body?: object, headers?: object) => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: body ? JSON.stringify(body) : null,
            headers: headers ?? {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cache.get(`ant-user-session`)}`
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.log('API RESPONSE ERROR -> url ', error);
        return error;
    }
};