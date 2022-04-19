const canvas = require("canvas");
const { join } = require('path');
const node_wordcloud = require(join(__dirname, "./node_wordcloud"));
const chineseColor = require(join(__dirname, "./chineseColor"));
const { registerFont, createCanvas, loadImage } = require('canvas');
registerFont(join(__dirname, '../assets/ZCOOLQingKeHuangYou-Regular.ttf'), { family: 'ZCOOLQingKeHuangYou' });
const cloadwidth = 1024,
	cloadHeight = 1024,
	padding = 10;
let cloudCanvas = createCanvas(cloadwidth, cloadHeight);
process.on('message', async data => {
	let { colorNum, newArr, bot, msg } = data;
	let newColor = function() {
		let colors = chineseColor[colorNum][1];
		colorNum++;
		if (colorNum === chineseColor.length) {
			colorNum = 0;
		}
		return colors;
	}
	// 调整缩放比例
	let weight = (cloadwidth + cloadHeight) / 4 / newArr[0][1]; // 以调用次数最多的词为基准缩放比例
	const option = {
		list: newArr,
		color: newColor,
		weightFactor: weight,
		shape: "square",
		ellipticity: 1, // 变形范围
		fontFamily: "ZCOOLQingKeHuangYou",
		shrinkToFit: true // 将过大的词组缩放后放入
	};
	await node_wordcloud(cloudCanvas, option, createCanvas);
	let newImage = createCanvas(cloadwidth + padding * 2, cloadHeight + padding * 2);
	const sendImage = newImage.getContext('2d');
	sendImage.fillStyle = "#ffffff";
	sendImage.fillRect(0, 0, newImage.width, newImage.height);
	loadImage(cloudCanvas.toBuffer("image/png")).then(async (image) => {
		sendImage.drawImage(image, padding, padding);
		process.send({ status: "ok", colorNum, imgData: newImage.toBuffer("image/png").toString("base64") });
	})
})