# Codex Usage

**SillyTavern에서 Codex 잔량·토큰 사용량을 확인하고 모델을 고르는 확장입니다.**

[Codex Bridge 서버 플러그인](https://github.com/STLoft/Codex-Bridge)과 함께 사용합니다.

## 처음 설치한다면

| 사용 환경 | 안내 |
| --- | --- |
| Windows / macOS / Linux | [데스크탑 설치](https://github.com/STLoft/Codex-Bridge/blob/main/docs/DESKTOP.md) |
| Android Termux | [Termux 설치](https://github.com/STLoft/Codex-Bridge/blob/main/docs/TERMUX.md) |

## 설치

1. 먼저 [Codex Bridge](https://github.com/STLoft/Codex-Bridge#설치)를 설치합니다. 사용량 확장만 설치하면 CLI에 연결되지 않습니다.
2. SillyTavern **확장 관리 → 확장 설치**에 아래 주소를 입력합니다.

```text
https://github.com/STLoft/Codex-Usage
```

3. 브라우저를 새로고침하고 확장 설정의 **Codex Usage**를 엽니다. 마법봉 메뉴의 **Codex Usage**로도 열 수 있습니다.

데스크탑·Termux 안내의 Git 명령으로 이미 두 구성요소를 설치했다면 확장 설치를 다시 할 필요는 없습니다. 서버 플러그인도 방금 설치했다면 서버 재시작도 필요합니다.

## 모델 선택·연결

1. 팝업 맨 위 상태 카드에서 **ChatGPT / CLI 연결됨**을 확인합니다.
2. **모델** 목록에서 원하는 모델을 누릅니다. SillyTavern API 연결에 주소·모델이 입력되고, SillyTavern admin 계정이라면 기본 모델로도 저장됩니다(사용자 계정 기능을 쓰지 않으면 항상 저장). 목록이 비어 있으면 로그인 확인 후 모델 옆 새로고침 버튼을 누르세요.
3. 추론 단계나 목록에 없는 모델 ID는 **설정**에서 바꾸고 **적용**을 누릅니다.
4. API 키 없이 연결 프로필을 저장하면 됩니다. 상태 카드의 **연결** 버튼으로 현재 모델을 다시 입력할 수도 있습니다.

자세한 화면별 순서는 [첫 연결 안내](https://github.com/STLoft/Codex-Bridge/blob/main/docs/CONNECTION.md)에 있습니다.

## 팝업 읽는 방법

| 항목 | 의미 |
| --- | --- |
| 공식 잔량 | 계정의 5시간·주간 남은 비율과 리셋까지 남은 시간 (40% 이하 주황, 15% 이하 빨강) |
| 토큰 사용량 | 이 연결을 거친 요청만 합산한 사용량. 카드를 누르면 요청별 입력·출력·추론 표가 펼쳐짐 |
| `미제공` 또는 `—` | CLI가 해당 값을 제공하지 않음 |
| `조회 불가` | 조회에 실패하거나 올바른 값을 받지 못함 |
| `0%` | 실제로 남은 잔량이 0% |

상태 카드의 새로고침은 잔량·토큰을 갱신하고, 모델 옆 새로고침은 모델 목록을 갱신합니다. 모델은 서버 시작 시 한 번, 이후 수동 버튼으로만 조회하며 기존 선택을 바꾸지 않습니다.

화면에 떠 있는 잔량 표시는 누르면 팝업이 열립니다. 끌어서 옮기거나 팝업 **설정**의 **화면에 잔량 표시** 체크를 꺼서 숨길 수 있습니다. **기간**에서 5h·7d·둘 다 중 표시할 항목을 고르고 **위치**에서 모서리를 선택할 수 있습니다. 마법봉 메뉴 숫자도 같은 기간을 표시합니다.

**설정 → 사용량 기록 초기화**는 이 브리지의 요청별 기록과 토큰 합계를 지웁니다. 공식 계정 잔량과 모델·추론 설정은 바뀌지 않습니다. SillyTavern admin 계정만 사용할 수 있으며 사용자 계정 기능을 쓰지 않으면 누구나 사용할 수 있습니다.

## 업데이트·문제 해결

확장 관리에서 업데이트하고 브라우저를 새로고침하세요. 서버 플러그인도 업데이트했다면 SillyTavern 서버를 재시작합니다.

팝업이 없거나 연결이 안 되면 [문제 해결 안내](https://github.com/STLoft/Codex-Bridge/blob/main/docs/TROUBLESHOOTING.md)를 확인하세요.

## 알아둘 점

- Temperature·Top-p는 적용되지 않으며 최대 토큰은 길이 안내입니다. 텍스트 대화만 지원합니다.
- 데스크탑·Termux 모두 app-server로 대화·모델·잔량을 연결합니다. [사용 방법](https://github.com/STLoft/Codex-Bridge/blob/main/docs/TERMUX.md#잔량모델-조회)
- 개발 베타입니다. **Windows·Android 에뮬레이터에서 연결 확인 · 실제 휴대폰 미검증**. macOS/Linux 실기기도 아직 검증하지 않았습니다.
- OpenAI 또는 SillyTavern의 공식 확장은 아닙니다. 로그인 정보는 설치된 CLI가 관리합니다.

## 라이선스

[MIT](LICENSE)
