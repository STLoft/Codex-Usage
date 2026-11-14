# Codex Usage for SillyTavern

[Codex Bridge](https://github.com/STLoft/Codex-Bridge)의 공식 CLI 잔량·로컬 토큰 기록·모델 선택을 표시하는 SillyTavern 브라우저 확장입니다. **v0.1.0 개발 베타**이며 OpenAI 또는 SillyTavern의 공식 확장이 아닙니다.

## 설치

1. 먼저 [서버 플러그인 Codex Bridge](https://github.com/STLoft/Codex-Bridge#설치)를 설치합니다. 이 UI만 설치하면 CLI에 연결되지 않습니다.
2. SillyTavern → 확장 관리 → 확장 설치에 아래 주소를 입력합니다.

```text
https://github.com/STLoft/Codex-Usage
```

또는 SillyTavern 루트 폴더에서:

```sh
git clone https://github.com/STLoft/Codex-Usage.git public/scripts/extensions/third-party/Codex-Usage
```

3. 브라우저를 새로고침합니다.
4. 확장 설정 **Codex Bridge · 사용량** 또는 마법봉 메뉴 **Codex 사용량**을 엽니다.
5. 모델 선택 → **대화 연결에 입력** → SillyTavern API 화면에서 **연결**을 누릅니다. API Key는 비웁니다.

기존 개발용 `ST-Codex-Usage` 폴더를 함께 로드하지 마세요. 서버·UI는 같은 버전 조합으로 업데이트하세요. 서버 v0.1.0과 함께 검증했습니다.

## 표시 항목

- 5시간·주간 계정 잔량과 리셋 시각. CLI가 제공하지 않으면 **미제공**, 조회 실패는 **조회 불가**로 표시하고 실제 0%와 구분합니다.
- 이 브리지를 거친 요청의 입력·캐시·출력·생각 토큰과 완료·실패·취소 상태. 세부 토큰 미제공은 `—`로 표시합니다.
- 팝업 안에 펼쳐진 모델 목록, 직접 모델 ID 입력, 지원 추론 단계와 연결 화면 자동 입력.
- 누르면 팝업이 열리고 손잡이를 끌어 이동할 수 있는 플로팅 잔량. 위치와 표시 여부는 브라우저에 저장합니다.

**모델 목록은 서버 시작 시 한 번 자동 조회하고, 이후 ‘모델 새로고침’을 눌렀을 때만 CLI에서 갱신합니다.** 팝업을 여는 동작과 잔량의 60초 갱신은 모델을 재조회하지 않습니다. 목록 갱신으로 선택 모델·직접 입력한 ID를 바꾸지 않으며 조회 실패 시 마지막 목록을 유지합니다.

모델 목록은 CLI의 카탈로그로 실제 계정 접근 권한을 보장하지 않습니다. **모델·추론 설정 저장**은 서버 공통 설정이며 관리자에게만 허용됩니다. **대화 연결에 입력**은 현재 브라우저의 SillyTavern 연결 폼을 채웁니다.

## 제한·검증

Temperature·Top-p는 적용되지 않고 최대 토큰은 답변 길이 지시로만 전달됩니다. 텍스트 전용입니다. 네이티브 터먹스에서는 공식 잔량과 모델 자동 열거를 제공하지 않으며, 실제 Android 실행은 미검증입니다.

Windows의 독립 브라우저 검증 페이지에서 PC 1200 × 900, 모바일 너비 390 × 900 각각 19개 점검을 통과했습니다. 실제 확장 모듈·jQuery·서버 플러그인 API와 모의 CLI를 사용한 결과이며, 실제 SillyTavern 전체 UI와 모바일 실기기 검증은 남아 있습니다. 공식 CLI 연결은 Windows Codex CLI 0.169.0으로 확인했습니다.

## 데이터·업데이트

이 확장은 같은 SillyTavern 서버의 `/api/plugins/codex-bridge/*`를 호출합니다. 인증 토큰 파일을 직접 읽거나 업로드하지 않으며 별도 외부 통계 서버를 사용하지 않습니다. 역할극 응답 생성 시 프롬프트는 서버의 CLI를 통해 OpenAI에 전송됩니다.

서버 토큰 기록은 이 브리지를 거친 요청만 포함합니다. 계정 잔량은 같은 계정의 다른 Codex 사용에도 영향을 받을 수 있습니다. 캐시는 입력에, 생각 토큰은 출력에 포함됩니다. 상세 기록·합계의 보관 범위는 [서버 README](https://github.com/STLoft/Codex-Bridge#사용량모델)를 확인하세요.

SillyTavern 확장 관리에서 업데이트하거나 저장소 폴더에서 `git pull --ff-only` 후 브라우저를 새로고침합니다. 서버 플러그인도 업데이트했다면 서버를 재시작하세요. 버전 불일치 경고가 뜨면 두 저장소의 버전을 확인하세요.

## 라이선스

MIT. [서버 설치 안내](https://github.com/STLoft/Codex-Bridge) · [라이선스](LICENSE)
