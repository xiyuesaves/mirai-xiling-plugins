const nodejieba = require("nodejieba");
const { join } = require('path');
const db = require("better-sqlite3")(join(process.cwd(), "database/wordcloud.db"));
// 子进程功能
const { fork } = require('child_process');


let bot = null,
	working = false,
	limitingArr = [],
	stopwords = ["新版手机", "暂不支持", "视频", "chingchong"];

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
		if (str.includes(stopwords[i])) {
			console.log("[词云] 消息含有停止词", stopwords[i]);
			isOk = false;
			break;
		}
	}
	return isOk;
}

// 从中国色中随机选择位置顺序获取颜色
let colorNum = 0;
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

			let groupId = msg.sender.group.id,
				endTime = new Date().getTime(),
				startTime = times !== 0 ? endTime - times * 86400000 : 0,
				dbSearch = db.prepare("SELECT plain FROM wordcloud WHERE groupId = ? AND time >= ? AND time <= ?").all(groupId, startTime, endTime),
				list = [],
				num = [],
				ins = 0,
				result = [];
			// 提取单词数组
			await new Promise((res, rej) => {
				const forked = fork(join(__dirname, '/lib/jieba.js'));
				forked.send(dbSearch);
				forked.on('message', (msg) => {
					console.log(`子进程完成分词，共 ${msg.length} 词`);
					result = msg;
					msg = null;
					forked.disconnect();
					res();
				});
				forked.on('error', err => {
					console.log("词云出错")
					console.log(err)
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
			result = null;
			// 数组排序
			num.sort((a, b) => {
				return b[1] - a[1];
			})
			// 裁剪数组长度
			let newArr = num.slice(0, 150);
			num = null;
			if (!newArr.length) {
				newArr.push(["暂无内容", 1]);
			}

			// [子进程]生成词云
			const forked = fork(join(__dirname, '/lib/getCanvas.js'));
			forked.send({
				colorNum,
				newArr,
				bot,
				msg
			});
			forked.on('message', data => {
				console.log(`[词云]子进程完成图片处理`);
				forked.disconnect();
				working = false;
				colorNum = data.colorNum;
				bot.sendImageMessage(new Buffer.from(data.imgData, 'base64'), msg);
			});
		}
	}
}
module.exports = wordcloud;