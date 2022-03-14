const axios = require("axios");
const holidays = {
	name: "最近假期",
	command: {
		name: "最近假期",
		exce: async (msg) => {
			let req = await axios.get("http://timor.tech/api/holiday/tts");
			if(req.data.tts){
				msg.reply([{ type: "Plain", text: req.data.tts }], msg);
			} else {
				msg.reply([{ type: "Plain", text: "接口无响应" }], msg);
			}
		}
	}
}
module.exports = holidays;