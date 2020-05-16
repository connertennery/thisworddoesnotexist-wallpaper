const fs = require('fs');
const webshot = require('webshot-node');
const sharp = require('sharp');
const wallpaper = require('wallpaper');
const cheerio = require('cheerio');

const https = require('https');

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
				console.log(parsedData('.inner').contents());
			} catch (e) {
				console.error(e.message);
			}
		});
	})
	.on('error', (e) => {
		console.error(e);
	});

console.log('Grabbing new wallpaper!');

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
	tintEnabled: args.tintEnabled === true ? true : false,
	tintColor: args.tintColor,
	ratio: args.ratio > 0 ? args.ratio : 30,
};

const options = {
	quality: 100,
	customCSS: `
	li:nth-child(2) { 
		display: none;
	}`,
	captureSelector: '.inner',
};

webshot(
	'https://www.thisworddoesnotexist.com/',
	'fakeword.png',
	options,
	function (err) {}
);

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

const processImage = debounce(function () {
	const image = sharp('fakeword.png', { failOnError: false });

	image
		.metadata()
		.then((metadata) => {
			const newWidth = config.res.width * (config.ratio / 100);
			const newHeight = config.res.height * (config.ratio / 100);

			const horizontalExtension = Math.floor(
				(config.res.width - newWidth) / 2
			);
			const verticalExtension = Math.floor(
				(config.res.height - newHeight) / 2
			);
			const extendOptions = {
				top: verticalExtension,
				bottom: verticalExtension,
				left: horizontalExtension,
				right: horizontalExtension,
				background: '#08082d', //to keep tint consistent
			};
			return image
				.resize({
					width: newWidth,
					height: newHeight,
					fit: 'contain',
					background: '#08082d',
				})
				.extend(extendOptions);
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
