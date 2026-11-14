import { getRequestHeaders } from '../../../../script.js';
import { mount } from './panel.mjs';
import { connect } from './connection.mjs';

async function api(endpoint, body) {
    const res = await fetch('/api/plugins/codex-bridge' + endpoint, {
        method: body ? 'POST' : 'GET', headers: getRequestHeaders(), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data; try { data = await res.json(); } catch { throw new Error('Codex Bridge 서버 플러그인을 설치하고 SillyTavern을 재시작하세요.'); }
    if (!res.ok || data.ok === false) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || `요청 실패 (${res.status})`);
    return data;
}
if (!document.getElementById('codex-usage-drawer')) mount({ api, connect });
