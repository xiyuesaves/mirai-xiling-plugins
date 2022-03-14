const { join } = require("path");
const db = require("better-sqlite3")(join(process.cwd(), "database/sleep.db"));
let onWeak = [];

function getSleep(groupId, userId) {
	return db.prepare("SELECT * FROM sleep WHERE groupId = ? AND userId = ?").get(groupId, userId);
}

function getBed(bed) {
	let text = "",
		count = 0;
	bed.forEach((el, index) => {
		if (el.startTime) {
			text += `${count ? "\n" : ""}${getStatus(el.startTime)} - ${el.userName}`;
			++count;
		}
	})
	return text;
}

function getStatus(time) {
	let thisTime = new Date(),
		sleepTime = new Date(time);
	if (thisTime - sleepTime > 6 * 60 * 60 * 1000) {
		return "(¦3[▓^]";
	} else if (thisTime - sleepTime > 2 * 60 * 60 * 1000) {
		return "(¦3[▓▓]";
	} else if (thisTime - sleepTime > 1 * 60 * 60 * 1000) {
		return "(:3[▓▓]";
	} else {
		return "(:3ꇤ[▓▓]";
	}
}

function getTime(seconds) {
	let ss = parseInt(seconds / 1000), // 秒
		mm = 0, // 分
		hh = 0; // 小时
	if (ss > 60) {
		mm = parseInt(ss / 60);
		ss = parseInt(ss % 60);
	}
	if (mm > 60) {
		hh = parseInt(mm / 60);
		mm = parseInt(mm % 60);
	}
	let result = ('00' + parseInt(ss)).slice(-2) + '秒';
	if (mm > 0) {
		result = ('00' + parseInt(mm)).slice(-2) + '分' + result;
	} else {
		result = '00:' + result;
	}
	if (hh > 0) {
		hh = hh.toString();
		if (hh.length >= 3) {
			result = hh + '时' + result;
		} else {
			result = ('00' + parseInt(hh)).slice(-2) + '时' + result;
		}
	}
	return result;
}

function wakeUp(msg) {
	let groupId = msg.sender.group.id,
		userId = msg.sender.id,
		userName = msg.sender.memberName,
		thisTime = new Date().getTime(),
		sleepTime = thisTime - getSleep(groupId, userId).startTime;
	onWeak.push({ "id": msg.sender.id, "weakTime": thisTime });
	if (thisTime === sleepTime) {
		msg.reply([{ type: "At", target: msg.sender.id }, { type: "Plain", text: `你因为睡得太久被踹下床了` }], msg);
	} else {
		msg.reply([{ type: "At", target: msg.sender.id }, { type: "Plain", text: `你醒了,睡了${getTime(sleepTime)}` }], msg);
		let totalSleep = db.prepare("SELECT * FROM sleep_ranking WHERE groupId = ? AND userId = ?").get(groupId, userId);
		if (totalSleep) {
			let totalTime = totalSleep.sleepTime + sleepTime;
			// console.log(totalTime, groupId, userId);
			db.prepare("UPDATE sleep_ranking SET sleepTime = ? WHERE groupId = ? AND userId = ?").run(totalTime, groupId, userId);
		} else {
			// console.log(groupId, userId, userName, sleepTime);
			db.prepare("INSERT INTO sleep_ranking VALUES (?,?,?,?)").run(groupId, userId, userName, sleepTime);
		}
	}
	db.prepare("DELETE FROM sleep WHERE groupId = ? AND userId = ? ").run(groupId, userId);
}

