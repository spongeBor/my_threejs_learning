import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 06 · glTF 与资源管线
 *
 * 三个本地模型（由 scripts/make-assets.mjs 生成）：
 *   1  cube.glb        2 KB      —— 最小可用模型
 *   2  knot.glb        5.8 MB    —— 看进度条
 *   3  hierarchy.glb   39 KB     —— 验证父子层级被完整导入
 *
 * 按键：
 *   1/2/3  加载模型
 *   R      重新加载（关掉缓存，看完整进度）
 *   W      线框
 *   B      包围盒（Box3Helper）
 *   X      释放当前模型（dispose 全部几何体/材质/贴图）
 *   H      切换灯光辅助
 *
 * 这一课要建立的认知：
 *   ① glb = 一个文件，内部是 JSON + 二进制块
 *   ② 加载是异步的，进度来自 XHR / fetch 的字节流
 *   ③ 模型进来的是"场景图"，遍历 + 改材质 + 释放都要自己写
 *   ④ 释放的不是 Object3D，而是它引用的 geometry / material / texture
 */

const hud = createHUD( {
	title: 'Lesson 06 · glTF 与资源管线',
	tips: [
		'<kbd>1</kbd> cube 2KB · <kbd>2</kbd> knot 5.8MB · <kbd>3</kbd> hierarchy 39KB',
		'<kbd>R</kbd> 重新加载 · <kbd>W</kbd> 线框 · <kbd>B</kbd> 包围盒',
		'<kbd>X</kbd> 释放模型 · <kbd>H</kbd> 灯光辅助',
	],
} );

const statsRow = document.createElement( 'div' );
statsRow.className = 'row';
statsRow.innerHTML = `
	模型 <b id="g-name">--</b> ·
	耗时 <b id="g-time">--</b><br>
	网格 <b id="g-mesh">0</b> ·
	三角 <b id="g-tri">0</b> ·
	纹理 <b id="g-tex">0</b>`;
document.getElementById( 'hud' ).appendChild( statsRow );

const nameEl = statsRow.querySelector( '#g-name' );
const timeEl = statsRow.querySelector( '#g-time' );
const meshEl = statsRow.querySelector( '#g-mesh' );
const triEl = statsRow.querySelector( '#g-tri' );
const texEl = statsRow.querySelector( '#g-tex' );

// 进度条（放在页面底部）
const barWrap = document.createElement( 'div' );
barWrap.id = 'load-bar';
barWrap.innerHTML = `
	<div class="label"><span id="bar-name">等待加载…</span><span id="bar-pct">0%</span></div>
	<div class="track"><div class="fill" id="bar-fill"></div></div>`;
document.body.appendChild( barWrap );

const barName = barWrap.querySelector( '#bar-name' );
const barPct = barWrap.querySelector( '#bar-pct' );
const barFill = barWrap.querySelector( '#bar-fill' );

// ---------------------------------------------------------------------------
// 场景
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x05070c );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 1000 );
camera.position.set( 2.6, 2.0, 3.4 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 1.0 ) );

const keyLight = new THREE.DirectionalLight( 0xfff2e0, 3.0 );
keyLight.position.set( 4, 6, 5 );
scene.add( keyLight );

const rimLight = new THREE.DirectionalLight( 0x88aaff, 1.2 );
rimLight.position.set( - 4, 2, - 5 );
scene.add( rimLight );

const helpers = new THREE.Group();
helpers.add( new THREE.AxesHelper( 2 ) );
helpers.add( new THREE.GridHelper( 12, 12, 0x1b2330, 0x121821 ) );
helpers.visible = false;
scene.add( helpers );

const grid = new THREE.GridHelper( 12, 12, 0x1b2330, 0x121821 );
grid.position.y = - 1.6;
scene.add( grid );

// ---------------------------------------------------------------------------
// 加载器
// ---------------------------------------------------------------------------
const manager = new THREE.LoadingManager();

// 多个文件时可以用总进度；这里只有一个文件，但接口是一样的
manager.onStart = ( url ) => {

	barName.textContent = url.split( '/' ).pop();
	barPct.textContent = '0%';
	barFill.style.width = '0%';

};

manager.onError = ( url ) => {

	barName.textContent = `加载失败：${ url }`;
	barFill.style.width = '100%';
	barFill.classList.add( 'err' );

};

const loader = new GLTFLoader( manager );

const ASSETS = {
	'1': { url: '/models/cube.glb', name: 'cube.glb' },
	'2': { url: '/models/knot.glb', name: 'knot.glb' },
	'3': { url: '/models/hierarchy.glb', name: 'hierarchy.glb' },
};

let current = null;          // 当前模型根节点
let boxHelper = null;
let wireframe = false;
const clock = new THREE.Clock();
let spin = 0;

function clearCurrent() {

	if ( ! current ) return;

	scene.remove( current );

	// 释放：Object3D 本身交给 GC，但 GPU 资源必须手动还
	current.traverse( ( obj ) => {

		if ( obj.isMesh ) {

			obj.geometry?.dispose();

			const mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
			for ( const m of mats ) {

				for ( const key of [ 'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap' ] ) {

					m?.[ key ]?.dispose();

				}

				m?.dispose();

			}

		}

	} );

	current = null;

	if ( boxHelper ) {

		scene.remove( boxHelper );
		boxHelper.geometry.dispose();
		boxHelper.material.dispose();
		boxHelper = null;

	}

}

