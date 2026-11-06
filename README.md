# 만자천홍 1부 · 3부 모바일 공략집

플레이하면서 계속 고칠 수 있도록 콘텐츠와 화면을 분리한 GitHub Pages 사이트입니다. 1부와 3부의 인물·맵·특수 기능·이미지는 별도로 관리합니다.

자세한 방법은 [업데이트 안내](docs/업데이트_방법.md)를 참고하세요.

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

추가 패키지 없이 Node.js 22 이상에서 실행합니다. dist/index.html은 온라인용, dist/offline.html은 이미지·기능을 내장한 다운로드용이며 같은 데이터에서 생성됩니다.

GitHub의 main 브랜치에 변경 사항을 올리면 검사 후 Pages를 배포합니다. 최초 한 번 Settings → Pages → Source를 GitHub Actions로 선택해야 합니다. 블로그에서 연결한 주소는 이후 업데이트에도 유지합니다.

출처와 검증 한계는 공략집 마지막에, 변경 사항은 업데이트 기록에 표시합니다. 개인 플레이 기록은 일반 공략의 확정 정보와 구분합니다. 체크리스트는 각 방문자의 브라우저에 따로 저장됩니다.

게임 이미지 권리: © Nintendo / INTELLIGENT SYSTEMS.

개발 검사는 `node tests/content.cjs`로 실행합니다. 모바일 브라우저 검사는 Playwright를 설치한 환경에서 빌드 후 `node tests/mobile.cjs`로 실행합니다. `PLAYWRIGHT_MODULE`로 설치 경로를, `GUIDE_BROWSER_PATH`로 테스트 브라우저 실행 파일을 지정할 수 있습니다. 결과는 Git에서 제외되는 `test-results/`에 저장됩니다.

3부 탈것·지역 복구·부대 편성은 `data/part3/field-guide.json`에서 관리합니다. 추가 브라우저 검사는 같은 환경 변수로 `node tests/field-guide.cjs`를 실행합니다. 수량이 상충하는 복구 재료는 큰 값을 준비량으로 표시하며 실제 납품량과 구분합니다.