function cleanBed(msg) {
<<<<<<< HEAD
	let maxSleepTime = 24 * 60 * 60 * 1000, // 一次性最多睡24小时
		sleepWaiting = 2 * 60 * 1000, // 再次睡下前需要等待一定时间
=======
	let maxSleepTime = 24 * 60 * 60 * 1000, // 一次性最多睡12小时
>>>>>>> origin/main
		groupId = msg.sender.group.id,
		thisTime = new Date().getTime(),
		groupBed = db.prepare("SELECT * FROM sleep WHERE groupId = ?").all(groupId);
	groupBed.forEach(el => {
		if (thisTime - el.startTime > maxSleepTime && el.startTime !== 0) { // 开始睡觉时间为0则代表已经被丢下床了不用再丢一次
			db.prepare("UPDATE sleep SET startTime = ? WHERE groupId = ? AND userId = ?").run(0, groupId, el.userId); // 设置开始时间为不可能的数值用于判断用户状态
			let totalSleep = db.prepare("SELECT * FROM sleep_ranking WHERE groupId = ? AND userId = ?").get(groupId, el.userId);
			if (totalSleep) {
				let totalTime = totalSleep.sleepTime + maxSleepTime;
				db.prepare("UPDATE sleep_ranking SET sleepTime = ? WHERE groupId = ? AND userId = ?").run(totalTime, groupId, el.userId); // 将时间写入总睡觉时间内
			} else {
				db.prepare("INSERT INTO sleep_ranking VALUES (?,?,?,?)").run(groupId, el.userId, el.userName, maxSleepTime);
			}
		}
	});
	onWeak = onWeak.filter(el => thisTime - el.weakTime < sleepWaiting);
}

function getMedal(index) {
	let medal = ["🐷", "🥈", "🥉"];
	if (medal[index]) {
		return medal[index];
	}
	return index + 1;
}

const sleep = {
	name: "群睡觉",
	mounted() {
		// 初始化数据库
		db.prepare("CREATE TABLE IF NOT EXISTS sleep(\"groupId\" integer NOT NULL,\"userId\" integer NOT NULL,\"userName\" text NOT NULL,\"startTime\" integer NOT NULL)").run();
		db.prepare("CREATE TABLE IF NOT EXISTS sleep_ranking(\"groupId\" integer NOT NULL,\"userId\" integer NOT NULL,\"userName\" text NOT NULL,\"sleepTime\" integer NOT NULL)").run();
	},
	command: [{
			name: "床",
			exce(msg) {
				cleanBed(msg);
				let groupId = msg.sender.group.id,
					bed = db.prepare("SELECT * FROM sleep WHERE groupId = ?").all(groupId),
					text = getBed(bed);
				if (text.length) {
					msg.reply([{ type: "Plain", text }], msg);
				} else {
					msg.reply([{ type: "Plain", text: "没有人在床上" }], msg);
				}
			}
		}, {
			name: "睡觉",
			exce(msg) {
				cleanBed(msg);
				if (!onWeak.find((el) => el.id === msg.sender.id)) {
					let groupId = msg.sender.group.id,
						userId = msg.sender.id,
						userName = msg.sender.memberName,
						startTime = new Date().getTime();
					let bed = db.prepare("INSERT INTO sleep VALUES (?,?,?,?)").run(groupId, userId, userName, startTime);
					msg.reply([{ type: "Plain", text: "你睡下了" }], msg);
				} else {
					msg.reply([{ type: "Plain", text: "你才刚睡醒，等会再睡吧" }], msg);
				}
			}
		},
		{
			name: "睡觉排行",
			exce(msg) {
				cleanBed(msg);
				let groupId = msg.sender.group.id,
					ranking = db.prepare("SELECT * FROM sleep_ranking WHERE groupId = ?").all(groupId);
				ranking.sort((da, db) => db.sleepTime - da.sleepTime);
				let text = "猪猪排行\n";
				// 默认只展示前10名和自己的排位
				let showNum = ranking.length > 10 ? 10 : ranking.length;
				for (let i = 0; i < showNum; i++) {
					text += `${getMedal(i)} - ${ranking[i].userName} [${getTime(ranking[i].sleepTime)}]\n`;
				}
				let sort = ranking.findIndex(el => el.userId === msg.sender.id);
				if (sort > showNum) {
					text += "...\n";
					text += `${getMedal(sort)} - ${ranking[sort].userName} [${getTime(ranking[sort].sleepTime)}]`;
				}
				msg.reply([{ type: "Plain", text: text }], msg);
			}
		}
	],
	priority: {
		name: "自动起床",
		exce(msg) {
			let groupId = msg.sender.group.id,
				userId = msg.sender.id;
			if (getSleep(groupId, userId)) {
				cleanBed(msg);
				wakeUp(msg);
				return true;
			}
			return false;
		}
	}
}
module.exports = sleep;