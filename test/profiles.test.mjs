import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createProfiles, mergeEffort, installProfileRequests } from '../profiles.mjs';

const url = 'http://127.0.0.1:7861/v1';
function setup() {
    let writes = 0;
    const a = { id: 'a', name: '일상 대화', mode: 'cc', api: 'custom', 'api-url': url, model: 'same-model', preset: 'shared', 'secret-id': 'untouched' };
    const b = { ...a, id: 'b', name: '긴 서사' };
    const other = { ...a, id: 'other', name: '다른 연결', 'api-url': 'https://example.com/v1' };
    const context = { extensionSettings: { connectionManager: { profiles: [a, b, other], selectedProfile: 'a' } }, saveSettingsDebounced() { writes++; } };
    const connection = { main: 'openai', source: 'custom', url, model: a.model };
    const profiles = createProfiles({ getContext: () => context, getConnection: () => connection,
        async activate(id) { context.extensionSettings.connectionManager.selectedProfile = id; connection.model = context.extensionSettings.connectionManager.profiles.find(p => p.id === id).model; } });
    return { profiles, context, connection, a, b, other, writes: () => writes };
}

test('same model and preset can have separate efforts; rename, reload and default fallback', async () => {
    const s = setup(), original = JSON.stringify(s.a);
    s.profiles.save('a', 'high'); await s.profiles.select('b'); s.profiles.save('b', 'low');
    assert.equal(s.a.codexUsage.effort, 'high'); assert.equal(s.b.codexUsage.effort, 'low');
    assert.equal(s.profiles.snapshot().current.effort, 'low');
    s.a.name = '새 이름'; await s.profiles.select('a');
    assert.equal(s.profiles.snapshot().current.name, '새 이름'); assert.equal(s.profiles.snapshot().current.effort, 'high');
    const reloaded = JSON.parse(JSON.stringify(s.context.extensionSettings));
    s.context.extensionSettings = reloaded;
    assert.equal(s.profiles.snapshot().current.effort, 'high');
    s.profiles.save('a', ''); assert.equal(s.profiles.snapshot('medium').current.effort, 'medium');
    const restored = { ...s.a }; delete restored.codexUsage; restored.name = '일상 대화';
    assert.equal(JSON.stringify(restored), original); assert.equal(s.writes(), 3);
});

test('only matching Codex profiles are offered; changed model and other API do not inherit effort', () => {
    const s = setup(); s.profiles.save('a', 'high');
    assert.deepEqual(s.profiles.snapshot().profiles.map(p => p.id), ['a', 'b']);
    s.a.model = 'new-model'; s.connection.model = 'new-model';
    assert.equal(s.profiles.snapshot().effort, ''); assert.equal(s.profiles.snapshot().current.effort, 'medium');
    assert.equal(s.profiles.inject({ chat_completion_source: 'custom', custom_url: url, model: 'new-model' }, 'a').custom_include_body, undefined);
    s.connection.main = 'textgenerationwebui'; assert.equal(s.profiles.snapshot().current.isCodex, false);
    s.context.extensionSettings.disabledExtensions = ['connection-manager']; assert.deepEqual(s.profiles.snapshot().profiles, []);
});

test('save rejects wrong profile and unsupported model effort without changing settings', () => {
    const s = setup();
    assert.throws(() => s.profiles.save('b', 'high'), /현재 선택/);
    assert.throws(() => s.profiles.save('a', 'ultra'), /지원하지/);
    assert.throws(() => s.profiles.save('a', 'high', [{ id: 'same-model', efforts: ['low'] }]), /이 모델/);
    assert.equal(s.writes(), 0); assert.equal(s.a.codexUsage, undefined);
    s.profiles.save('a', 'none', [{ id: 'same-model', efforts: ['none', 'low'] }]);
    assert.equal(s.a.codexUsage.effort, 'none');
});

test('request merge preserves JSON and YAML mappings, list bodies and unrelated fields', () => {
    const yaml = { parse(text) { assert.equal(text, 'top_k: 20 # comment'); return { top_k: 20, nested: { keep: true } }; } };
    assert.deepEqual(JSON.parse(mergeEffort('{"top_k":20,"codex_bridge":{"keep":true}}', 'low')), { top_k: 20, codex_bridge: { keep: true, effort: 'low' } });
    assert.deepEqual(JSON.parse(mergeEffort('top_k: 20 # comment', 'high', yaml)), { top_k: 20, nested: { keep: true }, codex_bridge: { effort: 'high' } });
    assert.deepEqual(JSON.parse(mergeEffort('[{"top_k":20},{"keep":true}]', 'medium')), { top_k: 20, keep: true, codex_bridge: { effort: 'medium' } });
    assert.throws(() => mergeEffort('[1]', 'low'), /객체/);
    assert.throws(() => mergeEffort('bad:', 'low', { parse() { throw new Error(); } }), /읽지/);
});

test('normal chat and concurrent background requests use their own profiles, preserving payload and wrappers', async () => {
    const s = setup(); s.profiles.save('a', 'high'); await s.profiles.select('b'); s.profiles.save('b', 'low');
    const events = new EventEmitter(), types = { CHAT_COMPLETION_SETTINGS_READY: 'settings', CONNECTION_PROFILE_LOADED: 'loaded' };
    const sent = [], chatService = { async sendRequest(data) { sent.push(data); return data; } };
    const connectionService = { async sendRequest(id, prompt, maxTokens, custom, overrides) {
        await new Promise(r => setTimeout(r, id === 'a' ? 15 : 1));
        const profile = s.context.extensionSettings.connectionManager.profiles.find(p => p.id === id);
        return chatService.sendRequest({ chat_completion_source: 'custom', custom_url: profile['api-url'], model: profile.model, custom_include_body: '{"keep":true}', ...overrides });
    } };
    const originalConnection = connectionService.sendRequest, originalChat = chatService.sendRequest;
    const dispose = installProfileRequests({ profiles: s.profiles, eventSource: events, eventTypes: types, connectionService, chatService });
    const normal = { chat_completion_source: 'custom', custom_url: url, model: 'same-model', custom_include_body: '{"keep":true}' };
    events.emit('settings', normal); assert.equal(JSON.parse(normal.custom_include_body).codex_bridge.effort, 'low');
    const [a, b, other] = await Promise.all(['a', 'b', 'other'].map(id => connectionService.sendRequest(id, '', 10)));
    assert.equal(JSON.parse(a.custom_include_body).codex_bridge.effort, 'high');
    assert.equal(JSON.parse(b.custom_include_body).codex_bridge.effort, 'low');
    assert.equal(other.custom_include_body, '{"keep":true}');
    assert.ok(sent.every(x => Object.getOwnPropertySymbols(x).length === 0));
    assert.ok(sent.every(x => JSON.parse(x.custom_include_body).keep));
    dispose(); assert.equal(connectionService.sendRequest, originalConnection); assert.equal(chatService.sendRequest, originalChat);
    assert.equal(events.listenerCount('settings'), 0);
});
