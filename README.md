# Codex Usage for SillyTavern

Codex CLI를 연결한 SillyTavern에서 **계정 잔량·토큰 기록·모델 선택**을 볼 수 있는 브라우저 확장입니다. 공식 CLI를 이용하는 비공식 확장이며, OpenAI 또는 SillyTavern의 공식 확장은 아닙니다.

**v0.1.0 개발 베타** · MIT · [Codex Bridge 서버 플러그인](https://github.com/STLoft/Codex-Bridge)이 함께 필요합니다.

## 처음 설치하시나요?

| 상황 | 안내 |
| --- | --- |
| Windows/macOS/Linux PC에 설치 | [데스크탑 단계별 설치](https://github.com/STLoft/Codex-Bridge/blob/main/docs/DESKTOP.md) |
| 휴대폰으로 PC의 SillyTavern에 접속 | 위 데스크탑 안내. CLI·서버 플러그인은 PC에 설치 |
| Android 네이티브 터먹스에서 서버까지 실행 | [터먹스 설치·설정](https://github.com/STLoft/Codex-Bridge/blob/main/docs/TERMUX.md). 실기기 미검증 |
| 설치 후 모델과 대화 API를 설정 | [처음 연결하기](https://github.com/STLoft/Codex-Bridge/blob/main/docs/CONNECTION.md) |
| 설치·로그인·잔량 표시 오류 | [문제 해결](https://github.com/STLoft/Codex-Bridge/blob/main/docs/TROUBLESHOOTING.md) |

## 설치

### 1. 서버 플러그인 먼저 준비하기

이 사용량 확장은 팝업 화면을 담당합니다. CLI를 실행하는 [Codex Bridge 서버 플러그인](https://github.com/STLoft/Codex-Bridge#설치)이 없으면 대화·잔량 조회가 되지 않습니다. 아직 서버 플러그인을 설치하지 않았다면 위의 환경별 안내부터 따라 주세요.

### 2. 브라우저 확장 설치하기

SillyTavern의 **확장 관리 → 확장 설치**에서 다음 주소를 입력해 설치합니다.

```text
https://github.com/STLoft/Codex-Usage
```

이미 데스크탑/터먹스 안내의 Git 명령으로 두 구성요소를 모두 설치했다면 이 단계는 생략합니다. 같은 확장을 두 번 설치하지 마세요.

터미널로 설치하려면 SillyTavern 루트 폴더에서 다음 명령을 사용할 수도 있습니다. 확장 설치 창과 이 명령 중 한 가지 방법만 선택하세요.

```sh
git clone https://github.com/STLoft/Codex-Usage.git public/scripts/extensions/third-party/Codex-Usage
```

### 3. 브라우저 새로고침하고 팝업 열기

브라우저를 새로고침한 뒤 확장 설정 **Codex Bridge · 사용량**을 누릅니다. 마법봉 메뉴 **Codex 사용량** 또는 화면에 떠 있는 작은 Codex 잔량 표시로도 열 수 있습니다. 서버 플러그인도 방금 설치했다면 SillyTavern 서버 재시작도 필요합니다.

## 모델을 고르고 대화 연결하기

1. 팝업에서 **ChatGPT / CLI 연결됨**을 확인합니다.
2. 펼쳐진 **사용 가능한 모델** 목록에서 원하는 모델을 누릅니다. 목록이 없으면 CLI 로그인 확인 후 **모델 새로고침**을 누르세요.
3. 필요하면 추론 단계를 고르고 **모델·추론 설정 저장**을 누릅니다. 저장은 서버 관리자만 할 수 있고 같은 서버의 요청에 공통 적용됩니다.
4. **대화 연결에 입력**을 누릅니다.
5. SillyTavern API 화면에서 Chat Completion → Custom (OpenAI-compatible), URL `http://127.0.0.1:7861/v1`, 선택 모델, 비어 있는 API Key를 확인하고 **연결**을 누릅니다.
6. 짧은 대화를 보내고 팝업의 **요청별 토큰 기록**을 확인합니다.

모델·추론 설정 저장과 API 연결 자동 입력은 다른 동작입니다. 자세한 설명은 [처음 연결하기](https://github.com/STLoft/Codex-Bridge/blob/main/docs/CONNECTION.md)를 참고하세요. 터먹스 exec 모드는 `codex-default` 또는 직접 입력한 모델 ID를 사용합니다.

## 팝업에 보이는 값은 무엇인가요?

| 표시 | 의미 |
| --- | --- |
| 5시간·주간 잔량, 리셋 시각 | CLI가 제공한 계정 기준 값. 같은 계정의 다른 Codex 사용도 영향을 줄 수 있음 |
| 이 브리지의 토큰 | 이 브리지를 거친 요청만 합산. 계정 전체 사용량과는 범위가 다름 |
| 입력·캐시·출력·생각 | 캐시는 입력에, 생각 토큰은 출력에 포함. 다시 더하지 않음 |
| `미제공` 또는 `—` | CLI가 해당 항목을 제공하지 않음 |
| `조회 불가` | 조회 실패 또는 올바른 값을 받지 못함 |
| `0% 남음` | 실제로 제공된 잔량이 0% |

상단 **새로고침**은 잔량·토큰을, **모델 새로고침**은 모델 목록을 조회합니다. 모델은 서버 시작 시 한 번 자동 조회하고 이후 수동 버튼으로만 갱신합니다. 팝업 열기와 잔량의 60초 갱신은 모델 목록을 CLI에 재조회하지 않습니다. 갱신 시 선택·직접 입력한 모델을 바꾸지 않으며 실패하면 마지막 목록을 유지합니다.

플로팅 잔량은 누르면 팝업이 열리고 왼쪽 손잡이를 끌어 이동할 수 있습니다. 팝업 아래 **플로팅 잔량** 체크를 끄면 숨깁니다. 위치·표시 여부는 해당 브라우저에 저장합니다.

## 업데이트

확장 관리에서 업데이트하거나 SillyTavern 루트에서 다음을 실행하고 브라우저를 새로고침합니다.

```sh
git -C public/scripts/extensions/third-party/Codex-Usage pull --ff-only
```

서버 플러그인도 업데이트했다면 서버를 재시작하세요. 서버·UI는 호환되는 같은 버전 조합을 사용합니다. 이 버전은 서버 v0.1.0과 함께 검증했습니다. 개발용 `ST-Codex-Usage` 폴더를 중복 로드하지 마세요.

## 제한·검증 상태

- Temperature·Top-p는 적용되지 않습니다. 최대 토큰은 길이 지시이며 강제 상한이 아닙니다. 텍스트 전용입니다.
- 네이티브 터먹스는 공식 잔량·자동 모델 열거를 지원하지 않습니다. 미지원 안내가 정상입니다.
- Windows 독립 브라우저 페이지에서 PC 1200 × 900·모바일 너비 390 × 900 각각 19개 점검이 통과했습니다. 모의 CLI와 검증용 폼을 썼으며 실제 SillyTavern 전체 UI 검증은 남아 있습니다.
- Windows CLI 0.169.0 실제 연결을 확인했습니다. Android 네이티브 터먹스·macOS/Linux 실기기는 아직 검증하지 않았습니다. PC의 모바일 너비 검증과 실제 Android 실행은 구분합니다.

## 데이터와 라이선스

이 확장은 같은 SillyTavern 서버의 `/api/plugins/codex-bridge/*`를 호출합니다. 인증 토큰 파일을 직접 읽거나 업로드하지 않고 별도 외부 통계 서버를 사용하지 않습니다. 응답 생성 시 대화 내용은 서버의 CLI를 통해 OpenAI로 전송됩니다. 서버 기록의 보관 범위는 [서버 README](https://github.com/STLoft/Codex-Bridge#사용량모델)에 있습니다.

MIT. [라이선스](LICENSE) · [서버 저장소](https://github.com/STLoft/Codex-Bridge) · [문제 해결](https://github.com/STLoft/Codex-Bridge/blob/main/docs/TROUBLESHOOTING.md)
