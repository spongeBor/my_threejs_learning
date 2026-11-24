# 第 7 课 · 动画系统

- 页面：`/lessons/07-animation.html`
- 代码：`src/lessons/07-animation.js`
- 目标：知道动画的四层结构，能写出状态切换与淡入淡出

---

## 0. 一句话

**动画 = 关键帧数据（clip）→ 播放实例（action）→ 每帧推进（mixer）→ 写回对象属性。**

```
AnimationClip          一段关键帧数据：什么时间、哪个对象的哪个属性、等于多少
      ↓ clipAction()
AnimationAction        某个 clip 的一次播放：权重、时间、速度、循环方式
      ↓ mixer.update(delta)
AnimationMixer         每帧推进时间，把插值结果写回对象
```

**你不需要逐帧手写 `rotation.y += ...`——mixer 会替你算插值。**

---

## 1. 心智模型

```
时间轴 ──────────────────────────────▶
        keyframe      keyframe
           0.0s          0.5s
对象属性   value A  ──插值──  value B
              │
              ▼  mixer.update(delta)
        写回 object.quaternion / position / material.opacity …
```

关键帧就是三样东西：

```js
new THREE.QuaternionKeyframeTrack(
	'ArmL.quaternion',        // ① 改谁：对象名.属性
	[ 0, 0.5, 1 ],            // ② 什么时候
	[ qx,qy,qz,qw, ... ],     // ③ 多少（四元数要 4 个数）
);
```

三种常用轨道：

| 轨道类 | 属性例子 | 每组值的个数 |
|---|---|---|
| `VectorKeyframeTrack` | `.position`、`.scale` | 3 |
| `QuaternionKeyframeTrack` | `.quaternion` | 4 |
| `NumberKeyframeTrack` | `.material.opacity`、`.intensity` | 1 |

---

## 2. 四个类，各管什么

### `AnimationClip`

一段数据。`new AnimationClip( name, duration, tracks )`。

- 不含“怎么播”，只有“什么时间是什么值”
- 从 glb 加载时，`gltf.animations` 就是一堆 clip

### `AnimationAction`

一个 clip 的**一次播放实例**。

| 方法 | 作用 |
|---|---|
| `play()` / `stop()` / `reset()` | 播放控制 |
| `setLoop( LoopRepeat / LoopOnce, n )` | 循环方式 |
| `clampWhenFinished = true` | 一次性动作停在最后一帧 |
| `setEffectiveWeight( w )` | 权重（0 不生效，1 完全生效） |
| `setEffectiveTimeScale( s )` | 这个动作单独的速度 |
| `crossFadeTo( other, duration )` | 平滑过渡 |

> 同一个 clip 可以被多个 action 用（比如两个敌人共用一套 Walk）。

### `AnimationMixer`

每帧推进时间。

```js
const mixer = new THREE.AnimationMixer( character );   // 根节点
mixer.update( delta );                                 // 每个循环都要调
```

`mixer.timeScale` 控制整体快慢——暂停就是设成 0。

**根节点很重要**：track 里的 `'ArmL.quaternion'` 就是在 `character` 树里找名为 `ArmL` 的对象。

### `PropertyBinding`

底层：解析 `'ArmL.quaternion'` 这种字符串，找到对象和属性。

两个常见的解析失败原因：

- 名字写错 / 对象没命名
- 同名对象有多个，绑到了错误的那个

---

## 3. 状态机：一次只播一个

最朴素的写法（也是本课用的）：

```js
function switchTo( name ) {

	if ( name === currentName ) return;

	const from = actions[ currentName ];
	const to = actions[ name ];

	if ( name === 'Wave' ) to.reset();     // 一次性动作要从头播

	to.enabled = true;
	to.setEffectiveWeight( 1 );
	to.play();

	from.crossFadeTo( to, 0.3, false );    // 0.3 秒内过渡

	currentName = name;

}
```

三条规则：

1. **不要同时 `play()` 多个循环动作**——权重会叠在一起，手势会互相打架
2. **切换要用 `crossFadeTo`，不要直接 `stop()`**——否则会“啪”地跳一下
3. **一次性动作记得 `reset()`**，否则第二次触发时它还停在结尾

### 一次性动作（Wave）

```js
action.setLoop( THREE.LoopOnce, 1 );
action.clampWhenFinished = true;

mixer.addEventListener( 'finished', ( e ) => {
	if ( e.action === actions.Wave ) switchTo( 'Idle' );
} );
```

---

## 4. 从 glb 来的动画

