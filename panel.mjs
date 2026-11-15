const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = value => Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—';
const pct = value => value == null ? '—' : `${Math.round(value)}%`;
const icon = (name, extra = '') => `<i class="fa-solid ${name} ${extra}" aria-hidden="true"></i>`;
const VERSION = '0.1.0';
const HOUR = 3600_000;
// Codex Bridge 서버 플러그인 /settings가 허용하는 추론 단계 (plugins/Codex-Bridge/index.js와 맞춤)
const SERVER_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];

export function limitPools(limits) {
    const values = Object.values(limits?.rateLimitsByLimitId || {});
    return values.length ? values : limits?.rateLimits ? [limits.rateLimits] : [];
}
function remaining(window) { return typeof window?.usedPercent === 'number' && Number.isFinite(window.usedPercent) ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null; }
// 잔량 단계는 AG Usage와 같은 기준: 40% 이하 주황, 15% 이하 빨강
const level = value => value == null ? '' : value <= 15 ? 'low' : value <= 40 ? 'mid' : '';
function clock(value) {
    if (!value) return '—';
    const d = new Date(value), now = new Date();
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}
function relTime(value) {
    const ms = new Date(value).getTime() - Date.now();
    if (!Number.isFinite(ms)) return '';
    if (ms <= 0) return '곧 리셋';
    const mins = Math.round(ms / 60000), days = Math.floor(mins / 1440), hours = Math.floor((mins % 1440) / 60), rest = mins % 60;
    return `${days ? `${days}일 ` : ''}${hours ? `${hours}시간 ` : ''}${!days && rest ? `${rest}분 ` : ''}후 리셋`.replace(/^후/, '1분 후');
}
function windowLabel(mins, fallback) {
    if (mins === 300) return '5시간';
    if (mins === 10080) return '주간';
    if (!Number.isFinite(mins)) return fallback;
    if (mins % 1440 === 0) return `${mins / 1440}일`;
    if (mins % 60 === 0) return `${mins / 60}시간`;
    return `${mins}분`;
}
const section = (iconName, title, content, aside = '') => `<section class="cx-section">
    <header class="cx-sec-head">${icon(iconName)}<span class="cx-sec-title">${title}</span>${aside ? `<span class="cx-sec-aside">${aside}</span>` : ''}</header>${content}</section>`;
const alertBox = (msg, kind = 'warn') => `<div class="cx-alert ${kind}" role="alert">${icon(kind === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info')}<div>${msg}</div></div>`;
const loading = () => `<div class="cx-muted cx-loading">${icon('fa-circle-notch', 'fa-spin')} 불러오는 중…</div>`;

