const db = require("better-sqlite3")("database/sleep.db");

function hasSleep(groupId, userId) {
	return db.prepare("SELECT * FROM sleep WHERE groupId = ? AND userId = ?").get(groupId, userId);
}

function getBed(bed) {
	let text = "";
	bed.forEach((el, index) => {
		text += `${index ? "\n" : ""}${getStatus(el.startTime)} - ${el.userName}`;
	})
	return text;
}

function getStatus(time) {
	let thisTime = new Date(),
		sleepTime = new Date(time);
	if (thisTime - sleepTime > 6 * 60 * 60 * 1000) {
		return "Zz...(¦3[▓^]";
	} else if (thisTime - sleepTime > 2 * 60 * 60 * 1000) {
		return "    (¦3[▓▓]";
	} else if (thisTime - sleepTime > 1 * 60 * 60 * 1000) {
		return "    (:3[▓▓]";
	} else {
		return "    (:3ꇤ[▓▓]";
	}
}

const sleep = {
	name: "群睡觉",
	mounted() {
		// 初始化数据库
		db.prepare("CREATE TABLE IF NOT EXISTS sleep(\"groupId\" integer NOT NULL,\"userId\" integer NOT NULL,\"userName\" text NOT NULL,\"startTime\" integer NOT NULL)").run();
	},
	command: [{
		name: "床",
		exce(msg) {
			let groupId = msg.sender.group.id,
				bed = db.prepare("SELECT * FROM sleep WHERE groupId = ?").all(groupId);
			if (bed.length) {
				let text = getBed(bed);
				msg.reply([{ type: "Plain", text: text }], msg);
			} else {
				msg.reply([{ type: "Plain", text: "没有人在床上" }], msg);
			}
		}
	}, {
		name: "睡觉",
		exce(msg) {
			let groupId = msg.sender.group.id,
				userId = msg.sender.id,
				userName = msg.sender.memberName,
				startTime = new Date().getTime();
			if (!hasSleep(groupId, userId)) {
				let bed = db.prepare("INSERT INTO sleep VALUES (?,?,?,?)").run(groupId, userId, userName, startTime);
				msg.reply([{ type: "Plain", text: "你睡下了" }], msg);
			} else {
				msg.reply([{ type: "Plain", text: "你已经睡下了" }], msg);
			}
		}
	}, {
		name: "起床",
		exce(msg) {
			let groupId = msg.sender.group.id,
				userId = msg.sender.id,
				userName = msg.sender.memberName,
				startTime = new Date().getTime();
			if (hasSleep(groupId, userId)) {
				let bed = db.prepare("DELETE FROM sleep WHERE groupId = ? AND userId = ? ").run(groupId, userId);
				msg.reply([{ type: "Plain", text: "你起床了" }], msg);
			} else {
				msg.reply([{ type: "Plain", text: "你还没睡" }], msg);
			}
		}
	}],
	passive: {
		name: "自动起床",
		exce(msg) {
			let groupId = msg.sender.group.id,
				userId = msg.sender.id,
				userName = msg.sender.memberName;
			if (hasSleep(groupId, userId)) {
				let bed = db.prepare("DELETE FROM sleep WHERE groupId = ? AND userId = ? ").run(groupId, userId);
				msg.quoteReply([{ type: "Plain", text: "你起床了" }], msg);
			}
			return true;
		}
	}
}
module.exports = sleep;