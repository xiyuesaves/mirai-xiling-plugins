const axios = require("axios");
const fs = require("fs");

function url_encode(url) {
    url = encodeURIComponent(url);
    url = url.replace(/\%3A/g, ":");
    url = url.replace(/\%2F/g, "/");
    url = url.replace(/\%3F/g, "?");
    url = url.replace(/\%3D/g, "=");
    url = url.replace(/\%26/g, "&");
    return url;
}

let sageTime = 0.5 * 60 * 1000, // 贤者时间
    lastTime = 0; // 上次调用时间

// 选择插件
const textToSpeech = {
    name: "文本转语音",
    command: {
        name: "说",
        exce: async (msg, parameter) => {
            if (parameter.length !== 1) {
                msg.reply([{ type: "Plain", text: "#说\n文本内容" }], msg);
                return false;
            }
            let thisTime = new Date().getTime();
            if (thisTime - lastTime > sageTime) {
                lastTime = thisTime;
                let recode = url_encode(parameter[0])
                let sound = await axios.get(`http://tts.youdao.com/fanyivoice?word=${recode}&le=zh&keyfrom=speaker-target`, { responseType: 'arraybuffer' })
                let audio = {
                    type: 'Voice',
                    voiceId: null,
                    url: null,
                    path: null,
                    base64: sound.data.toString("base64")
                }
                msg.reply([audio], msg);
            } else {
                msg.reply([{ type: 'Plain', text: `冷却[${Math.floor((sageTime - (thisTime - lastTime)) / 1000)}s]` }], msg);
            }
        }
    }
}

module.exports = textToSpeech