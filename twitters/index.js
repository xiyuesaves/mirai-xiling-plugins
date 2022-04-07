const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { join } = require("path");
const db = require("better-sqlite3")(join(process.cwd(), "database/twitters.db"));


let subscriptionList = [],
	bot = null,
	commandPrefix = "",
	devId = 0;

let options = {
	twiurl: "https://twitter.com/",
	absurl: "abs.twimg.com",
	pbsurl: "pbs.twimg.com",
	updateTime: 15 * 60 * 1000
}

// 订阅更新
async function autoUpdate(data) {
	for (var i = 0; i < data.length; i++) {
		let post = await getNewPost(data[i].subscriptionId);
		if (post) {
			if (post[0].releaseDate > data[i].lastUpdate) {
				await newPost(data[i], post[0]);
			}
		} else {
			console.log("[twitter] 订阅更新失败");
		}
	}
	setTimeout(() => {
		let newData = db.prepare("SELECT * FROM subscription").all();
		autoUpdate(newData);
	}, options.updateTime);
}

// 推送订阅更新
async function newPost(data, post) {
	console.log("推送更新");
	console.log(data);
	console.log(post);
	// 构建消息链
	let msgChain = [{ type: "Plain", text: `${post.nickname} ${post.isRetweeted ? "转推" : "发布"}新的推文啦~\n--------------------\n` }],
		subUserList = db.prepare("SELECT * FROM userList WHERE subId = ?").all(data.id),
		groupLIst = {};
	// 如果是转推则额外显示转推用户名
	if (post.isRetweeted) {
		msgChain.push({ type: "Plain", text: `@${post.user}\n` });
	}
	// 插入推文内容
	msgChain.push({ type: "Plain", text: post.plain });
	post.imgs.forEach(imgUrl => {
		msgChain.push({ type: "Image", url: imgUrl.replace(/pbs\.twimg\.com/g,options.pbsurl) });
	});
	if (post.media) {
		msgChain.push({ type: "Plain", text: "\n[媒体文件]请在客户端查看" });
	}
	if (post.quote) {
		msgChain.push({ type: "Plain", text: "\n[引用推文]请在客户端查看" });
	}
	msgChain.push({ type: "Plain", text: `\n原文地址:${post.raw}` });
	// 根据群分类
	subUserList.forEach(el => {
		if (groupLIst[el.groupId]) {
			groupLIst[el.groupId].push(el.userId);
		} else {
			groupLIst[el.groupId] = [];
			groupLIst[el.groupId].push(el.userId);
		}
	})
	for (const groupId in groupLIst) {
		let newMsgs = msgChain.map(el => el);
		groupLIst[groupId].forEach(el => {
			newMsgs.unshift({ type: "At", target: el },{ type: "Plain", text: `\n`});
		});
		await bot.sendGroupMessage(newMsgs, groupId);
	}
	db.prepare("UPDATE subscription SET lastUpdate = ? WHERE subscriptionId = ? AND id = ?").run(post.releaseDate, data.subscriptionId, data.id);
}


// 获取最新推文
async function getNewPost(id, showNum = 1) {
	let $ = null;
	let req = await axios.get(`${options.twiurl}${id}`).catch(err => { return { status: 400 } });
	if (req.status === 200) {
		$ = cheerio.load(req.data);
		let postNum = $(".stream ol .stream-item:not(.js-pinned)").length,
			loopNum = showNum > postNum ? postNum : showNum,
			postList = [];
		for (var i = 0; i < loopNum; i++) {
			let postEl = $(".stream ol .stream-item:not(.js-pinned):eq(0)"),
				post = {
					plain: postEl.find(".tweet-text").prop('firstChild').nodeValue,
					imgs: getImgSrc(postEl),
					isRetweeted: postEl.find(".tweet-context.with-icn").text().includes("Retweeted"),
					nickname: $(".ProfileHeaderCard-nameLink").text(),
					user: postEl.find(".fullname").text(),
					media: !!postEl.find(".content .is-video").length,
					quote: !!postEl.find(".content .QuoteTweet").length,
					releaseDate: postEl.find("[data-time-ms]").attr("data-time-ms"),
					raw: "https://www.twitter.com"+postEl.find("[data-permalink-path]").attr("data-permalink-path")
				}
			postList.push(post);
		}
		return postList;
	} else {
		return false;
	}

	// 提取图片链接
	function getImgSrc(postEl) {
		let imgEl = postEl.find(".content .AdaptiveMediaOuterContainer img"),
			imgs = [];
		imgEl.each(function() {
			imgs.push($(this).attr("src")+"?name=240x240");
		})
		return imgs;
	}
}

// 获取用户头像
async function getUserAvatar(userId) {
	console.log(`正在请求${userId}的主页,${options.twiurl}${userId}`)
	let req = await axios.get(`${options.twiurl}${userId}`).catch(err => { return { status: 404 } });
	if (req.status === 200) {
		let htmlStr = req.data;
		$ = cheerio.load(htmlStr),
			url = $(".ProfileCardMini-avatarImage").attr("src").replace(/pbs\.twimg\.com/g,options.pbsurl),
			tws = $("#content-main-heading").text();
		if (url) {
			if (tws === "This account's Tweets are protected.") {
				return 401;
			} else {
				return url;
			}
		} else {
			return 403;
		}
	} else {
		return 404;
	}
}

