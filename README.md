# Last Lane

모바일 브라우저에서 한 손으로 즐기는 세로형 탄막 생존 게임입니다. 플레이어는 마지막 차선을 지키며 적과 탄막을 피하고, 서버가 재검증할 수 있는 리플레이로 랭킹에 도전합니다. 설치 가능한 PWA로 동작하며 오프라인 일반 플레이도 지원합니다.

**바로 플레이: https://last-lane.vercel.app**

## 플레이 방법

- 화면 아래의 터치 조이스틱을 좌우로 움직여 분대를 조작합니다. 사격은 자동입니다.
- 생존 거리, 적 처치, 엘리트·보스 처치, 아슬아슬한 회피로 점수를 얻습니다.
- 온라인에서 게임을 시작하면 제한 시간 티켓이 발급됩니다. 게임 종료 후 닉네임을 입력해 검증된 점수를 등록할 수 있습니다.
- 네트워크가 잠시 끊기면 제출을 로컬 큐에 보관하고 온라인 복귀 시 다시 시도합니다. 오프라인으로 시작한 게임은 랭킹에 등록되지 않습니다.

## 로컬 실행

Node.js 22 이상과 Corepack이 필요합니다. Vercel 프로덕션은 Node.js 24.x에서 빌드·실행됩니다.

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

프로덕션 빌드와 미리보기:

```bash
corepack pnpm build
corepack pnpm preview
```

API까지 로컬에서 확인하려면 Vercel CLI를 사용하고 `.env.example`의 값을 `.env.local`에 설정합니다. `BLOB_READ_WRITE_TOKEN`은 연결된 Vercel Blob 저장소에서 발급받습니다.

```bash
vercel link
vercel env pull .env.local
vercel dev
```

## 검증

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
```

## 구조

- `src/game`: 결정론적 시뮬레이션, 웨이브 생성, 렌더링, 입력, 점수 계산
- `src/ui`: 시작·튜토리얼·HUD·결과·랭킹 화면
- `src/ranking`: 티켓 발급/점수 제출 클라이언트와 재시도 큐
- `src/server`: 서버 리플레이 검증, Blob 기반 랭킹 저장소, 속도 제한
- `api`: Vercel Functions HTTP 경계
- `tests`: 단위·통합·Playwright 모바일/PWA 시나리오

브라우저는 입력 이벤트로부터 압축된 트랜스크립트를 만들고, 서버는 티켓의 시드와 규칙 버전으로 게임을 다시 실행해 점수를 계산합니다. 랭킹 데이터와 분산 속도 제한 슬롯은 Vercel Blob에 저장됩니다. `/api/reconcile`은 중단된 랭킹 게시 작업을 복구하는 인증된 일일 크론입니다.

## 보안 및 운영

- 클라이언트가 보낸 점수는 신뢰하지 않고 서버에서 리플레이를 재생해 계산합니다.
- `RUN_TICKET_SECRET`, `IP_HASH_SECRET`, `CRON_SECRET`은 서로 다른 32바이트 이상 난수로 생성하고 Git에 커밋하지 않습니다.
- IP는 원문으로 저장하지 않으며 `IP_HASH_SECRET`을 사용한 HMAC 키로만 속도 제한에 사용합니다.
- `/api/reconcile`은 `Authorization: Bearer $CRON_SECRET` 없이는 실행되지 않습니다.
- 티켓은 짧은 등록 기한과 일회성 nonce를 가지며, 요청 크기·실행 시간·요청 빈도를 제한합니다.
- Blob 접근 토큰과 세 비밀은 Vercel의 Production/Preview 환경변수로만 관리합니다. 노출이 의심되면 즉시 회전합니다.

## 배포

Vercel 프로젝트에 GitHub 저장소를 연결한 뒤 Blob 저장소와 환경변수를 구성합니다. `vercel.json`은 Vite SPA 폴백, 10초 함수 제한, 매일 03:00 UTC 랭킹 복구 작업을 선언합니다.

```bash
vercel deploy --prod
```
