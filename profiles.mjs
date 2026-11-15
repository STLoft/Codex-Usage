export const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const PROFILE = Symbol('codexUsageProfile');
const ownObject = value => value && typeof value === 'object' && !Array.isArray(value);

function endpoint(value) {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
        const host = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'loopback' : url.hostname;
        return `${url.protocol}//${host}:${url.port || (url.protocol === 'https:' ? '443' : '80')}${url.pathname.replace(/\/+$/, '')}`;
    } catch { return ''; }
}

export function mergeEffort(body, effort, yaml) {
    let parsed = {};
    if (String(body || '').trim()) {
        try { parsed = JSON.parse(body); }
        catch {
            if (!yaml?.parse) throw new Error('추론 설정을 전달하려면 SillyTavern의 YAML 기능이 필요합니다.');
            try { parsed = yaml.parse(body); } catch { throw new Error('Custom 추가 본문을 읽지 못했습니다. JSON 또는 YAML 형식을 확인하세요.'); }
        }
    }
    if (parsed == null) parsed = {};
    if (Array.isArray(parsed)) {
        if (!parsed.every(ownObject)) throw new Error('Custom 추가 본문은 객체 또는 객체 목록이어야 합니다.');
        parsed = Object.assign({}, ...parsed);
    }
    if (!ownObject(parsed)) throw new Error('Custom 추가 본문은 객체여야 합니다.');
    return JSON.stringify({ ...parsed, codex_bridge: { ...(ownObject(parsed.codex_bridge) ? parsed.codex_bridge : {}), effort } });
}

/** Stores only this extension's settings inside the user's native connection profile. */
export function createProfiles({ getContext, getConnection, activate }) {
    let apiUrl = 'http://127.0.0.1:7861/v1';
    const listeners = new Set();
    const all = () => getContext()?.extensionSettings?.disabledExtensions?.includes('connection-manager') ? [] : getContext()?.extensionSettings?.connectionManager?.profiles || [];
    const isCodex = profile => profile?.mode === 'cc' && profile.api === 'custom' && !!endpoint(apiUrl) && endpoint(profile['api-url']) === endpoint(apiUrl);
    const find = id => all().find(p => p.id === id && isCodex(p));
    const savedEffort = profile => profile?.codexUsage?.model === profile?.model && EFFORTS.includes(profile?.codexUsage?.effort) ? profile.codexUsage.effort : '';
    const manager = {
        setEndpoint(url) { if (endpoint(url)) apiUrl = url; },
        isCodex,
        savedEffort,
        notify() { for (const listener of listeners) listener(); },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        snapshot(fallback = 'medium') {
            const context = getContext(), connection = getConnection();
            const id = context?.extensionSettings?.connectionManager?.selectedProfile || '';
            const profile = find(id);
            const isCurrentCodex = connection?.main === 'openai' && connection?.source === 'custom' && endpoint(connection.url) === endpoint(apiUrl);
            const matches = !!profile && isCurrentCodex && profile.model === connection.model;
            return {
                profiles: all().filter(isCodex).map(p => ({ id: p.id, name: p.name || p.id, model: p.model || '', effort: savedEffort(p) })),
                id: profile?.id || '', name: profile?.name || '', model: profile?.model || '', effort: savedEffort(profile),
                current: { isCodex: isCurrentCodex, name: isCurrentCodex ? profile?.name || '' : '', model: isCurrentCodex ? connection.model || '' : '',
                    effort: (matches && savedEffort(profile)) || fallback, matches },
            };
        },
        async select(id) {
            const profile = find(id);
            if (!profile) throw new Error('Codex 연결 프로필을 선택하세요.');
            await activate(id);
            const state = manager.snapshot();
            if (state.id !== id || !state.current.matches) throw new Error('프로필 연결을 적용하지 못했습니다. SillyTavern API 화면에서 프로필을 확인하세요.');
            manager.notify();
        },
        save(id, effort, models = []) {
            const profile = find(id);
            if (!profile || getContext()?.extensionSettings?.connectionManager?.selectedProfile !== id) throw new Error('현재 선택한 Codex 연결 프로필을 확인하세요.');
            if (effort !== '' && !EFFORTS.includes(effort)) throw new Error('지원하지 않는 추론 단계입니다.');
            const supported = models.find(m => m.id === profile.model)?.efforts?.filter(v => EFFORTS.includes(v));
            if (effort && supported?.length && !supported.includes(effort)) throw new Error('이 모델이 지원하는 추론 단계를 선택하세요.');
            profile.codexUsage = { ...(ownObject(profile.codexUsage) ? profile.codexUsage : {}), model: profile.model, effort };
            getContext().saveSettingsDebounced();
            manager.notify();
        },
        inject(data, id, yaml) {
            if (data?.chat_completion_source !== 'custom' || endpoint(data.custom_url) !== endpoint(apiUrl)) return data;
            const profile = find(id), effort = savedEffort(profile);
            if (!effort || profile.model !== data.model) return data;
            return { ...data, custom_include_body: mergeEffort(data.custom_include_body, effort, yaml) };
        },
        activeId() { return getContext()?.extensionSettings?.connectionManager?.selectedProfile || ''; },
    };
    return manager;
}