// 删除订阅
function delSubscription(name, msg) {
	let userId = msg.sender.id,
		groupId = msg.sender.group.id,
		checkData = db.prepare("SELECT * FROM subscription a, userList b WHERE a.id = b.subId AND a.subscriptionId = ? AND b.userId = ? AND b.groupId = ?").get(name, userId, groupId);
	if (checkData) {
		db.prepare("DELETE FROM userList WHERE subId = ? AND userId = ? AND groupId = ?").run(checkData.subId, userId, groupId);
		msg.quoteReply("删除订阅成功");
		// 判断还有没有人订阅这个用户, 没有则清除用户信息
		let check = db.prepare("SELECT * FROM userList WHERE subId = ?").get(checkData.id);
		if (!check) {
			db.prepare("DELETE FROM subscription WHERE id = ?").run(checkData.id);
		}
	} else {
		msg.quoteReply("你没有订阅此用户");
	}
}

// 管理员删除订阅
function delAllSubscription(name, msg) {
		checkData = db.prepare("SELECT * FROM subscription a, userList b WHERE a.id = b.subId AND a.subscriptionId = ? ").get(name);
	if (checkData) {
		db.prepare("DELETE FROM userList WHERE subId = ?").run(checkData.subId);
		db.prepare("DELETE FROM subscription WHERE id = ?").run(checkData.subId);
		msg.quoteReply(`已删除此id的所有订阅信息`);
	} else {
		msg.quoteReply("没有此id的订阅信息");
	}
}

// 添加订阅
async function addSubscription(name, msg) {
	let userId = msg.sender.id,
		groupId = msg.sender.group.id,
		checkData = db.prepare("SELECT * FROM subscription a, userList b WHERE a.id = b.subId AND a.subscriptionId = ? AND b.userId = ? AND b.groupId = ?").get(name, userId, groupId),
		subId = db.prepare("SELECT * FROM subscription WHERE subscriptionId = ?").get(name);
	if (!checkData) {
		if (!subId) {
			let thisTime = new Date().getTime();
			let post = await getNewPost(name, 1);
			if (post) {
				let lastUpdate = post[0].releaseDate
				lstcode = db.prepare("INSERT INTO subscription (subscriptionId,createTime,lastUpdate) VALUES (?,?,?)").run(name, thisTime, lastUpdate);
				db.prepare("INSERT INTO userList VALUES (?,?,?)").run(msg.sender.id, lstcode.lastInsertRowid, msg.sender.group.id);
				return 0;
			} else {
				return 1;
			}
		} else {
			db.prepare("INSERT INTO userList VALUES (?,?,?)").run(msg.sender.id, subId.id, msg.sender.group.id);
			return 0;
		}
	} else {
		return 2;
	}
}

const twitters = {
	name: "推特订阅",
	mounted(xilingOption, miraiBot) {
		try {
			options = require(join(process.cwd(), "./options/twitters.json"))
		} catch (err) {
			console.log("[twitter] 初始化配置信息")
			fs.writeFileSync(join(process.cwd(), "./options/twitters.json"), JSON.stringify(options, null, 4));
		}
		commandPrefix = xilingOption.commandPrefix;
		devId = xilingOption.dev;
		bot = miraiBot;
		// 初始化数据库
		db.prepare(`CREATE TABLE IF NOT EXISTS "subscription" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "subscriptionId" text NOT NULL, "createTime" integer NOT NULL, "lastUpdate" integer NOT NULL);`).run();
		db.prepare(`CREATE TABLE IF NOT EXISTS "userList" ("userId" integer NOT NULL,"subId" integer NOT NULL, "groupId" integer NOT NULL)`).run();
		subscriptionList = db.prepare("SELECT * FROM subscription").all();
		autoUpdate(subscriptionList);
	},
	command: [{
			name: "添加订阅",
			async exce(msg, parameter) {
				if (parameter.length !== 1) {
					msg.quoteReply(`${commandPrefix}添加订阅\n目标id`)
				} else {
					let avatarUrl = await getUserAvatar(parameter[0]);
					switch (avatarUrl) {
						case 404:
							msg.quoteReply("无法完成操作");
							break;
						case 403:
							msg.quoteReply("账号异常,无法订阅");
							break;
						case 401:
							msg.quoteReply("账号上锁,无法订阅");
							break;
						default:
							let static = await addSubscription(parameter[0], msg);
							switch (static) {
								case 0:
									msg.quoteReply([{ type: "Image", url: avatarUrl }, { type: "Plain", text: `订阅成功` }]);
									break;
								case 1:
									msg.quoteReply("网络错误,请重试");
									break;
								case 2:
									msg.quoteReply("你已经订阅过了");
									break;
							}
							break;
					}
				}
			}
		},
		{
			name: "删除订阅",
			exce(msg, parameter) {
				if (parameter.length === 1) {
					delSubscription(parameter[0], msg);
				} else if (parameter.length === 2) {
					if (parameter[1] === "强制") {
						if (msg.sender.id === devId) {
							delAllSubscription(parameter[0], msg);
						} else {
							msg.quoteReply(`你没有权限`);
						}
					}
				} else {
					msg.quoteReply(`${commandPrefix}删除订阅\n目标id`)
				}
			}
		}
	]
}

module.exports = twitters;