```js
loader.load( '/models/hero.glb', ( gltf ) => {

	scene.add( gltf.scene );

	const mixer = new THREE.AnimationMixer( gltf.scene );

	// gltf.animations 是 AnimationClip 数组
	for ( const clip of gltf.animations ) {

		mixer.clipAction( clip ).play();

	}

} );
```

和本课唯一的区别：clip 是文件里带来的，不是你手写的。

> glTF 里的动画有两种：**节点动画**（改 position/rotation）和**骨骼动画**（改 Bone 的矩阵，配合 SkinnedMesh）。三者 API 完全一样，`mixer` 都替你处理。

---

## 5. 代码走读（`src/lessons/07-animation.js`）

1. 用 Box / Sphere 搭一个“小人”，每个关节是 `Group`（第 2 课的分层思想）
2. `quatTrack()` / `vecTrack()`：把关键帧表变成 Track
3. 四个 clip：`Idle`（2s）、`Walk`（1s）、`Run`（0.6s）、`Wave`（1.2s，一次性）
4. 每个 clip 一个 action，`Idle` 先播
5. `switchTo()`：reset → play → crossFadeTo
6. 循环里 `mixer.update( delta )`，HUD 显示各 action 的权重

---

## 6. 动手实验

| 实验 | 预期现象 | 说明 |
|---|---|---|
| 按 <kbd>2</kbd> 切 Walk | 手脚交替摆动，过渡平滑 | crossFade 0.3s |
| 按住 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 快速切换 | 动作会互相混合 | 权重叠加 |
| 按 <kbd>4</kbd> 挥手 | 举右手挥两下，然后回到 Idle | `finished` 事件 |
| 按 <kbd>空格</kbd> | 整个人冻住 | `mixer.timeScale = 0` |
| <kbd>↑</kbd> 加速 | 动作变快 | 时间缩放 |
| 控制台 `__anim.actions.Run.getEffectiveWeight()` | 切到 Run 后接近 1 | 权重可查 |
| 删掉循环里的 `mixer.update(delta)` | 完全不动 | 忘了推进时间 |

---

## 7. 自检

<details>
<summary>1. clip、action、mixer 三者的关系？</summary>

- `clip` 是**数据**（关键帧表），可以重复使用
- `action` 是**一次播放**，持有时间、权重、速度
- `mixer` 是**时钟**，每帧把所有 action 的时间推进，算出值写回对象

类比：clip 是乐谱，action 是一个演奏者，mixer 是指挥。
</details>

<details>
<summary>2. 为什么切换动作会“跳”一下？</summary>

因为直接 `stop()` 旧的、`play()` 新的，中间没有过渡：上一帧是 A 的姿势，下一帧直接变成 B 的起始姿势。

`crossFadeTo` 会在 N 秒内把 A 的权重从 1 降到 0、B 从 0 升到 1，混合两者的结果。
</details>

<details>
<summary>3. 一次性动作播完为什么不动了？</summary>

`LoopOnce` + `clampWhenFinished = true`：播到最后一帧就停住（clamp），不会回到开头。

想让它回到原位，就监听 `finished` 事件切到别的动作。
</details>

<details>
<summary>4. 同一个 clip 用在 10 个敌人身上，要注意什么？</summary>

```js
const clip = gltf.animations[ 0 ];

for ( const enemy of enemies ) {

	const mixer = new THREE.AnimationMixer( enemy );
	mixer.clipAction( clip ).play();

}
```

每个对象各自一个 **mixer**，但可以共用同一个 **clip**（clip 是只读数据）。

如果 10 个对象共用同一个 mixer，它们会同步播放——通常不是你要的。
</details>

---

## 8. 常见坑

| 现象 | 原因 | 修法 |
|---|---|---|
| 完全不动 | 忘了 `mixer.update(delta)` | 放进渲染循环 |
| 播一次就停 | `LoopOnce` | 改 `LoopRepeat` |
| 切动作跳跃 | 直接 stop/play | 用 `crossFadeTo` |
| 动作叠加混乱 | 多个循环动作同时 play | 只保留当前状态的 action |
| 找不到对象 | track 名与对象名不一致 | 打印 `object.name` 核对 |
| 动画速度不对 | 用了固定值而非 delta | 传 `clock.getDelta()` |
| 内存涨 | 切场景没 `mixer.stopAllAction()` | 连同 mixer 一起丢弃 |

---

## 9. 延伸

- `src/animation/AnimationMixer.js`、`AnimationClip.js`、`PropertyBinding.js`
- 官方示例：`webgl_animation_skinning_blending`
- 下一课：交互与射线拾取（`Raycaster`、点击选中、拖拽）