function countStats( root ) {

	let meshes = 0;
	let triangles = 0;
	const textures = new Set();

	root.traverse( ( obj ) => {

		if ( ! obj.isMesh ) return;

		meshes ++;
		const g = obj.geometry;

		if ( g.index ) triangles += g.index.count / 3;
		else if ( g.attributes.position ) triangles += g.attributes.position.count / 3;

		const mats = Array.isArray( obj.material ) ? obj.material : [ obj.material ];
		for ( const m of mats ) {

			if ( m?.map ) textures.add( m.map );
			if ( m?.normalMap ) textures.add( m.normalMap );

		}

	} );

	return { meshes, triangles, textures: textures.size };

}

function fitCamera( root ) {

	const box = new THREE.Box3().setFromObject( root );
	const size = box.getSize( new THREE.Vector3() );
	const center = box.getCenter( new THREE.Vector3() );

	const radius = Math.max( size.x, size.y, size.z ) * 0.5 || 1;
	const distance = radius / Math.tan( ( camera.fov * Math.PI / 180 ) / 2 ) * 1.6;

	camera.position.set( center.x + distance * 0.6, center.y + distance * 0.45, center.z + distance * 0.9 );
	camera.near = Math.max( distance / 1000, 0.01 );
	camera.far = distance * 100;
	camera.updateProjectionMatrix();

	controls.target.copy( center );
	controls.update();

	return box;

}

function loadAsset( key ) {

	const asset = ASSETS[ key ];
	if ( ! asset ) return;

	clearCurrent();

	const started = performance.now();
	barFill.classList.remove( 'err' );
	barFill.style.width = '0%';

	loader.load(
		asset.url,

		( gltf ) => {

			const root = gltf.scene;
			scene.add( root );
			current = root;

			// 线框状态要延续到新模型
			root.traverse( ( obj ) => {

				if ( obj.isMesh ) obj.material.wireframe = wireframe;

			} );

			const box = fitCamera( root );
			const stats = countStats( root );
			const ms = performance.now() - started;

			nameEl.textContent = asset.name;
			timeEl.textContent = `${ ms.toFixed( 0 ) } ms`;
			meshEl.textContent = String( stats.meshes );
			triEl.textContent = stats.triangles.toLocaleString();
			texEl.textContent = String( stats.textures );

			barFill.style.width = '100%';
			barPct.textContent = '100%';

			if ( boxHelper ) {

				scene.remove( boxHelper );
				boxHelper.geometry.dispose();
				boxHelper.material.dispose();

			}

			boxHelper = new THREE.Box3Helper( box, 0x7ee787 );
			boxHelper.visible = showBox;
			scene.add( boxHelper );

			console.log( 'glTF 结构：', gltf );

		},

		( xhr ) => {

			if ( ! xhr.lengthComputable ) return;

			const pct = ( xhr.loaded / xhr.total ) * 100;
			barFill.style.width = `${ pct.toFixed( 1 ) }%`;
			barPct.textContent = `${ pct.toFixed( 0 ) }% (${ ( xhr.loaded / 1024 / 1024 ).toFixed( 2 ) } / ${ ( xhr.total / 1024 / 1024 ).toFixed( 2 ) } MB)`;

		},

		( err ) => {

			console.error( '加载失败', err );
			barName.textContent = '加载失败：先运行 pnpm assets 生成模型';
			barFill.classList.add( 'err' );
			barFill.style.width = '100%';

		},
	);

}

// ---------------------------------------------------------------------------
// 交互
// ---------------------------------------------------------------------------
let showBox = false;

window.addEventListener( 'keydown', ( e ) => {

	const k = e.key.toLowerCase();

	if ( k === '1' || k === '2' || k === '3' ) {

		loadAsset( k );

	} else if ( k === 'r' ) {

		// 关掉缓存，重新走一遍完整下载
		THREE.Cache.enabled = false;
		loadAsset( nameEl.textContent?.startsWith( 'knot' ) ? '2' : '1' );

	} else if ( k === 'w' ) {

		wireframe = ! wireframe;
		current?.traverse( ( obj ) => {

			if ( obj.isMesh ) obj.material.wireframe = wireframe;

		} );

	} else if ( k === 'b' ) {

		showBox = ! showBox;
		if ( boxHelper ) boxHelper.visible = showBox;

	} else if ( k === 'x' ) {

		clearCurrent();
		nameEl.textContent = '已释放';
		meshEl.textContent = '0';
		triEl.textContent = '0';
		texEl.textContent = '0';

	} else if ( k === 'h' ) {

		helpers.visible = ! helpers.visible;

	}

} );

// 默认加载小立方体
loadAsset( '1' );

// ---------------------------------------------------------------------------
// 循环
// ---------------------------------------------------------------------------
renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	spin += delta * 0.35;

	if ( current ) current.rotation.y = spin;

	controls.update();
	renderer.render( scene, camera );
	hud.tick( delta );

} );

window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// 控制台实验：
//   __gltf.loader           // 加载器
//   __gltf.current          // 当前模型根节点
//   __gltf.renderer.info.memory   // 纹理/几何体计数
//   __gltf.current.traverse(o => console.log(o.name, o.type))
window.THREE = THREE;
window.__gltf = { scene, camera, renderer, loader, get current() {

	return current;

} };
