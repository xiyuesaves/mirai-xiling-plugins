// 复读判断模块
let previousMessage = {}, // 上一条消息
	ignorant = {}, //  冷却期消息
	commend = false,
	commandPrefix = "",
	lastMsg = {},
	timeOut = 2 * 60 * 1000; // 冷却时间

// 判断是否处于冷却期
function includesMsg(replaceText, groupId) {
	let newTime = new Date().getTime(),
		newArr = [];
	for (var i = 0; i < ignorant[groupId].length; i++) {
		if (timeOut > newTime - ignorant[groupId][i].time) {
			newArr.push(ignorant[groupId][i]);
		}
	}
	ignorant[groupId] = newArr;
	// 判断消息是否在数组内
	return ignorant[groupId].find(el => {
		return el.msg === replaceText;
	})
}

// 清除图片中的imageId
function delImageId(messageChain) {
	return messageChain.map(element => {
		delete element.imageId;
		return element;
	})
}

// 不复读含有特定单词的消息
function stopWord(replaceText) {
	let stopArr = ["QQ红包", "type: 'App'", "你的QQ暂不支持", "视频", "FlashImage"]
	return stopArr.find(el => {
		return replaceText.includes(el);
	})
}

const replace = {
	name: "复读机",
	mounted(options) {
		commandPrefix = new RegExp(`^${options.commandPrefix}`);
	},
	priority: {
		name: "命令检测",
		exce: (msg) => {
			let msgs = lastMsg;
			lastMsg = msg;
			if (commandPrefix.test(msgs.plain)) {
				commend = true;
			} else {
				commend = false;
			}
			return false;
		}
	},
	passive: {
		name: "复读机",
		exce: (msg) => {
			// 如果上一条消息是命令,则不触发复读
			if (commend) {
				return true;
			}
			let groupId = msg.sender.group.id,
				messageChain = msg.messageChain,
				replaceText = JSON.stringify(messageChain).replace(/{"type":"Source".+?},|"url":".+?,"/g, "");
			if (!ignorant[groupId]) {
				ignorant[groupId] = [];
			}
			// 判断两条消息是否一致
			if (replaceText === previousMessage[groupId] && !stopWord(replaceText)) {
				previousMessage[groupId] = "";
				let time = new Date().getTime();
				if (includesMsg(replaceText, groupId)) {
					previousMessage[groupId] = replaceText;
					return true;
				} else {
					ignorant[groupId].push({ msg: replaceText, time: time });
				}
				let msgChain = delImageId(messageChain);
				msg.reply(msgChain, msg);
			} else {
				previousMessage[groupId] = replaceText;
				lastMsgId = messageChain[0].id;
			}
			return true;
		}
	}
}

module.exports = replace;