export function mount({ api, connect, profiles = null, target = document.body }) {
    const state = { status: null, usage: null, models: [], error: '', busy: false, modelsBusy: false, modelsError: '', modelsUpdatedAt: null, selected: null, effort: '', stale: false, historyOpen: null, openDetails: new Set() };
    state.profileEffort = null; state.profileBusy = false;
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

    // 팝업: AG Usage 팝업과 같은 구성 (머리글 · 상태 카드 · 공식 잔량 · 토큰 사용량 · 모델 · 설정)
    const dialog = document.createElement('dialog'); dialog.className = 'cx-dialog'; dialog.setAttribute('aria-label', 'Codex Usage');
    dialog.innerHTML = `<div class="cx-modal-head"><span class="cx-dot" data-cx-dot></span><b>Codex Usage</b><span class="cx-ver" data-cx-ver>v${VERSION}</span>
        <button class="menu_button cx-icon cx-close" title="닫기" aria-label="닫기">${icon('fa-xmark')}</button></div><div class="cx-modal-body"></div>`;
    target.append(dialog);
    const content = dialog.querySelector('.cx-modal-body');

    const floating = document.createElement('div'); floating.id = 'codex-usage-floating'; floating.setAttribute('role', 'button'); floating.tabIndex = 0; floating.setAttribute('aria-label', 'Codex 잔량 보기'); floating.innerHTML = '<span class="cx-dot"></span><span>…</span>';
    floating.hidden = !floatingEnabled; document.body.append(floating);
    // 위치는 가까운 모서리 기준 여백으로 저장한다 (화면 크기가 바뀌어도 같은 구석에 남도록).
    let floatPos = { corner: 'rb', dx: 16, dy: 115 };
    try { const saved = JSON.parse(localStorage.getItem('codex-usage-position')); if (saved && typeof saved.corner === 'string' && Number.isFinite(saved.dx) && Number.isFinite(saved.dy)) floatPos = saved; } catch { /* 기본 위치 */ }
    // 플로팅·마법봉 메뉴에 보일 기간 (both | 5h | 7d)
    let floatPeriod = 'both';
    try { const saved = localStorage.getItem('codex-usage-period'); if (['both', '5h', '7d'].includes(saved)) floatPeriod = saved; } catch { /* 기본값 */ }
    // 위치를 고르면 그 모서리의 기본 여백으로 옮긴다 (AG Usage와 같은 값)
    const CORNER_OFFSETS = { rt: [12, 64], lt: [12, 64], rb: [12, 140], lb: [12, 140] };
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

    const profileState = () => profiles?.snapshot(state.status?.settings?.effort || 'medium');
    function selectedModel() { return profileState()?.current.model || state.selected || state.status?.settings?.defaultModel || state.models.find(m => m.isDefault)?.id || ''; }
    function currentEffort() { return profileState()?.current.effort || state.effort || state.status?.settings?.effort || 'medium'; }
    // 서버(/settings)가 받는 단계만 보여 준다. CLI 목록의 max·ultra 등은 저장이 거절되므로 뺀다.
    function efforts() {
        const model = state.models.find(m => m.id === selectedModel());
        const values = (model?.efforts?.length ? model.efforts : ['low', 'medium', 'high']).filter(v => SERVER_EFFORTS.includes(v));
        return [...new Set([...(values.length ? values : ['low', 'medium', 'high']), currentEffort()].filter(v => SERVER_EFFORTS.includes(v)))];
    }
    function quota() {
        const s = state.status;
        const pools = limitPools(s?.limits), first = pools[0];
        const main = remaining(first?.primary), second = remaining(first?.secondary);
        const failed = Boolean(state.stale || s?.error || s?.quotaError);
        return { s, pools, first, main, second, failed };
    }

    // ── 화면 조각 ─────────────────────────────────────────────
    function viewHero(s) {
        const ok = s?.loggedIn && !state.stale;
        const title = !s ? '연결 확인 중…' : s.loggedIn ? 'ChatGPT / CLI 연결됨' : s.available ? '로그인 필요' : 'Codex CLI 연결 안 됨';
        const meta = [profileState()?.current.name ? esc(profileState().current.name) : '', selectedModel() ? `<span class="cx-mono">${esc(selectedModel())}</span>` : '', `추론 ${esc(currentEffort())}`, s?.planType ? esc(s.planType) : ''].filter(Boolean).join(' · ');
        return `<div class="cx-box cx-hero ${ok ? 'ok' : ''}">
            <div class="cx-hero-top">
                <span class="cx-dot" data-level="${ok ? 'ok' : s?.available ? 'idle' : 'down'}"></span>
                <div class="cx-hero-text"><b>${title}</b><span class="cx-hero-meta">${meta}</span></div>
                <button class="menu_button cx-icon" data-action="refresh" title="새로고침" aria-label="새로고침">${icon('fa-rotate', state.busy ? 'fa-spin' : '')}</button>
            </div>
            ${s?.apiUrl ? `<div class="cx-endpoints">
                <span class="cx-ep-label">대화</span><code title="${esc(s.apiUrl)}">${esc(s.apiUrl)}</code>
                <button class="menu_button cx-btn" data-action="connect" title="API 연결 화면에 Custom(OpenAI 호환)·주소·모델을 자동 입력">${icon('fa-plug')}연결</button>
            </div>` : ''}
        </div>`;
    }
    function quotaRow(label, window) {
        const value = remaining(window), lv = level(value);
        const reset = window?.resetsAt ? window.resetsAt * 1000 : null;
        return `<div class="cx-q"><span class="cx-q-label">${esc(label)}</span>
            <div class="cx-bar"><i class="${lv}" style="width:${value ?? 0}%"></i></div>
            <b class="cx-q-pct ${lv}">${value == null ? '—' : `${Math.round(value)}%`}</b>
            ${reset ? `<span class="cx-q-foot">${esc(relTime(reset))} · ${esc(clock(reset))}</span>` : ''}</div>`;
    }
    function viewQuota() {
        const { s, pools } = quota();
        if (!s) return loading();
        if (!pools.length) return alertBox(esc(s.quotaError || (s.checkedAt ? 'CLI가 잔량을 제공하지 않았습니다.' : '새로고침하면 CLI의 공식 잔량을 조회합니다.')), s.quotaError ? 'warn' : 'info');
        const title = p => p.limitName || (p.limitId === 'codex' ? 'Codex' : p.limitId) || 'Codex';
        return `${state.stale ? alertBox('조회에 실패해 마지막으로 성공한 값을 보여 줍니다.', 'info') : ''}
            <div class="cx-box cx-quota">${pools.map(p => `<div class="cx-qgroup"><div class="cx-qgroup-title">${esc(title(p))}</div>
            ${quotaRow(windowLabel(p.primary?.windowDurationMins, '5시간'), p.primary)}${quotaRow(windowLabel(p.secondary?.windowDurationMins, '주간'), p.secondary)}</div>`).join('')}</div>`;
    }
    function records(range) {
        const list = [...(state.usage?.records || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
        const since = range === '5h' ? Date.now() - 5 * HOUR : range === '7d' ? Date.now() - 168 * HOUR : 0;
        return list.filter(r => new Date(r.at).getTime() >= since);
    }
    function viewTokens() {
        const u = state.usage;
        if (!u) return loading();
        const ranges = [['5h', '이번 5시간', u.fiveHours], ['7d', '최근 7일', u.sevenDays], ['all', '전체', u.all]];
        const cards = ranges.map(([key, label, v]) => {
            const active = state.historyOpen === key;
            const value = v?.requests > 0 && v.unknown === v.requests ? '미제공' : fmt(v?.tokens);
            return `<button type="button" class="cx-stat ${active ? 'active' : ''}" data-history="${key}" aria-expanded="${active}" title="눌러서 요청별 입력/출력 보기">
                <span class="cx-stat-label">${label}${icon(active ? 'fa-chevron-up' : 'fa-chevron-down', 'cx-stat-chev')}</span>
                <span class="cx-stat-value">${value}</span>
                <span class="cx-stat-sub">${fmt(v?.requests)}회 요청${v?.unknown ? ` · ${fmt(v.unknown)}회 미제공` : ''}</span></button>`;
        }).join('');
        return `<div class="cx-stats">${cards}</div>${state.historyOpen ? viewHistory(state.historyOpen) : ''}`;
    }
    function viewHistory(range) {
        const list = records(range);
        const sum = list.reduce((acc, r) => {
            acc.in += r.usage?.prompt_tokens || 0; acc.out += r.usage?.completion_tokens || 0;
            acc.cache += r.usage?.prompt_tokens_details?.cached_tokens || 0; acc.think += r.usage?.completion_tokens_details?.reasoning_tokens || 0;
            return acc;
        }, { in: 0, out: 0, cache: 0, think: 0 });
        const flag = r => r.state === 'completed' ? '' : `<span class="cx-fail" title="${esc({ failed: '실패', cancelled: '취소' }[r.state] || r.state)}">${icon(r.state === 'cancelled' ? 'fa-ban' : 'fa-xmark')}</span>`;
        const rows = list.map(r => `<tr class="${r.state === 'completed' ? '' : 'fail'}">
            <td>${esc(clock(r.at))}</td><td class="cx-model-cell" title="${esc(r.model)}">${esc(r.model)}</td>
            <td>${fmt(r.usage?.prompt_tokens)}</td><td>${fmt(r.usage?.completion_tokens)}</td><td>${fmt(r.usage?.completion_tokens_details?.reasoning_tokens)}</td><td class="cx-flag">${flag(r)}</td></tr>`).join('');
        const clipped = range !== '5h' && state.usage?.retained && list.length >= state.usage.retained ? ` · 표는 최근 ${fmt(state.usage.retained)}건만 표시` : '';
        return `<div class="cx-box cx-history">
            <div class="cx-sum"><span>입력 <b>${fmt(sum.in)}</b></span><span>출력 <b>${fmt(sum.out)}</b></span><span>추론 <b>${fmt(sum.think)}</b></span><span>캐시 <b>${fmt(sum.cache)}</b></span></div>
            ${list.length ? `<div class="cx-table-wrap"><table class="cx-table"><thead><tr><th>시각</th><th>모델</th><th>입력</th><th>출력</th><th>추론</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
                : '<div class="cx-muted cx-empty">이 기간의 요청 기록이 없습니다.</div>'}
            <div class="cx-note">이 PC의 Bridge를 거친 요청 기준 · 추론은 출력에, 캐시는 입력에 포함${clipped}</div></div>`;
    }
    function viewModels() {
        if (state.modelsBusy && !state.models.length) return loading();
        const current = selectedModel();
        const list = state.models.map(m => {
            const on = m.id === current;
            return `<button type="button" class="cx-model ${on ? 'is-current' : ''}" data-model="${esc(m.id)}" role="radio" aria-checked="${on}" title="${on ? '사용 중' : '눌러서 현재 대화 연결에 입력'}">
                <span class="cx-radio"></span><span class="cx-model-id">${esc(m.id)}</span>
                <span class="cx-model-badges">${m.isDefault ? '<span class="cx-badge">CLI 기본</span>' : ''}</span></button>`;
        }).join('');
        const note = `${state.modelsUpdatedAt ? `CLI 목록 · ${esc(clock(state.modelsUpdatedAt))}` : 'CLI 목록 조회 전'} · 눌러서 현재 대화 연결에 입력`;
        return `${state.modelsError ? alertBox(`모델 조회 실패: ${esc(state.modelsError)}${state.models.length ? ' · 마지막 목록을 유지합니다.' : ''}`) : ''}
            ${list ? `<div class="cx-models" role="radiogroup">${list}</div>` : '<div class="cx-muted cx-empty">아직 모델 목록이 없습니다. 로그인 후 새로고침하거나 아래 설정에서 모델 ID를 직접 입력하세요.</div>'}
            ${current && !state.models.some(m => m.id === current) ? `<div class="cx-note">직접 입력한 모델 사용 중: <span class="cx-mono">${esc(current)}</span></div>` : ''}
            <div class="cx-note">${note}</div>`;
    }
    function viewProfiles() {
        const p = profileState(), value = state.profileEffort ?? p.effort;
        const ready = state.status?.capabilities?.profileReasoning === true;
        const model = state.models.find(m => m.id === p.model);
        const supported = (model?.efforts?.length ? model.efforts : ['low', 'medium', 'high']).filter(e => SERVER_EFFORTS.includes(e));
        const values = [...new Set([...supported, value].filter(e => SERVER_EFFORTS.includes(e)))];
        return `<div class="cx-profile-box"><div class="cx-sub-head">${icon('fa-sliders')}연결 프로필별 추론 설정</div>
            <label class="cx-field"><span>연결 프로필</span><select class="text_pole" id="cx-profile" ${state.profileBusy || !p.profiles.length ? 'disabled' : ''}>
                <option value="" disabled ${!p.id ? 'selected' : ''}>${p.profiles.length ? 'Codex 연결 프로필 선택' : '저장된 Codex 연결 프로필 없음'}</option>
                ${p.profiles.map(v => `<option value="${esc(v.id)}" ${v.id === p.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
            <label class="cx-field"><span>모델</span><input class="text_pole cx-mono" id="cx-profile-model" readonly value="${esc(p.model)}" placeholder="프로필에 저장된 모델"></label>
            <label class="cx-field"><span>추론 단계</span><select class="text_pole" id="cx-profile-effort" ${!p.id || state.profileBusy ? 'disabled' : ''}>
                <option value="" ${!value ? 'selected' : ''}>기본값 사용 (${esc(state.status?.settings?.effort || 'medium')})</option>
                ${values.map(v => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
            <button class="menu_button cx-btn cx-profile-save" data-action="profile-save" ${!p.id || state.profileBusy || !ready ? 'disabled' : ''}>${state.profileBusy ? '프로필 전환 중…' : '이 프로필에 저장'}</button>
            <div class="cx-note">${p.profiles.length ? '선택한 프로필에만 저장됩니다. 프로필을 바꾸면 모델과 추론이 함께 적용됩니다.' : 'SillyTavern API 화면에서 Codex 주소와 모델을 연결 프로필로 먼저 저장하세요.'}</div></div>
            ${state.status && !ready ? alertBox('프로필별 추론을 사용하려면 Codex Bridge 서버 플러그인을 업데이트하고 재시작하세요.') : ''}
            <div class="cx-profile-active"><b>현재 적용</b><div>${p.current.isCodex ? `${esc(p.current.name || '프로필 없이 연결')}<small>${esc(p.current.model)} · ${esc(p.current.effort)}</small>` : '다른 API 연결 사용 중'}</div></div>
            ${p.id && p.current.isCodex && !p.current.matches ? '<div class="cx-note">현재 API 설정의 모델이 프로필과 다릅니다. 프로필을 다시 불러오거나 SillyTavern에서 프로필을 업데이트하세요.</div>' : ''}`;
    }
    function viewSettings(s) {
        const open = state.openDetails.has('settings');
        return `<details class="cx-details" data-section="settings" ${open ? 'open' : ''}>
            <summary>${icon('fa-gear')}설정${icon('fa-chevron-down', 'cx-chev')}</summary>
            <div class="cx-details-body">
                ${profiles ? viewProfiles() + '<div class="cx-divider"></div>' : ''}
                <div class="cx-sub-head">${icon('fa-thumbtack')}플로팅 사용량</div>
                <label class="cx-check"><input id="cx-floating" type="checkbox" ${floatingEnabled ? 'checked' : ''}>화면에 잔량 표시</label>
                <div class="cx-form2">
                    <label class="cx-field"><span>기간</span><select class="text_pole" id="cx-float-period">${[['both', '5h + 7d'], ['5h', '5h만'], ['7d', '7d만']].map(([v, l]) => `<option value="${v}" ${floatPeriod === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                    <label class="cx-field"><span>위치</span><select class="text_pole" id="cx-float-corner">${[['rt', '오른쪽 위'], ['lt', '왼쪽 위'], ['rb', '오른쪽 아래'], ['lb', '왼쪽 아래']].map(([v, l]) => `<option value="${v}" ${floatPos.corner === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                </div>
                <div class="cx-note">플로팅은 끌어서 옮길 수 있어요 · 이 기기에만 저장 · 마법봉 메뉴 숫자도 같은 설정을 따름</div>
                <div class="cx-divider"></div>
                ${profiles ? `<details class="cx-details" data-section="manual" ${state.openDetails.has('manual') ? 'open' : ''}><summary>모델 ID 직접 입력</summary><div class="cx-details-body"><label class="cx-field"><span>모델 ID</span><input class="text_pole cx-mono" id="cx-custom-model" value="${esc(selectedModel())}" placeholder="목록에 없는 모델" autocomplete="off"></label><button class="menu_button cx-btn" data-action="connect-model">연결에 입력</button><div class="cx-note">모델을 바꾼 뒤 연결 프로필도 SillyTavern에서 저장하세요.</div></div></details>` : `<div class="cx-sub-head">${icon('fa-sliders')}Codex</div>
                <div class="cx-form">
                    <label class="cx-field"><span>추론 단계</span><select class="text_pole" id="cx-effort">${efforts().map(v => `<option value="${esc(v)}" ${v === currentEffort() ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
                    <label class="cx-field"><span>모델 ID 직접 입력</span><input class="text_pole cx-mono" id="cx-custom-model" value="${esc(selectedModel())}" placeholder="목록에 없는 모델" autocomplete="off"></label>
                    <button class="menu_button cx-btn" data-action="save" ${!s?.canManage ? 'disabled title="SillyTavern admin 계정만 저장할 수 있습니다"' : 'title="기본 모델·추론 단계를 저장하고 대화 연결에 입력"'}>적용</button>
                </div>
                <div class="cx-note">API 키 없이 연결 프로필 저장하면 됩니다.</div>`}
                <div class="cx-divider"></div>
                <div class="cx-actions">
                    <button class="menu_button cx-btn" data-action="reset" ${!s?.canManage ? 'disabled title="SillyTavern admin 계정만 초기화할 수 있습니다"' : 'title="이 Bridge의 토큰 사용 기록만 지웁니다 (공식 잔량에는 영향 없음)"'}>${icon('fa-eraser')}사용량 기록 초기화</button>
                </div>
            </div></details>`;
    }
    function shownPeriods(main, second) { return [['5h', main], ['7d', second]].filter(([w]) => floatPeriod === 'both' || floatPeriod === w); }
    function draw() {
        const { s, first, main, second, failed } = quota();
        // 플로팅·마법봉 메뉴: AG Usage와 같은 표기 5h N% · 7d N% (값 없으면 —)
        // 설정의 '기간'에 따라 5h·7d 중 보일 것만 (점 색도 보이는 값 기준)
        const shown = shownPeriods(main, second);
        const values = shown.map(([, v]) => v).filter(v => v != null), min = values.length ? Math.min(...values) : null;
        const lv = failed ? 'down' : !s?.available || min == null ? 'idle' : min <= 15 ? 'low' : min <= 40 ? 'mid' : 'ok';
        floating.innerHTML = `<span class="cx-dot" data-level="${lv}"></span>`
            + (failed ? '<span>Codex 조회 불가</span>' : s?.available ? shown.map(([w, v]) => `<span class="cx-fl-w">${w}</span><span class="cx-fl-n">${pct(v)}</span>`).join('<span class="cx-fl-sep">·</span>') : '<span>Codex 연결 확인</span>');
        floating.title = [main != null ? `Codex 5시간 ${Math.round(main)}% 남음` : '', second != null ? `Codex 주간 ${Math.round(second)}% 남음` : ''].filter(Boolean).join('\n') + '\n눌러서 Codex Usage 열기 · 끌어서 이동';
        drawMini(first, main, second, failed);
        if (!dragging) placeFloating();
        // 머리글
        const headLevel = !s ? 'idle' : failed && !s.loggedIn ? 'down' : s.loggedIn ? 'ok' : 'idle';
        dialog.querySelector('.cx-modal-head [data-cx-dot]').dataset.level = headLevel;
        const ver = dialog.querySelector('[data-cx-ver]'), mismatch = s?.versionBridge && s.versionBridge !== VERSION;
        ver.textContent = mismatch ? `확장 v${VERSION} · 서버 v${s.versionBridge}` : `v${VERSION}`;
        ver.classList.toggle('mismatch', Boolean(mismatch));
        ver.title = mismatch ? '확장과 서버 플러그인 버전이 다릅니다. 같은 배포본으로 업데이트하세요.' : '';
        // 본문
        const err = state.error || s?.error;
        content.innerHTML = `${viewHero(s)}
            ${err ? alertBox(esc(err)) : ''}
            ${s && s.available && !s.loggedIn ? alertBox('로그인이 필요합니다. SillyTavern 서버 터미널에서 <code>codex login</code>을 실행한 뒤 새로고침하세요.') : ''}
            ${section('fa-gauge-high', '공식 잔량', viewQuota(), s?.checkedAt ? `조회 ${esc(clock(s.checkedAt))}` : '')}
            ${section('fa-coins', '토큰 사용량', viewTokens(), '눌러서 상세 보기')}
            ${section('fa-microchip', '모델', viewModels(), `<button class="menu_button cx-icon" data-action="models" title="모델 목록 다시 조회" aria-label="모델 다시 조회">${icon('fa-rotate', state.modelsBusy ? 'fa-spin' : '')}</button>`)}
            ${viewSettings(s)}`;
    }
    function drawMini(first, main, second, failed) {
        const s = state.status;
        drawer.querySelector('[data-cx-dot]').dataset.level = failed ? 'down' : s?.loggedIn ? 'ok' : s?.available ? 'idle' : '';
        drawer.querySelector('[data-cx-mini-state]').textContent = state.busy && !s ? '연결 확인 중…' : failed ? '잔량 조회 불가' : s?.loggedIn ? 'ChatGPT / CLI 연결됨' : s?.available ? '로그인 필요' : '연결 확인 필요';
        drawer.querySelector('[data-cx-mini-plan]').textContent = s?.planType || '';
        const bar = (label, window, value) => {
            const reset = window?.resetsAt ? window.resetsAt * 1000 : null;
            return `<div class="cx-q"><span class="cx-q-label">${label}</span><div class="cx-bar"><i class="${level(value)}" style="width:${value ?? 0}%"></i></div><b class="cx-q-pct ${level(value)}">${pct(value)}</b>${reset ? `<span class="cx-q-foot">${esc(relTime(reset))} · ${esc(clock(reset))}</span>` : ''}</div>`;
        };
        drawer.querySelector('[data-cx-mini-meters]').innerHTML = bar('5시간', first?.primary, main) + bar('주간', first?.secondary, second);
        drawer.querySelector('[data-cx-mini-time]').textContent = s?.checkedAt ? `${state.stale ? '마지막 성공 값 · ' : ''}조회 ${clock(s.checkedAt)}` : '';
        drawer.querySelector('[data-cx-refresh]').disabled = state.busy;
        drawer.querySelector('[data-cx-floating]').checked = floatingEnabled;
        menu.querySelector('.cx-menu-val').textContent = failed ? '조회 불가' : s?.available ? shownPeriods(main, second).map(([w, v]) => `${w} ${pct(v)}`).join(' · ') : '';
    }
    function setFloating(on) {
        floatingEnabled = on; floating.hidden = !on; placeFloating();
        try { localStorage.setItem('codex-usage-floating', String(on)); } catch { /* optional */ }
        drawer.querySelector('[data-cx-floating]').checked = on;
        const box = content.querySelector('#cx-floating'); if (box) box.checked = on;
    }
    // innerHTML을 다시 쓰므로 입력 중인 값·포커스·스크롤 위치를 보존한다.
    function render() {
        const focused = content.contains(document.activeElement) ? document.activeElement.id : '';
        const range = focused === 'cx-custom-model' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
        const typed = content.querySelector('#cx-custom-model')?.dataset.dirty ? content.querySelector('#cx-custom-model').value : null;
        const scroll = content.scrollTop, tableScroll = content.querySelector('.cx-table-wrap')?.scrollTop, modelScroll = content.querySelector('.cx-models')?.scrollTop;
        draw();
        if (typed != null) { const el = content.querySelector('#cx-custom-model'); el.value = typed; el.dataset.dirty = '1'; }
        if (focused) { const el = content.querySelector(`#${focused}`); el?.focus({ preventScroll: true }); if (range) el?.setSelectionRange(...range); }
        content.scrollTop = scroll;
        if (tableScroll != null && content.querySelector('.cx-table-wrap')) content.querySelector('.cx-table-wrap').scrollTop = tableScroll;
        if (modelScroll != null && content.querySelector('.cx-models')) content.querySelector('.cx-models').scrollTop = modelScroll;
    }
    async function refresh(force = false) {
        if (state.busy) return;
        state.busy = true; render();
        try {
            const [status, usage] = await Promise.all([api('/status' + (force ? '?refresh=1' : '')), api('/usage')]);
            profiles?.setEndpoint(status.apiUrl);
            state.status = status; state.usage = usage; state.error = ''; state.stale = false;
        } catch (e) { state.error = e.message; state.stale = true; }
        finally { state.busy = false; render(); }
    }
    async function loadModels(force = false) {
        if (state.modelsBusy) return;
        state.modelsBusy = true; render();
        try {
            const data = await api(force ? '/models/refresh' : '/models', force ? {} : undefined);
            state.models = data.models || []; state.modelsError = data.modelsError || ''; state.modelsUpdatedAt = data.modelsUpdatedAt;
        } catch (e) { state.modelsError = e.message; }
        finally { state.modelsBusy = false; render(); }
    }
    // 모델 선택: 실리태번 대화 연결에 입력하고, 관리자면 브리지 기본 모델·추론 단계도 저장 (AG Usage와 같은 동작)
    async function useModel(model) {
        state.selected = model;
        const info = state.models.find(m => m.id === model);
        const allowed = (info?.efforts || []).filter(v => SERVER_EFFORTS.includes(v));
        if (allowed.length && !allowed.includes(currentEffort())) state.effort = allowed.includes(info.defaultEffort) ? info.defaultEffort : allowed.includes('medium') ? 'medium' : allowed[0];
        render();
        if (!profiles && state.status?.canManage) await api('/settings', { defaultModel: model, effort: currentEffort() });
        if (state.status?.apiUrl) connect(state.status.apiUrl, model);
        await refresh(true);
    }

    const stopProfiles = profiles?.subscribe(() => { state.profileEffort = null; state.error = ''; render(); });
    async function open() { if (!dialog.open) dialog.showModal(); await Promise.all([refresh(), loadModels()]); }
    for (const el of [menu, drawer.querySelector('[data-cx-open]')]) el.addEventListener('click', open);
    for (const el of [menu, floating]) el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    drawer.querySelector('[data-cx-refresh]').addEventListener('click', () => refresh(true));
    drawer.querySelector('[data-cx-floating]').addEventListener('change', event => setFloating(event.target.checked));
    dialog.querySelector('.cx-close').addEventListener('click', () => dialog.close());
    // 바깥(backdrop) 클릭은 dialog 자체가 target이 된다
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    content.addEventListener('toggle', event => {
        const d = event.target; if (!d.matches?.('details[data-section]')) return;
        if (d.open) state.openDetails.add(d.dataset.section); else state.openDetails.delete(d.dataset.section);
    }, true);
    content.addEventListener('change', event => {
        if (event.target.id === 'cx-profile-effort') state.profileEffort = event.target.value;
        if (event.target.id === 'cx-profile' && event.target.value) {
            const id = event.target.value; state.profileBusy = true; state.profileEffort = null; render();
            profiles.select(id).catch(e => { state.error = e.message; }).finally(() => { state.profileBusy = false; render(); });
        }
        if (event.target.id === 'cx-effort') state.effort = event.target.value;
        if (event.target.id === 'cx-floating') setFloating(event.target.checked);
        if (event.target.id === 'cx-float-period') {
            floatPeriod = event.target.value;
            try { localStorage.setItem('codex-usage-period', floatPeriod); } catch { /* optional */ }
            render();
        }
        if (event.target.id === 'cx-float-corner') {
            const [dx, dy] = CORNER_OFFSETS[event.target.value];
            floatPos = { corner: event.target.value, dx, dy };
            try { localStorage.setItem('codex-usage-position', JSON.stringify(floatPos)); } catch { /* optional */ }
            placeFloating();
        }
    });
    content.addEventListener('input', event => { if (event.target.id === 'cx-custom-model') event.target.dataset.dirty = '1'; });
    content.addEventListener('click', async event => {
        const history = event.target.closest('[data-history]');
        if (history) { state.historyOpen = state.historyOpen === history.dataset.history ? null : history.dataset.history; render(); return; }
        try {
            const modelButton = event.target.closest('[data-model]');
            if (modelButton) { if (modelButton.dataset.model !== selectedModel() || !state.status?.settings?.defaultModel) await useModel(modelButton.dataset.model); return; }
            const button = event.target.closest('[data-action]'); if (!button) return;
            const action = button.dataset.action;
            if (action === 'refresh') return await refresh(true);
            if (action === 'models') return await loadModels(true);
            if (action === 'profile-save') {
                if (!state.status?.capabilities?.profileReasoning) throw new Error('Codex Bridge 서버 플러그인을 업데이트하고 재시작하세요.');
                profiles.save(content.querySelector('#cx-profile').value, content.querySelector('#cx-profile-effort').value, state.models);
                window.toastr?.success('선택한 연결 프로필의 추론 설정을 저장했습니다.', 'Codex Usage');
                return;
            }
            if (action === 'connect-model') {
                const model = content.querySelector('#cx-custom-model').value.trim();
                if (!model) throw new Error('모델 ID를 입력하세요.');
                return await useModel(model);
            }
            if (action === 'connect') {
                if (!selectedModel()) throw new Error('모델을 선택하거나 설정에서 모델 ID를 입력하세요.');
                connect(state.status.apiUrl, selectedModel()); return;
            }
            if (action === 'reset') {
                if (!confirm('이 Bridge의 토큰 사용 기록을 초기화할까요? (공식 잔량에는 영향 없음)')) return;
                await api('/usage/reset', {});
                state.historyOpen = null;
                return await refresh(true);
            }
            if (action === 'save') {
                const model = content.querySelector('#cx-custom-model').value.trim();
                if (!model) throw new Error('모델 ID를 입력하세요.');
                await useModel(model);
            }
        } catch (e) { state.error = e.message; render(); }
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
    return { open, refresh, destroy() { stopProfiles?.(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('resize', replace); window.visualViewport?.removeEventListener('resize', replace); dialog.remove(); floating.remove(); drawer.remove(); menu.remove(); } };
}
