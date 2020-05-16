const fs = require('fs');
const webshot = require('webshot-node');
const sharp = require('sharp');
const wallpaper = require('wallpaper');
const cheerio = require('cheerio');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');

const DEBUG_LINES = false;

const parseArgv = (input) => {
	let resIndex, resSplit, width, height;
	let tintIndex,
		tintSplit,
		r = 0,
		g = 0,
		b = 0;
	let ratioIndex, ratio;

	resIndex = input.indexOf('-res');
	if (resIndex > 0) {
		resSplit = input[resIndex + 1].split(',');
		width = parseInt(resSplit[0].trim());
		height = parseInt(resSplit[1].trim());
	}

	tintIndex = input.indexOf('-tint');
	if (tintIndex > 0) {
		tintSplit = input[tintIndex + 1].split(',');
		r = tintSplit[0].trim();
		g = tintSplit[1].trim();
		b = tintSplit[2].trim();
	}

	ratioIndex = input.indexOf('-ratio');
	if (ratioIndex > 0) {
		ratio = parseInt(input[ratioIndex + 1].trim());
	}

	return {
		res: {
			width: width,
			height: height,
		},
		tintEnabled: tintIndex > 0 ? true : false,
		tintColor: { r: r, g: g, b: b },
		ratio: ratio,
	};
};

let args = parseArgv(process.argv);

const config = {
	res: {
		width: args.res.width > 0 ? args.res.width : 2560,
		height: args.res.height > 0 ? args.res.height : 1440,
	},
	colors: {
		main: '#fff',
		accent: 'hsla(0,0%,100%,.5)',
		background: '#08082d',
	},
	font: {
		size: {
			word: '4.5em',
			pos: '1em',
			syllables: '1.8em',
			definition: '1.4em',
			example: '1.4em',
		},
		family: '-apple-system,BlinkMacSystemFont,sans-serif',
	},
	tintEnabled: args.tintEnabled === true ? true : false,
	tintColor: args.tintColor,
	ratio: args.ratio > 0 ? args.ratio : 30,
};

console.log('Grabbing new wallpaper!');

https
	.get('https://www.thisworddoesnotexist.com/', (res) => {
		//   console.log('statusCode:', res.statusCode);
		//   console.log('headers:', res.headers);
		res.setEncoding('utf8');
		let rawData = '';

		res.on('data', (chonk) => {
			rawData += chonk;
		});
		res.on('end', () => {
			try {
				const parsedData = cheerio.load(rawData); //HTML parse
				const pos = parsedData('#definition-pos')[0].children[0].data.trim();
				const word = parsedData('#definition-word')[0].children[0].data.trim();
				const syllables = parsedData('#definition-syllables')[0].children.reduce(
					(all, curr) => (curr.type === 'text' ? (all += curr.data.trim()) : (all += ' · ')),
					''
				);
				const definition = parsedData('#definition-definition')[0].children[0].data.trim();
				const example = parsedData('#definition-example')[0].children[0].data.trim();

				createImage({
					pos: pos,
					word: word,
					syllables: syllables,
					definition: definition,
					example: example,
				});
			} catch (e) {
				console.error(e.message);
			}
		});
	})
	.on('error', (e) => {
		console.error(e);
	});

const watcher = fs.watch('./', (eventType, filename) => {
	if (filename) {
		if (eventType !== 'change' || filename !== 'fakeword.png') return;

		processImage();
	}
});

const debounce = (func, time) => {
	let debounceTimer;
	return function () {
		const context = this;
		const args = arguments;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => func.apply(context, args), time);
	};
};

//Taken from https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/
const wrapText = (context, text, x, y, maxWidth) => {
	let lineHeight = Math.floor(context.measureText(text).emHeightAscent * 1.1);
	let words = text.split(' ');
	let line = '';

	for (let n = 0; n < words.length; n++) {
		let testLine = line + words[n] + ' ';
		let metrics = context.measureText(testLine);
		let testWidth = metrics.width;
		if (testWidth > maxWidth && n > 0) {
			context.fillText(line, x, y);
			line = words[n] + ' ';
			y += lineHeight;
		} else {
			line = testLine;
		}
	}
	context.fillText(line, x, y);
	return y;
};

