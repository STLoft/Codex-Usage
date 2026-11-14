export function connect(url, model) {
    const set = (selector, value) => {
        const el = window.$(selector);
        if (!el.length) throw new Error('API 설정 화면을 찾지 못했습니다. 연결 안내의 주소와 모델을 직접 입력하세요.');
        el.val(value).trigger('input').trigger('change');
    };
    set('#main_api', 'openai'); set('#chat_completion_source', 'custom'); set('#custom_api_url_text', url); set('#custom_model_id', model);
    window.toastr?.success('API 연결 설정을 입력했습니다. 연결 프로필을 저장하세요.', 'Codex Bridge');
}
