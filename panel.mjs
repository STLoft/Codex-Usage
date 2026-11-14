const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = value => Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—';
const when = value => value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const pct = value => value == null ? '—' : `${Math.round(value)}%`;
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
    // 확장 설정: 다른 확장과 같은 접이식 서랍
    const drawer = document.createElement('div'); drawer.id = 'codex-usage-drawer'; drawer.className = 'inline-drawer cx-drawer';
    drawer.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b class="cx-drawer-title"><span class="cx-dot" data-cx-dot></span>Codex Usage</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content"><div class="cx-mini">
            <div class="cx-mini-head"><span data-cx-mini-state>연결 확인 중…</span><small data-cx-mini-plan></small></div>
            <div class="cx-mini-meters" data-cx-mini-meters></div>
            <small class="cx-mini-time" data-cx-mini-time></small>
            <div class="cx-mini-actions"><button type="button" class="menu_button" data-cx-open>자세히 보기</button><button type="button" class="menu_button" data-cx-refresh>새로고침</button></div>
            <label class="checkbox_label cx-mini-check"><input type="checkbox" data-cx-floating><span>플로팅 잔량 표시</span></label>
        </div></div>`;
    const host = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings') || target;
    host.append(drawer);
    // 마법봉 메뉴: 다른 항목과 같은 div 구조 (button이면 테두리가 생김)
    const menu = document.createElement('div'); menu.id = 'codex-usage-menu'; menu.className = 'list-group-item flex-container flexGap5 interactable'; menu.tabIndex = 0;
    menu.innerHTML = '<div class="fa-solid fa-gauge extensionsMenuExtensionButton"></div><span>Codex Usage</span><span class="cx-menu-val"></span>';
    document.querySelector('#extensionsMenu')?.append(menu);
    const dialog = document.createElement('dialog'); dialog.className = 'cx-dialog'; dialog.setAttribute('aria-label', 'Codex Usage');
    dialog.innerHTML = '<header class="cx-header"><div><small>CODEX CLI</small><h2>Codex Usage</h2></div><button class="cx-close menu_button" aria-label="닫기">✕</button></header><div class="cx-content"></div>';
    target.append(dialog);
    const content = dialog.querySelector('.cx-content');
    const floating = document.createElement('div'); floating.id = 'codex-usage-floating'; floating.setAttribute('role', 'button'); floating.tabIndex = 0; floating.setAttribute('aria-label', 'Codex 잔량 보기'); floating.innerHTML = '<span class="cx-dot"></span><span>…</span>';
    floating.hidden = !floatingEnabled; document.body.append(floating);
    // 위치는 가까운 모서리 기준 여백으로 저장한다 (화면 크기가 바뀌어도 같은 구석에 남도록).
    let floatPos = { corner: 'rb', dx: 16, dy: 115 };
    try { const saved = JSON.parse(localStorage.getItem('codex-usage-position')); if (saved && typeof saved.corner === 'string' && Number.isFinite(saved.dx) && Number.isFinite(saved.dy)) floatPos = saved; } catch { /* 기본 위치 */ }
    // 실리태번(특히 모바일)은 테마의 blur·transform 때문에 fixed의 기준이 화면이 아닐 수 있다.
    // left/top 0에 놓았을 때 실제 위치를 재서 화면 좌표로 보정하고, 화면 밖으로 나가지 않게 한다.
    function placeFloating(x, y) {
        if (floating.hidden) return;
        floating.style.right = floating.style.bottom = 'auto';
        floating.style.left = floating.style.top = '0px';
        const r = floating.getBoundingClientRect();
        const vw = window.visualViewport?.width || innerWidth, vh = window.visualViewport?.height || innerHeight;
        if (x == null) {
            x = floatPos.corner.includes('r') ? vw - r.width - floatPos.dx : floatPos.dx;
            y = floatPos.corner.includes('b') ? vh - r.height - floatPos.dy : floatPos.dy;
        }
        x = Math.max(0, Math.min(Math.round(x), Math.floor(vw - r.width)));
        y = Math.max(0, Math.min(Math.round(y), Math.floor(vh - r.height)));
        floating.style.left = `${x - r.left}px`; floating.style.top = `${y - r.top}px`;
        return { x, y, w: r.width, h: r.height, vw, vh };
    }
    function draw() {
        const { status: s, usage: u } = state;
        const pools = limitPools(s?.limits);
        const first = pools[0];
        const main = remaining(first?.primary), second = remaining(first?.secondary);
        // AG Usage와 같은 표기: 5h N% · 7d N% (값 없으면 —)
        const failed = state.stale || s?.error || s?.quotaError;
        // 점 색도 AG와 같은 기준: 40% 이하 주황, 15% 이하 빨강
        const values = [main, second].filter(v => v != null), min = values.length ? Math.min(...values) : null;
        const level = failed ? 'down' : !s?.available || min == null ? 'idle' : min <= 15 ? 'low' : min <= 40 ? 'mid' : 'ok';
        floating.innerHTML = `<span class="cx-dot" data-level="${level}"></span>`
            + (failed ? '<span>Codex 조회 불가</span>' : s?.available ? `<span class="cx-fl-w">5h</span><span class="cx-fl-n">${pct(main)}</span><span class="cx-fl-sep">·</span><span class="cx-fl-w">7d</span><span class="cx-fl-n">${pct(second)}</span>` : '<span>Codex 연결 확인</span>');
        floating.title = [main != null ? `Codex 5시간 ${Math.round(main)}% 남음` : '', second != null ? `Codex 주간 ${Math.round(second)}% 남음` : ''].filter(Boolean).join('\n') + '\n눌러서 Codex Usage 열기 · 끌어서 이동';
        drawMini(first, main, second);
        if (!dragging) placeFloating();
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
        <p class="cx-muted">API 키 없이 연결 프로필 저장하면 됩니다.</p>
        ${s && !s.loggedIn ? '<p class="cx-muted">로그인이 필요합니다. SillyTavern 서버 터미널에서 <code>codex login</code>을 실행한 뒤 새로고침하세요.</p>' : ''}
        </div></details>
        <details class="cx-details" data-section="history"><summary>요청별 토큰 기록</summary><div class="cx-details-body"><p class="cx-muted">최근 200건 · 추론 토큰은 출력에, 캐시 토큰은 입력에 포함됩니다. 프롬프트와 대화 원문은 기록하지 않습니다.</p><div class="cx-table-wrap"><table><thead><tr><th>시각 / 모델</th><th>입력</th><th>캐시</th><th>출력</th><th>추론</th><th>상태</th></tr></thead><tbody>${u?.records?.length ? u.records.map(r => `<tr><td>${esc(when(r.at))}<small>${esc(r.model)}</small></td><td>${fmt(r.usage?.prompt_tokens)}</td><td>${fmt(r.usage?.prompt_tokens_details?.cached_tokens)}</td><td>${fmt(r.usage?.completion_tokens)}</td><td>${fmt(r.usage?.completion_tokens_details?.reasoning_tokens)}</td><td>${esc({ completed: '완료', failed: '실패', cancelled: '취소' }[r.state] || r.state)}</td></tr>`).join('') : '<tr><td colspan="6" class="cx-empty">아직 대화 기록이 없습니다.</td></tr>'}</tbody></table></div></div></details>
        <footer class="cx-footer"><label class="cx-check"><input id="cx-floating" type="checkbox" ${floatingEnabled ? 'checked' : ''}>플로팅 잔량</label><small>확장 v${VERSION} · 서버 v${esc(s?.versionBridge || '—')}</small></footer>`;
    }
    function drawMini(first, main, second) {
        const s = state.status;
        const failed = state.stale || s?.error || s?.quotaError;
        const tone = failed ? 'bad' : s?.loggedIn ? 'good' : s?.available ? 'warn' : '';
        drawer.querySelector('[data-cx-dot]').dataset.tone = tone;
        drawer.querySelector('[data-cx-mini-state]').textContent = state.busy && !s ? '연결 확인 중…' : failed ? '잔량 조회 불가' : s?.loggedIn ? 'ChatGPT / CLI 연결됨' : s?.available ? '로그인 필요' : '연결 확인 필요';
        drawer.querySelector('[data-cx-mini-plan]').textContent = s?.planType || '';
        const bar = (label, window, value) => `<div class="cx-mini-meter"><span>${label}</span><div class="cx-track"><span style="width:${value ?? 0}%;background:${value != null && value <= 15 ? 'var(--cx-danger)' : 'var(--cx-accent)'}"></span></div><strong>${value == null ? '—' : `${fmt(Math.round(value))}%`}</strong>${window?.resetsAt ? `<small>${esc(when(window.resetsAt * 1000))} 리셋</small>` : ''}</div>`;
        drawer.querySelector('[data-cx-mini-meters]').innerHTML = bar('5시간', first?.primary, main) + bar('주간', first?.secondary, second);
        drawer.querySelector('[data-cx-mini-time]').textContent = s?.checkedAt ? `${state.stale ? '마지막 성공 값 · ' : ''}조회 ${when(s.checkedAt)}` : '';
        drawer.querySelector('[data-cx-refresh]').disabled = state.busy;
        drawer.querySelector('[data-cx-floating]').checked = floatingEnabled;
        const val = menu.querySelector('.cx-menu-val');
        // AG Usage와 같은 표기: 5h N% · 7d N%
        val.textContent = failed ? '조회 불가' : s?.available ? `5h ${pct(main)} · 7d ${pct(second)}` : '';
    }
    function setFloating(on) {
        floatingEnabled = on; floating.hidden = !on; placeFloating();
        try { localStorage.setItem('codex-usage-floating', String(on)); } catch { /* optional */ }
        drawer.querySelector('[data-cx-floating]').checked = on;
        const box = content.querySelector('#cx-floating'); if (box) box.checked = on;
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
    for (const el of [menu, drawer.querySelector('[data-cx-open]')]) el.addEventListener('click', open);
    for (const el of [menu, floating]) el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    drawer.querySelector('[data-cx-refresh]').addEventListener('click', () => refresh(true));
    drawer.querySelector('[data-cx-floating]').addEventListener('change', event => setFloating(event.target.checked));
    dialog.querySelector('.cx-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    content.addEventListener('change', event => {
        if (event.target.id === 'cx-effort') state.effort = event.target.value;
        if (event.target.id === 'cx-floating') setFloating(event.target.checked);
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
    // 플로팅 전체를 끌어서 이동, 살짝 흔들린 탭(5px 미만)은 클릭으로 처리 (AG Usage와 같은 방식)
    let dragging, moved = false;
    floating.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const r = floating.getBoundingClientRect(); moved = false;
        dragging = { sx: event.clientX, sy: event.clientY, x: event.clientX - r.left, y: event.clientY - r.top };
        floating.setPointerCapture(event.pointerId);
    });
    floating.addEventListener('pointermove', event => {
        if (!dragging) return;
        if (!moved && Math.hypot(event.clientX - dragging.sx, event.clientY - dragging.sy) < 5) return;
        moved = true; floating.classList.add('cx-dragging');
        dragging.at = placeFloating(event.clientX - dragging.x, event.clientY - dragging.y);
    });
    floating.addEventListener('click', () => { if (moved) { moved = false; return; } open(); });
    const endDrag = () => {
        if (!dragging) return;
        floating.classList.remove('cx-dragging');
        const p = dragging.at; dragging = null; if (!p) return;
        const right = p.x + p.w / 2 > p.vw / 2, bottom = p.y + p.h / 2 > p.vh / 2;
        floatPos = { corner: (right ? 'r' : 'l') + (bottom ? 'b' : 't'), dx: Math.round(right ? p.vw - p.w - p.x : p.x), dy: Math.round(bottom ? p.vh - p.h - p.y : p.y) };
        try { localStorage.setItem('codex-usage-position', JSON.stringify(floatPos)); } catch { /* optional */ }
    };
    floating.addEventListener('pointerup', endDrag); floating.addEventListener('pointercancel', endDrag);
    const replace = () => placeFloating();
    window.addEventListener('resize', replace); window.visualViewport?.addEventListener('resize', replace);
    const visible = () => { if (!document.hidden && (floatingEnabled || dialog.open)) refresh(); };
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(() => { if (!document.hidden && (floatingEnabled || dialog.open)) refresh(); }, 60000);
    draw(); refresh();
    return { open, refresh, destroy() { clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('resize', replace); window.visualViewport?.removeEventListener('resize', replace); dialog.remove(); floating.remove(); drawer.remove(); menu.remove(); } };
}
