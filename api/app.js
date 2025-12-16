import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import CryptoJS from 'crypto-js';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

// Helper to get body (JSON, Form, or Gzipped)
async function getBody(c) {
    let req = c.req.raw;
    const contentEncoding = c.req.header('content-encoding') || '';
    
    // Handle Gzip
    if (contentEncoding.toLowerCase().includes('gzip') && req.body) {
        try {
            const decompressedBody = req.body.pipeThrough(new DecompressionStream('gzip'));
            const newHeaders = new Headers(req.headers);
            newHeaders.delete('content-encoding');
            req = new Request(req, {
                body: decompressedBody,
                headers: newHeaders
            });
        } catch (e) {
            console.error('Gzip handling error:', e);
        }
    }

    const contentType = req.headers.get('content-type') || '';
    
    try {
        if (contentType.includes('application/json')) {
            return await req.json();
        } 
        
        if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            const obj = {};
            formData.forEach((value, key) => {
                if (obj[key]) {
                    if (Array.isArray(obj[key])) {
                        obj[key].push(value);
                    } else {
                        obj[key] = [obj[key], value];
                    }
                } else {
                    obj[key] = value;
                }
            });
            return obj;
        }

        // Fallback
        const text = await req.text();
        try {
            return JSON.parse(text);
        } catch {
            return {}; 
        }

    } catch (e) {
        console.error('Error parsing body:', e);
        return {};
    }
}

app.get('/health', (c) => {
    return c.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
    });
});

app.all('/', (c) => {
    return c.text('Hello World!');
});

app.post('/update', async (c) => {
    try {
        const body = await getBody(c);
        const { encrypted, uuid, crypto_type = 'legacy' } = body;
        if (!encrypted || !uuid) {
            console.warn('Bad Request: Missing required fields');
            return c.text('Bad Request', 400);
        }

        // Save to KV
        if (!c.env.COOKIE_DATA) {
             console.error('KV Namespace COOKIE_DATA not bound');
             return c.text('Internal Server Error: KV not configured', 500);
        }

        const content = JSON.stringify({
            encrypted: encrypted,
            crypto_type: crypto_type
        });

        // Use uuid as key
        await c.env.COOKIE_DATA.put(uuid, content);
        
        return c.json({ "action": "done" });

    } catch (error) {
        console.error('update error:', error);
        return c.text('Internal Serverless Error', 500);
    }
});

app.get('/get/:uuid', async (c) => {
    try {
        const uuid = c.req.param('uuid');
        const crypto_type_query = c.req.query('crypto_type');
        
        if (!uuid) {
            return c.text('Bad Request', 400);
        }

        if (!c.env.COOKIE_DATA) {
             console.error('KV Namespace COOKIE_DATA not bound');
             return c.text('Internal Server Error: KV not configured', 500);
        }

        const value = await c.env.COOKIE_DATA.get(uuid);
        if (!value) {
            return c.text('Not Found', 404);
        }

        const data = JSON.parse(value);
        if (!data) {
             return c.text('Internal Serverless Error', 500);
        }

        let body = {};
        if (c.req.method !== 'GET') {
             body = await getBody(c);
        } 
        if (c.req.method === 'GET' && c.req.header('content-type')) {
            body = await getBody(c);
        }

        if (body.password) {
            const useCryptoType = crypto_type_query || data.crypto_type || 'legacy';
            const parsed = cookie_decrypt(uuid, data.encrypted, body.password, useCryptoType);
            return c.json(parsed);
        } else {
            return c.json(data);
        }

    } catch (error) {
        console.error('get error:', error);
        return c.text('Internal Serverless Error', 500);
    }
});

// Original crypto functions
function cookie_decrypt( uuid, encrypted, password, crypto_type = 'legacy' )
{
    if (crypto_type === 'aes-128-cbc-fixed') {
        const hash = CryptoJS.MD5(uuid+'-'+password).toString();
        const the_key = hash.substring(0,16);
        const fixedIv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
        const options = {
            iv: fixedIv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        };
        const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Utf8.parse(the_key), options).toString(CryptoJS.enc.Utf8);
        const parsed = JSON.parse(decrypted);
        return parsed;
    } else {
        const the_key = CryptoJS.MD5(uuid+'-'+password).toString().substring(0,16);
        const decrypted = CryptoJS.AES.decrypt(encrypted, the_key).toString(CryptoJS.enc.Utf8);
        const parsed = JSON.parse(decrypted);
        return parsed;
    }
}

function cookie_encrypt( uuid, data, password, crypto_type = 'legacy' )
{
    const data_to_encrypt = JSON.stringify(data);
    
    if (crypto_type === 'aes-128-cbc-fixed') {
        const hash = CryptoJS.MD5(uuid+'-'+password).toString();
        const the_key = hash.substring(0,16);
        const fixedIv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
        const options = {
            iv: fixedIv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        };
        const encrypted = CryptoJS.AES.encrypt(data_to_encrypt, CryptoJS.enc.Utf8.parse(the_key), options);
        return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    } else {
        const the_key = CryptoJS.MD5(uuid+'-'+password).toString().substring(0,16);
        const encrypted = CryptoJS.AES.encrypt(data_to_encrypt, the_key).toString();
        return encrypted;
    }
}

export default app;
