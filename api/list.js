export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const CLOUD_NAME = process.env.CLOUD_NAME;
    const API_KEY = process.env.API_KEY;
    const API_SECRET = process.env.API_SECRET;

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
        return res.status(500).json({ error: 'Missing env vars' });
    }

    const action = req.query.action;
    const crypto = await import('crypto');

    function sha1(str) {
        return crypto.createHash('sha1').update(str).digest('hex');
    }
    function signParams(params, secret) {
        const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
        return sha1(sorted + secret);
    }

    try {
        if (action === 'list') {
            const type = req.query.type || 'image';
            const cursor = req.query.next_cursor;
            const timestamp = Math.floor(Date.now() / 1000);
            const params = { max_results: 500, timestamp };
            if (cursor) params.next_cursor = cursor;
            const signature = signParams(params, API_SECRET);
            const query = new URLSearchParams({ ...params, api_key: API_KEY, signature });
            const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${type}/upload?${query}`;
            const r = await fetch(url);
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        if (action === 'delete') {
            const { public_id, type } = req.body;
            if (!public_id || !type) return res.status(400).json({ error: 'Missing public_id or type' });
            const timestamp = Math.floor(Date.now() / 1000);
            const params = { public_id, timestamp };
            const signature = signParams(params, API_SECRET);
            const body = new URLSearchParams({
                public_id, timestamp: String(timestamp), api_key: API_KEY, signature
            });
            const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${type}/upload`;
            const r = await fetch(url, { method: 'DELETE', body });
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        if (action === 'usage') {
            const timestamp = Math.floor(Date.now() / 1000);
            const params = { timestamp };
            const signature = signParams(params, API_SECRET);
            const query = new URLSearchParams({ ...params, api_key: API_KEY, signature });
            const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/usage?${query}`;
            const r = await fetch(url);
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
