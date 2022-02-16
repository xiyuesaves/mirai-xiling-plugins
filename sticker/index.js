const { registerFont, createCanvas, loadImage } = require('canvas');
const { join } = require('path');

const akiCanvas = require("./5000choyen-nodejs/akiCanvas");

registerFont(join(__dirname, './assets/AlibabaPuHuiTi-2-85-Bold.ttf'), { family: "AlibabaPuHuiTi" });
registerFont(join(__dirname, './assets/NotoSerifSC-Regular.otf'), { family: "NotoSerifSC" });

function getFirstImage(messageChain) {
    for (var i = 0; i < messageChain.length; i++) {
        if (messageChain[i].type === "Image") {
            return messageChain[i].url;
        }
    }
    return false;
}

let bot = null,
    rendering = false;

const sticker = {
    name: "表情包生成",
    mounted(options, miraiBot) {
        bot = miraiBot;
    },
    command: [{
        name: "黑白",
        exce: async (msg, parameter) => {
            if (rendering) {
                msg.reply([{ type: "Plain", text: "处理中..." }], msg);
                return false;
            }
            rendering = true;
            let messageChain = msg.messageChain;
            let imageLink = getFirstImage(messageChain);
            if (imageLink && parameter.length === 1) {
                loadImage(imageLink).then((image) => {
                    // 处理成黑白图片
                    greyCanvas = createCanvas(image.width, image.height)
                    greyCtx = greyCanvas.getContext('2d');
                    greyCtx.drawImage(image, 0, 0);
                    let img = greyCtx.getImageData(0, 0, greyCanvas.width, greyCanvas.height);
                    imgbit = greyCanvas.width * greyCanvas.height;
                    for (var i = 0; i < imgbit * 4; i += 4) {
                        let grey = parseInt((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3);
                        img.data[i] = grey;
                        img.data[i + 1] = grey;
                        img.data[i + 2] = grey;
                    }
                    greyCtx.putImageData(img, 0, 0);
                    loadImage(greyCanvas.toBuffer("image/png")).then((image) => {
                        // 测量文本宽度
                        let ctxWidth = 240,
                            ctxHeight = image.height * (ctxWidth / image.width),
                            newStr = [],
                            renderText = parameter[0],
                            fontHeight = 35,
                            fontSize = 26,
                            lineBreak = 0;
                        greyCtx.font = `${fontSize}px AlibabaPuHuiTi`;
                        greyCtx.textAlign = "center";
                        for (var i = 0; i < renderText.length; i++) {
                            let textMetrics = greyCtx.measureText(renderText.substr(lineBreak, i - lineBreak));
                            if (textMetrics.width > ctxWidth) {
                                newStr.push(renderText.substr(lineBreak, i - lineBreak - 1));
                                lineBreak = i - 1;
                            }
                        }
                        newStr.push(renderText.substr(lineBreak));
                        let canvas = createCanvas(ctxWidth, ctxHeight + fontHeight * newStr.length),
                            ctx = canvas.getContext('2d');
                        ctx.fillStyle = "#000";
                        ctx.fillRect(0, ctxHeight, ctxWidth, ctxHeight + fontHeight * newStr.length);
                        ctx.fillStyle = "#fff";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.font = `${fontSize}px AlibabaPuHuiTi`;
                        for (var i = 0; i < newStr.length; i++) {
                            ctx.fillText(newStr[i], ctxWidth / 2, (ctxHeight + 35 / 2) + 35 * i);
                        }
                        ctx.drawImage(image, 0, 0, ctxWidth, ctxHeight);
                        bot.sendImageMessage(canvas.toBuffer("image/png"), msg);
                        rendering = false;
                    }).catch(err => {
                        console.log(err);
                        msg.reply([{ type: "Plain", text: "图片生成出错" }], msg);
                        rendering = false;
                    })
                }).catch(err => {
                    console.log(err);
                    msg.reply([{ type: "Plain", text: "图片下载失败" }], msg);
                    rendering = false;
                })
            } else {
                msg.reply([{ type: "Plain", text: "#黑白\n文本\n[图片]" }], msg);
                rendering = false;
            }
            console.log(msg, parameter, imageLink);
        }
    }, {
        // 此功能核心实现来自
        // 5000choyen-nodejs
        // https://github.com/Akegarasu/5000choyen-nodejs
        name: "5000",
        exce: (msg, parameter) => {
            if (parameter.length !== 2) {
                msg.reply([{ type: "Plain", text: "#5000\n文本1\n文本2" }], msg);
                return false;
            }
            if (rendering) {
                msg.reply([{ type: "Plain", text: "处理中..." }], msg);
                return false;
            }
            rendering = true;

            // 计算第二排文本位移
            let canvas = createCanvas(0, 0);
            ctx = canvas.getContext("2d");
            ctx.font = '100px notobk,Source Han Sans CN,sans-serif';
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            let width = ctx.measureText(parameter[0] + parameter[1]).width,
                bottomX = ctx.measureText(parameter[0]).width - 70;
            // 生成图片
            let image = new akiCanvas(width, 280);
            image.redrawTop(parameter[0]);
            image.redrawBottom(bottomX, parameter[1]);
            bot.sendImageMessage(image.canvas.toBuffer("image/png"), msg);
            rendering = false;
        }
    }]
}

module.exports = sticker;