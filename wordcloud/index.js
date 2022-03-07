const node_wordcloud = require("./lib/node_wordcloud");
const chineseColor = require("./lib/chineseColor");
const nodejieba = require("nodejieba");
const canvas = require("canvas");
const { join } = require('path');
const db = require("better-sqlite3")(join(process.cwd(), "database/wordcloud.db"));
const { registerFont, createCanvas, loadImage } = require('canvas');

const fontList = [
    './assets/ZCOOLKuaiLe-Regular.ttf',
    './assets/ZCOOLXiaoWei-Regular.ttf',
    './assets/ZCOOLQingKeHuangYou-Regular.ttf'
]

let fontName = [];

fontList.forEach((fontPath, index) => {
    let name = `font${index}`;
    registerFont(join(__dirname, fontPath), { family: name });
    fontName.push(name);
})

let bot = null,
    working = false,
    limitingArr = [],
    stopwords = ["新版手机", "暂不支持", "视频短片", "chingchong"];

// 防抖算法,阻止刷词
function limiting(groupId, str, time) {
    if (limitingArr[groupId]) {
        let result = false
        limitingArr[groupId].forEach((list, index) => {
            if (list.plain === str && (time - list.time) <= 60 * 1000) {
                console.log("[词云] 阻止增加权重", str, list)
                result = true
            } else if ((time - list.time) >= 120000) {
                console.log("[词云] 删除已过期数据", limitingArr[groupId][index])
                limitingArr[groupId].splice(index, 1)
            }
        })
        if (!result) {
            limitingArr[groupId].push({ plain: str, time: time })
            console.log("[词云] 添加新数据", { plain: str, time: time })
        }
        return result
    } else {
        if (!limitingArr[groupId]) {
            limitingArr[groupId] = []
            limitingArr[groupId].push({ plain: str, time: time })
            console.log("[词云] 初始化数组", limitingArr[groupId])
        }
        return false
    }
}

// 停止词检测[暂时停用]
function stopWords(str) {
    let isOk = true;
    for (var i = 0; i < stopwords.length; i++) {
        if (stopwords[i].includes(stops)) {
            console.log("[词云] 消息含有停止词", stops);
            isOk = false;
            break;
        }
    }
    return isOk;
}

// 获取随机字体
function getFonts() {
    let name = "";
    name = fontName[Math.floor(Math.random() * fontName.length)];
    return name;
}

// 从中国色中随机选择位置顺序获取颜色
let colorNum = 0,
    newColor = function() {
        let colors = chineseColor[colorNum][1];
        colorNum++;
        if (colorNum === chineseColor.length) {
            colorNum = 0;
        }
        return colors;
    }


const wordcloud = {
    name: "词云",
    mounted(options, miraiBot) {
        db.prepare("CREATE TABLE IF NOT EXISTS wordcloud(\"groupId\" INTEGER NOT NULL,\"plain\" TEXT NOT NULL,\"time\" integer NOT NULL)").run();
        bot = miraiBot;
    },
    passive: {
        name: "词云数据采集",
        exce(msg) {
            let newTime = new Date().getTime(),
                groupId = msg.sender.group.id,
                plain = msg.plain;
            if (plain.length && !limiting(groupId, plain, newTime)) {
                db.prepare("INSERT INTO wordcloud (groupId,plain,time) VALUES (?,?,?)").run(groupId, plain, newTime);
            }
            return true;
        }
    },
    command: {
        name: "词云",
        exce: async (msg, parameter) => {
            if (working) {
                msg.reply([{ type: "Plain", text: "处理中..." }], msg);
                return false;
            }
            working = true;
            let times = 0;
            switch (parameter[0]) {
                case "今日":
                    times = 1;
                    break;
                case "本周":
                    times = 7;
                    break;
                case "本月":
                    times = 30;
                    break;
            }
            const cloadwidth = 1024,
                cloadHeight = 1024,
                padding = 10,
                canvas = createCanvas(cloadwidth, cloadHeight);

            let groupId = msg.sender.group.id,
                endTime = new Date().getTime(),
                startTime = times !== 0 ? endTime - times * 86400000 : 0,
                dbSearch = db.prepare("SELECT plain FROM wordcloud WHERE groupId = ? AND time >= ? AND time <= ?").all(groupId, startTime, endTime),
                list = [],
                num = [],
                ins = 0,
                result = [];
            // 提取单词数组
            dbSearch.forEach(data => {
                nodejieba.extract(data.plain, 5).forEach(json => {
                    result.push(json.word);
                })
            })
            // 数组去重,增加权重
            result.forEach((str, indexs) => {
                let index = list.indexOf(str);
                if (index === -1) {
                    list.push(str);
                    num[ins] = [];
                    num[ins][0] = str;
                    num[ins][1] = 1;
                    ins++;
                } else {
                    num[index][1]++;
                }
            })
            // 数组排序
            num.sort((a, b) => {
                return b[1] - a[1];
            })
            // 裁剪数组长度
            let newArr = num.slice(0, 150);
            if (!newArr.length) {
                newArr.push(["暂无内容", 1]);
            }
            // 调整缩放比例
            let weight = (cloadwidth + cloadHeight) / 4 / newArr[0][1]; // 以调用次数最多的词为基准缩放比例
            const option = {
                list: newArr,
                // color: "random-light",
                color: newColor,
                weightFactor: weight,
                shape: "square",
                ellipticity: 1, // 变形范围
                fontFamily: getFonts(),
                shrinkToFit: true // 将过大的词组缩放后放入
            };
            // 生成词云
            await node_wordcloud(canvas, option, createCanvas);
            const newImage = createCanvas(cloadwidth + padding * 2, cloadHeight + padding * 2);
            const sendImage = newImage.getContext('2d');
            sendImage.fillStyle = "#ffffff";
            sendImage.fillRect(0, 0, newImage.width, newImage.height);
            loadImage(canvas.toBuffer("image/png")).then(async (image) => {
                sendImage.drawImage(image, padding, padding);
                await bot.sendImageMessage(newImage.toBuffer("image/png"), msg);
                working = false;
            })
        }
    }
}
module.exports = wordcloud;