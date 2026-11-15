import { getRequestHeaders, eventSource, event_types } from '../../../../script.js';
import { getContext } from '../../../extensions.js';
import { oai_settings } from '../../../openai.js';
import { ConnectionManagerRequestService } from '../../shared.js';
import { ChatCompletionService } from '../../../custom-request.js';
import { mount } from './panel.mjs';
import { connect } from './connection.mjs';
import { createProfiles, activateProfile, installProfileRequests } from './profiles.mjs';

async function api(endpoint, body) {
    const res = await fetch('/api/plugins/codex-bridge' + endpoint, {
        method: body ? 'POST' : 'GET', headers: getRequestHeaders(), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data; try { data = await res.json(); } catch { throw new Error('Codex Bridge 서버 플러그인을 설치하고 SillyTavern을 재시작하세요.'); }
    if (!res.ok || data.ok === false) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || `요청 실패 (${res.status})`);
    return data;
}
if (!document.getElementById('codex-usage-drawer')) {
    const profiles = createProfiles({ getContext,
        getConnection: () => ({ main: getContext().mainApi, source: oai_settings.chat_completion_source, url: oai_settings.custom_url, model: oai_settings.custom_model }),
        activate: id => activateProfile(id, { eventSource, eventTypes: event_types }),
    });
    installProfileRequests({ profiles, eventSource, eventTypes: event_types, connectionService: ConnectionManagerRequestService,
        chatService: ChatCompletionService, yaml: () => globalThis.SillyTavern?.libs?.yaml });
    mount({ api, connect, profiles });
}
