# three.js 陪跑课

和 `~/project/github-origin/three.js`（r187 源码）配套的练习项目，版本与仓库一致，
所以遇到看不懂的 API，可以直接去仓库的 `src/` 和 `docs/pages/` 里翻。

## 跑起来

```bash
npm install     # 第一次
npm run dev     # http://127.0.0.1:5174
```

- 课程首页：<http://127.0.0.1:5174>
- 第 1 课：<http://127.0.0.1:5174/lessons/01-hello-scene.html>

## 目录

```
index.html               课程首页（进度看板）
lessons/                 每节课的 HTML 壳子，一个文件一课
src/lessons/             每节课的 JS 主体
src/lib/hud.js           共用 HUD（标题 / 提示 / FPS）
src/style.css            共用样式
```

## 约定

1. 一课一个 JS 文件，注释按"这段在讲什么"写，而不是"这行代码是什么"。
2. 每课都留一个 `window.__scene`，方便你在控制台直接改参数、看结果。
3. 练习改坏了不要紧，`git checkout` 或直接找我。
