const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = value => Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—';
const when = value => value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const VERSION = '0.1.0';
export function limitPools(limits) {
    const values = Object.values(limits?.rateLimitsByLimitId || {});
    return values.length ? values : limits?.rateLimits ? [limits.rateLimits] : [];
}
function period(mins, fallback) {
    if (!Number.isFinite(mins)) return fallback;
    if (mins === 10080) return '주간 (7일)';
    if (mins % 1440 === 0) return `${mins / 1440}일`;
    if (mins % 60 === 0) return `${mins / 60}시간`;
    return `${mins}분`;
}
function remaining(window) { return typeof window?.usedPercent === 'number' && Number.isFinite(window.usedPercent) ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null; }
function meter(window, label) {
    const value = remaining(window);
    return `<div class="cx-meter"><div class="cx-row"><span>${esc(period(window?.windowDurationMins, label))}</span><strong>${value == null ? (window ? '조회 불가' : '미제공') : `${fmt(Math.round(value))}% 남음`}</strong></div><div class="cx-track"><span style="width:${value ?? 0}%;background:${value != null && value <= 15 ? 'var(--cx-danger)' : 'var(--cx-accent)'}"></span></div><small>${window?.resetsAt ? `${esc(when(window.resetsAt * 1000))} 리셋` : '리셋 시각 미제공'}</small></div>`;
}
export function mount({ api, connect, target = document.body }) {
    const state = { status: null, usage: null, models: [], error: '', busy: false, modelsBusy: false, modelsError: '', modelsUpdatedAt: null, selected: null, effort: '', updated: null, stale: false };
    let floatingEnabled = true;
    try { floatingEnabled = localStorage.getItem('codex-usage-floating') !== 'false'; } catch { /* storage disabled */ }
    const launcher = document.createElement('button'); launcher.id = 'codex-usage-launcher'; launcher.className = 'menu_button'; launcher.textContent = 'Codex Bridge · 사용량';
    const host = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings') || target;
    host.append(launcher);
    const menu = document.createElement('button'); menu.className = 'list-group-item flex-container flexGap5 interactable'; menu.innerHTML = '<i class="fa-solid fa-gauge" aria-hidden="true"></i><span>Codex 사용량</span>';
    document.querySelector('#extensionsMenu')?.append(menu);
    const dialog = document.createElement('dialog'); dialog.className = 'cx-dialog'; dialog.setAttribute('aria-label', 'Codex Bridge 사용량');
    dialog.innerHTML = '<header class="cx-header"><div><small>CODEX CLI</small><h2>Codex Bridge <span>사용량</span></h2></div><button class="cx-close menu_button" aria-label="닫기">✕</button></header><div class="cx-content"></div>';
    target.append(dialog);
    const content = dialog.querySelector('.cx-content');
    const floating = document.createElement('div'); floating.id = 'codex-usage-floating'; floating.innerHTML = '<span class="cx-drag" title="끌어서 이동" aria-hidden="true">⠿</span><button aria-label="Codex 잔량 보기">Codex · 조회 전</button>';
    floating.hidden = !floatingEnabled; target.append(floating);
    try { const pos = JSON.parse(localStorage.getItem('codex-usage-position')); if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        floating.style.left = Math.max(0, Math.min(pos.x, innerWidth - 170)) + 'px'; floating.style.top = Math.max(0, Math.min(pos.y, innerHeight - 50)) + 'px'; floating.style.right = 'auto'; floating.style.bottom = 'auto';
    } } catch { /* initial position */ }
    function draw() {
        const { status: s, usage: u } = state;
        const pools = limitPools(s?.limits);
        const first = pools[0];
        const main = remaining(first?.primary), second = remaining(first?.secondary);
        floating.querySelector('button').textContent = state.stale || s?.error || s?.quotaError ? 'Codex · 잔량 조회 불가' : s?.available ? `Codex · 5h ${main == null ? '미제공' : `${fmt(Math.round(main))}%`} · 주간 ${second == null ? '미제공' : `${fmt(Math.round(second))}%`}` : 'Codex · 연결 확인';
        const unknown = u?.all?.unknown;
        content.innerHTML = `
        <div class="cx-row cx-status"><span class="cx-pill ${s?.loggedIn ? 'cx-good' : ''}">${s?.loggedIn ? 'ChatGPT / CLI 연결됨' : s?.available ? '로그인 필요' : '연결 확인 필요'}</span><button data-action="refresh" class="menu_button" ${state.busy ? 'disabled' : ''}>${state.busy ? '새로고침 중…' : '새로고침'}</button></div>
        ${state.error || s?.error ? `<div role="alert" class="cx-error">${esc(state.error || s.error)}</div>` : ''}
        ${s?.versionBridge && s.versionBridge !== VERSION ? `<div class="cx-error">화면 v${VERSION} · 서버 v${esc(s.versionBridge)} — 같은 배포본으로 업데이트하세요.</div>` : ''}
        <section><div class="cx-section-label"><h3>계정 잔량</h3><span>${esc(s?.planType || 'ChatGPT 로그인')}</span></div>
        <p class="cx-muted">같은 계정의 Codex 사용량이 함께 반영됩니다.</p>
        <div class="cx-pools">${pools.length ? pools.map(p => `<article class="cx-card"><h4>${esc(p.limitName || p.limitId || 'Codex')}</h4>${meter(p.primary, '5시간')}${meter(p.secondary, '주간 (7일)')}</article>`).join('') : `<article class="cx-card cx-empty">${meter(null, '5시간')}${meter(null, '주간 (7일)')}<p>${esc(s?.quotaError || (s?.checkedAt ? 'CLI가 잔량을 제공하지 않았습니다.' : '새로고침하면 CLI의 공식 잔량을 조회합니다.'))}</p></article>`}</div>
        <small class="cx-muted">${s?.checkedAt ? `${state.stale ? '조회 실패 · 아래는 마지막 성공 값 · ' : ''}조회 ${esc(when(s.checkedAt))} · 최대 30초 캐시` : '조회 전'}</small></section>
        <section><div class="cx-section-label"><h3>이 브리지의 토큰</h3><span>입력 + 출력</span></div>
        <div class="cx-stats">${[['5시간', u?.fiveHours], ['7일', u?.sevenDays], ['전체', u?.all]].map(([label, v]) => `<article class="cx-card"><small>${label}</small><strong>${v?.requests > 0 && v.unknown === v.requests ? '미제공' : fmt(v?.tokens)}</strong><span>${fmt(v?.requests)}회${v?.unknown ? ` · ${v.unknown}회 토큰 미제공` : ''}</span></article>`).join('')}</div>
        <p class="cx-muted">5시간·7일 합계는 보관된 최근 ${fmt(u?.retained)}건 기준입니다. 전체 누적은 설치 후 계속 보관합니다.${unknown ? ' 토큰 미제공 요청은 합계에서 제외합니다.' : ''}</p></section>
        <section class="cx-model-section"><div class="cx-section-label"><h3>사용 가능한 모델</h3><button data-action="models" class="menu_button" ${state.modelsBusy ? 'disabled' : ''}>${state.modelsBusy ? '모델 조회 중…' : '모델 새로고침'}</button></div>
        <p class="cx-muted">서버 시작 시 한 번 자동 조회 · 이후 버튼으로만 갱신합니다. 모델을 눌러 선택한 뒤 대화 연결에 입력하세요.</p>
        ${state.modelsError ? `<div role="alert" class="cx-error">모델 조회 실패: ${esc(state.modelsError)}${state.models.length ? ' · 마지막 목록을 유지합니다.' : ''}</div>` : ''}
        <div class="cx-model-list">${state.models.length ? state.models.map(m => `<button type="button" class="cx-model-card" data-model="${esc(m.id)}" aria-pressed="${m.id === selectedModel()}"><span>${esc(m.name)}</span><small>${esc(m.id)}${m.isDefault ? ' · CLI 기본' : ''}</small></button>`).join('') : '<p class="cx-muted">아직 모델 목록이 없습니다. CLI 로그인 후 모델 새로고침을 누르거나 모델 ID를 직접 입력하세요.</p>'}</div>
        <small class="cx-muted">${state.modelsUpdatedAt ? `목록 조회 ${esc(when(state.modelsUpdatedAt))}` : '목록 조회 전'} · CLI 목록이며 실제 계정의 모델 접근은 대화 시 확인됩니다.</small>
        ${selectedModel() && !state.models.some(m => m.id === selectedModel()) ? `<p class="cx-muted">선택 유지: ${esc(selectedModel())} (현재 목록에 없음)</p>` : ''}
        </section>
        <details class="cx-details" data-section="connection" open><summary>대화 연결 · 추론 설정</summary><div class="cx-details-body">
        <p>Chat Completion → Custom (OpenAI-compatible)</p><label>서버 주소<input readonly value="${esc(s?.apiUrl || '')}" aria-label="서버 주소"></label>
        <label>선택 모델 · 직접 입력<input id="cx-custom-model" value="${esc(selectedModel())}" placeholder="위 목록에서 선택하거나 모델 ID 입력" autocomplete="off"></label>
        <label>추론 단계<select id="cx-effort">${efforts().map(v => `<option ${v === (state.effort || s?.settings?.effort || 'medium') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <div class="cx-actions"><button data-action="connect" class="menu_button" ${!s?.apiUrl ? 'disabled' : ''}>대화 연결에 입력</button><button data-action="save" class="menu_button" ${!s?.canManage ? 'disabled' : ''}>모델·추론 설정 저장</button></div>
        <p class="cx-muted">API Key는 비워 두고 API 화면에서 [연결]을 누르세요. 프리셋·캐릭터·로어북은 SillyTavern 설정을 사용합니다.</p>
        <p class="cx-muted">Temperature·Top-p는 적용되지 않습니다. 최대 토큰은 길이 안내이며 강제 제한이 아닙니다.</p>
        <p class="cx-muted">처음 로그인: SillyTavern 서버 터미널에서 <code>codex login</code> → <code>codex login status</code>. ${esc(s?.version || '')} · ${esc(s?.transport || '')}</p>
        </div></details>
        <details class="cx-details" data-section="history"><summary>요청별 토큰 기록</summary><div class="cx-details-body"><p class="cx-muted">최근 200건 · 생각 토큰은 출력에, 캐시 토큰은 입력에 포함됩니다. 프롬프트와 대화 원문은 기록하지 않습니다.</p><div class="cx-table-wrap"><table><thead><tr><th>시각 / 모델</th><th>입력</th><th>캐시</th><th>출력</th><th>생각</th><th>상태</th></tr></thead><tbody>${u?.records?.length ? u.records.map(r => `<tr><td>${esc(when(r.at))}<small>${esc(r.model)}</small></td><td>${fmt(r.usage?.prompt_tokens)}</td><td>${fmt(r.usage?.prompt_tokens_details?.cached_tokens)}</td><td>${fmt(r.usage?.completion_tokens)}</td><td>${fmt(r.usage?.completion_tokens_details?.reasoning_tokens)}</td><td>${esc({ completed: '완료', failed: '실패', cancelled: '취소' }[r.state] || r.state)}</td></tr>`).join('') : '<tr><td colspan="6" class="cx-empty">아직 대화 기록이 없습니다.</td></tr>'}</tbody></table></div></div></details>
        <footer class="cx-footer"><label class="cx-check"><input id="cx-floating" type="checkbox" ${floatingEnabled ? 'checked' : ''}>플로팅 잔량</label><small>확장 v${VERSION} · 서버 v${esc(s?.versionBridge || '—')}</small></footer>`;
    }
    function selectedModel() { return state.selected ?? state.status?.settings?.defaultModel ?? ''; }
    function efforts() {
        const model = state.models.find(m => m.id === selectedModel());
        const values = model?.efforts?.length ? model.efforts : ['low', 'medium', 'high'];
        return [...new Set([...values, state.effort || state.status?.settings?.effort || 'medium'])];
    }
    function renderPreservingDetails() {
        const details = [...content.querySelectorAll('details')].map(d => [d.dataset.section, d.open]);
        const focused = content.contains(document.activeElement) ? document.activeElement.id : '';
        const range = focused === 'cx-custom-model' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
        const scroll = content.scrollTop; draw();
        for (const [section, open] of details) { const el = content.querySelector(`details[data-section="${section}"]`); if (el) el.open = open; }
        if (focused) { const el = content.querySelector(`#${focused}`); el?.focus({ preventScroll: true }); if (range) el?.setSelectionRange(...range); }
        content.scrollTop = scroll;
    }
    async function refresh(force = false) {
        if (state.busy) return;
        state.busy = true; renderPreservingDetails();
        try {
            const [status, usage] = await Promise.all([api('/status' + (force ? '?refresh=1' : '')), api('/usage')]);
            state.status = status; state.usage = usage; state.error = ''; state.updated = Date.now(); state.stale = false;
        } catch (e) { state.error = e.message; state.stale = true; }
        finally { state.busy = false; renderPreservingDetails(); }
    }
    async function loadModels(force = false) {
        if (state.modelsBusy) return;
        state.modelsBusy = true; renderPreservingDetails();
        try {
            const data = await api(force ? '/models/refresh' : '/models', force ? {} : undefined);
            state.models = data.models; state.modelsError = data.modelsError || ''; state.modelsUpdatedAt = data.modelsUpdatedAt;
        } catch (e) { state.modelsError = e.message; }
        finally { state.modelsBusy = false; renderPreservingDetails(); }
    }
    async function open() { if (!dialog.open) dialog.showModal(); await Promise.all([refresh(), loadModels()]); }
    for (const el of [launcher, menu, floating.querySelector('button')]) el.addEventListener('click', open);
    dialog.querySelector('.cx-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    content.addEventListener('change', event => {
        if (event.target.id === 'cx-effort') state.effort = event.target.value;
        if (event.target.id === 'cx-floating') { floatingEnabled = event.target.checked; floating.hidden = !floatingEnabled; try { localStorage.setItem('codex-usage-floating', String(floatingEnabled)); } catch { /* optional */ } }
    });
    content.addEventListener('input', event => { if (event.target.id === 'cx-custom-model') state.selected = event.target.value; });
    content.addEventListener('click', async event => {
        const modelButton = event.target.closest('[data-model]');
        if (modelButton) {
            state.selected = modelButton.dataset.model;
            const model = state.models.find(m => m.id === state.selected);
            if (!model?.efforts?.includes(state.effort || state.status?.settings?.effort || 'medium')) state.effort = model?.defaultEffort || model?.efforts?.[0] || 'medium';
            renderPreservingDetails(); return;
        }
        const button = event.target.closest('[data-action]'); if (!button) return;
        try {
            const action = button.dataset.action;
            if (action === 'refresh') return await refresh(true);
            if (action === 'models') return await loadModels(true);
            const model = content.querySelector('#cx-custom-model').value.trim();
            if (!model) throw new Error('모델을 선택하거나 모델 ID를 입력하세요.');
            if (action === 'connect') { connect(state.status.apiUrl, model); dialog.close(); }
            if (action === 'save') { await api('/settings', { defaultModel: model, effort: content.querySelector('#cx-effort').value }); await refresh(true); }
        } catch (e) { state.error = e.message; renderPreservingDetails(); }
    });
    const drag = floating.querySelector('.cx-drag'); let dragging;
    drag.addEventListener('pointerdown', event => { const r = floating.getBoundingClientRect(); dragging = { x: event.clientX - r.left, y: event.clientY - r.top }; drag.setPointerCapture(event.pointerId); });
    drag.addEventListener('pointermove', event => { if (!dragging) return; floating.style.right = 'auto'; floating.style.bottom = 'auto'; floating.style.left = Math.max(0, Math.min(innerWidth - floating.offsetWidth, event.clientX - dragging.x)) + 'px'; floating.style.top = Math.max(0, Math.min(innerHeight - floating.offsetHeight, event.clientY - dragging.y)) + 'px'; });
    drag.addEventListener('pointerup', () => { if (!dragging) return; dragging = null; const r = floating.getBoundingClientRect(); try { localStorage.setItem('codex-usage-position', JSON.stringify({ x: r.left, y: r.top })); } catch { /* optional */ } });
    const visible = () => { if (!document.hidden && (floatingEnabled || dialog.open)) refresh(); };
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(() => { if (!document.hidden && (floatingEnabled || dialog.open)) refresh(); }, 60000);
    draw(); refresh();
    return { open, refresh, destroy() { clearInterval(timer); document.removeEventListener('visibilitychange', visible); dialog.remove(); floating.remove(); launcher.remove(); menu.remove(); } };
}
