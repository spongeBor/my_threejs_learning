/**
 * 极简 HUD：标题 + 操作提示 + FPS。
 * 每节课都会用到，抽出来是为了让 lesson 文件只剩"这节课想讲的东西"。
 */
export function createHUD( { title, tips = [] } ) {

	const hud = document.createElement( 'div' );
	hud.id = 'hud';
	hud.innerHTML = `
		<h1>${ title }</h1>
		${ tips.map( ( t ) => `<div class="row">${ t }</div>` ).join( '' ) }
		<div class="row">FPS <b id="fps">--</b></div>
	`;
	document.body.appendChild( hud );

	const fpsEl = hud.querySelector( '#fps' );
	let frames = 0;
	let acc = 0;

	return {
		tick( delta ) {

			frames ++;
			acc += delta;
			if ( acc >= 0.5 ) {

				fpsEl.textContent = Math.round( frames / acc );
				frames = 0;
				acc = 0;

			}

		},
	};

}
