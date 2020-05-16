const fs = require('fs');
const webshot = require('webshot');
const sharp = require('sharp');
const wallpaper = require('wallpaper');

console.log(process.argv);

const config = {
	res: {
		width: 2560,
		height: 1440,
	},
	tintEnabled: true,
	tintColor: { r: 130, g: 0, b: 190 },
};

const options = {
	windowSize: { width: 800, height: 800 },
	quality: 100,
	customCSS: `li:nth-child(2) { 
		display: none;
	}`,
	captureSelector: '.inner',
};

webshot('https://www.thisworddoesnotexist.com/', 'fakeword.png', options, function (err) {
	console.error(err);
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

const processImage = debounce(function () {
	const image = sharp('fakeword.png', { failOnError: false });

	image
		.metadata()
		.then((metadata) => {
			const verticalExtension = Math.floor(config.res.height / 2 - metadata.height / 2);
			const horizontalExtension = Math.floor(config.res.width / 2 - metadata.width / 2);
			const extendOptions = {
				top: verticalExtension,
				bottom: verticalExtension,
				left: horizontalExtension,
				right: horizontalExtension,
				background: '#08082d', //to keep tint consistent
			};
			console.log(extendOptions);
			return image.extend(extendOptions);
		})
		.then((image) => {
			if (config.tintEnabled) image = image.tint(config.tintColor);
			image
				.toFile('fakeword-final.png', { quality: 100 })
				.then((info) => {
					console.log(info);
					(async () => {
						await wallpaper.set('fakeword-final.png');
						watcher.close();
					})();
				})
				.catch((err) => console.error(err));
		});
}, 100);
