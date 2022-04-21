// 基础演示插件
const axios = require("axios");
let bot = null;
const moyu = {
	name: "摸鱼日历",
	mounted(options, miraiBot) {
		bot = miraiBot;
	},
	command: [{ // 命令方法, 需要主动使用命令来唤醒执行, 此处需要使用"#方法1"来激活
		name: "摸鱼",
		async exce(msg, parameter) {
			let axiosOption = {
					url: "https://api.vvhan.com/api/moyu",
					methods: "GET",
					responseType: "arraybuffer"
				},
				img = await axios(axiosOption);
			if (img.status === 200) {
				bot.sendImageMessage(img.data, msg);
			} else {
				msg.reply("摸了");
			}
		}
	}]
}

module.exports = moyu;