const createImage = (definition) => {
	const scale = 1;
	const canvasWidth = config.res.width * scale;
	const canvasHeight = config.res.height * scale;
	const canvas = createCanvas(canvasWidth, canvasHeight);
	const ctx = canvas.getContext('2d');

	ctx.fillStyle = config.colors.background;
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);

	let leftAlign, leftOffset, verticalAlign, wrapWidth; //I know these are different.
	verticalAlign = canvasHeight / 3;

	//! 2 word
	//#region word
	ctx.font = `${config.font.size.word} ${config.font.family}`;
	ctx.strokeStyle = config.colors.main;
	ctx.fillStyle = config.colors.main;
	let wordMeasure = ctx.measureText(definition.word);
	leftAlign = Math.floor(canvasWidth / 2 - wordMeasure.width * 0.75);
	leftOffset = Math.floor(wordMeasure.width * 0.1);
	wrapWidth = Math.floor(Math.max(wordMeasure.width * 1.5, canvasWidth * 0.3));
	ctx.fillText(definition.word, leftAlign - wordMeasure.width * 0.01, verticalAlign);
	//#endregion

	//! 1 pos
	//#region pos
	verticalAlign -= Math.round(verticalAlign * 0.02);
	ctx.font = `${config.font.size.pos} ${config.font.family}`;
	ctx.strokeStyle = config.colors.accent;
	ctx.fillStyle = config.colors.accent;
	ctx.fillText(definition.pos, leftAlign, verticalAlign * 0.8);
	//#endregion

	//! 3 syllables
	//#region syllables
	if (definition.syllables.length > 0) {
		verticalAlign += Math.round(verticalAlign * 0.17);
		ctx.font = `bold ${config.font.size.syllables} ${config.font.family}`;
		ctx.strokeStyle = config.colors.main;
		ctx.fillStyle = config.colors.main;
		ctx.fillText(definition.syllables, leftAlign, verticalAlign);
	}
	//#endregion

	//! 4 definition
	//#region definition
	verticalAlign +=
		definition.syllables.length > 0 ? Math.round(verticalAlign * 0.11) : Math.round(verticalAlign * 0.18);
	ctx.font = `100 ${config.font.size.definition} ${config.font.family}`;
	ctx.strokeStyle = config.colors.main;
	ctx.fillStyle = config.colors.main;
	verticalAlign = wrapText(ctx, definition.definition, leftAlign + leftOffset, verticalAlign, wrapWidth);
	//#endregion

	//! 5 example
	//#region example
	// verticalAlign += definition.syllables.length > 0 ? verticalAlign * 0.11 : verticalAlign * 0.18;
	verticalAlign += Math.round(verticalAlign * 0.08);
	ctx.font = `100 italic ${config.font.size.example} ${config.font.family}`;
	ctx.strokeStyle = config.colors.accent;
	ctx.fillStyle = config.colors.accent;
	verticalAlign = wrapText(ctx, definition.example, leftAlign + leftOffset, verticalAlign, wrapWidth);
	//#endregion

	//#region Draw crosshair
	if (DEBUG_LINES) {
		ctx.strokeStyle = 'rgba(255,0,0,0.5)';
		ctx.beginPath();

		ctx.moveTo(canvasWidth / 2, 0);
		ctx.lineTo(canvasWidth / 2, canvasHeight);

		ctx.moveTo(0, canvasHeight / 2);
		ctx.lineTo(canvasWidth, canvasHeight / 2);

		ctx.moveTo(leftAlign, 0);
		ctx.lineTo(leftAlign, canvasHeight);
		ctx.stroke();
	}
	//#endregion

	const out = fs.createWriteStream('fakeword.png');
	const stream = canvas.createPNGStream();
	stream.pipe(out);
	out.on('finish', () => processImage());
};

const processImage = debounce(function () {
	const image = sharp('fakeword.png', { failOnError: false });

	image
		.metadata()
		.then((metadata) => {
			//Legacy
			// const newWidth = config.res.width * (config.ratio / 100);
			// const newHeight = config.res.height * (config.ratio / 100);

			// const horizontalExtension = Math.floor((config.res.width - newWidth) / 2);
			// const verticalExtension = Math.floor((config.res.height - newHeight) / 2);
			// const extendOptions = {
			// 	top: verticalExtension,
			// 	bottom: verticalExtension,
			// 	left: horizontalExtension,
			// 	right: horizontalExtension,
			// 	background: '#08082d', //to keep tint consistent
			// };
			return image;
			// .resize({
			// 	width: config.res.width,
			// 	height: config.res.height,
			// 	fit: 'contain',
			// 	background: '#08082d',
			// });
			// .extend(extendOptions);
		})
		.then((image) => {
			if (config.tintEnabled) image = image.tint(config.tintColor);
			image
				.toFile('fakeword-final.png', { quality: 100 })
				.then((info) => {
					(async () => {
						await wallpaper.set('fakeword-final.png');
						watcher.close();
					})();
				})
				.catch((err) => console.error(err));
		});
}, 100);
