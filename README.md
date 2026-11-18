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
- 第 2 课：<http://127.0.0.1:5174/lessons/02-solar-system.html>
- 第 3 课：<http://127.0.0.1:5174/lessons/03-buffer-geometry.html>
- 第 3 课：<http://127.0.0.1:5174/lessons/03-buffer-geometry.html>
- 附录：<http://127.0.0.1:5174/lessons/02-euler-compare.html>（欧拉角左右对照）

## 目录

```
index.html               课程首页（进度看板 + 笔记入口）
lessons/                 每节课的 HTML 壳子，一个文件一课
src/lessons/             每节课的 JS 主体
src/lib/hud.js           共用 HUD（标题 / 提示 / FPS）
src/style.css            共用样式
docs/                    课堂笔记（每课一篇，Markdown）
  README.md              笔记索引 + 写作模板
  01-scene-camera-loop.md
  02-scene-graph.md
  03-buffer-geometry.md
  03-buffer-geometry.md
  pbr.md                 PBR 材质附表
  3d-math-cheatsheet.md  3D 数学公式速查（全课通用）
```

## 约定

1. 一课一个 JS 文件，注释按"这段在讲什么"写，而不是"这行代码是什么"。
2. 每课都留一个 `window.__scene`，方便你在控制台直接改参数、看结果。
3. 练习改坏了不要紧，`git checkout` 或直接找我。
4. 每节课的讲解都写进 `docs/`，聊天会丢，笔记不会；结构见 `docs/README.md`。