/** Uses ST's native profile loader, including its completion event. */
export async function activateProfile(id, { eventSource, eventTypes, document: doc = document }) {
    const select = doc.getElementById('connection_profiles');
    if (!select || ![...select.options].some(o => o.value === id)) throw new Error('SillyTavern 연결 프로필 기능을 먼저 켜 주세요.');
    const event = eventTypes.CONNECTION_PROFILE_LOADED;
    if (!event) throw new Error('현재 SillyTavern에서 프로필 전환 이벤트를 지원하지 않습니다.');
    await new Promise((resolve, reject) => {
        const off = () => (eventSource.removeListener || eventSource.off)?.call(eventSource, event, done);
        const done = () => { clearTimeout(timer); off(); resolve(); };
        const timer = setTimeout(() => { off(); reject(new Error('연결 프로필 전환 시간이 초과되었습니다.')); }, 15000);
        eventSource.on(event, done);
        select.value = id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

/** Attach profile settings to ordinary chat and explicit Connection Manager requests. */
export function installProfileRequests({ profiles, eventSource, eventTypes, connectionService, chatService, yaml = () => null }) {
    const subscriptions = [];
    const on = (name, handler) => { if (name) { eventSource.on(name, handler); subscriptions.push([name, handler]); } };
    on(eventTypes.CHAT_COMPLETION_SETTINGS_READY, data => { if (data && typeof data === 'object') Object.assign(data, profiles.inject(data, profiles.activeId(), yaml())); });
    for (const name of ['CONNECTION_PROFILE_LOADED', 'CONNECTION_PROFILE_UPDATED', 'CONNECTION_PROFILE_CREATED', 'CONNECTION_PROFILE_DELETED', 'APP_READY']) {
        on(eventTypes[name], () => profiles.notify());
    }
    const originalConnection = connectionService?.sendRequest;
    const originalChat = chatService?.sendRequest;
    let wrappedConnection, wrappedChat;
    if (typeof originalConnection === 'function' && typeof originalChat === 'function') {
        // A symbol survives ST's object spreads without being sent in JSON. It identifies
        // the explicitly requested profile even when another profile is active on screen.
        wrappedConnection = function (id, prompt, maxTokens, custom, overrides = {}) {
            return originalConnection.call(this, id, prompt, maxTokens, custom, { ...overrides, [PROFILE]: id });
        };
        wrappedChat = function (data, ...rest) {
            if (Object.hasOwn(data, PROFILE)) {
                const id = data[PROFILE]; data = { ...data }; delete data[PROFILE];
                data = profiles.inject(data, id, yaml());
            }
            return originalChat.call(this, data, ...rest);
        };
        connectionService.sendRequest = wrappedConnection; chatService.sendRequest = wrappedChat;
    }
    return () => {
        for (const [name, handler] of subscriptions) (eventSource.removeListener || eventSource.off)?.call(eventSource, name, handler);
        if (connectionService?.sendRequest === wrappedConnection) connectionService.sendRequest = originalConnection;
        if (chatService?.sendRequest === wrappedChat) chatService.sendRequest = originalChat;
    };
}
