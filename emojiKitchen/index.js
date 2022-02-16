// emoji 转utf-8编码
// 来自 https://github.com/kekobin/blog/issues/69
function utf16toEntities(str) {
    const patt = /[\ud800-\udbff][\udc00-\udfff]/g; // 检测utf16字符正则
    str = str.replace(patt, (char) => {
        let H;
        let L;
        let code;
        let s;
        if (char.length === 2) {
            H = char.charCodeAt(0); // 取出高位
            L = char.charCodeAt(1); // 取出低位
            code = (H - 0xD800) * 0x400 + 0x10000 + L - 0xDC00; // 转换算法
            s = code.toString(16);
        } else {
            s = char;
        }
        return s;
    });
    return str;
}

// emojiData.json数组来自https://github.com/xsalazar/emoji-kitchen/
const emojiData = require("./lib/emojiData.json");

// 选择插件
const choose = {
    name: "emoji合成",
    command: {
        name: "emoji",
        exce: (msg, parameter) => {
            let plain = msg.plain;
            let strArr = [];
            if (parameter.length !== 1 || parameter[0].length !== 4) {
                msg.reply([{ type: "Plain", text: "#emoji\n😀😀" }], msg);
                return false;
            }
            let leftEmoji = utf16toEntities(parameter[0].substr(0, 2)),
                rightEmoji = utf16toEntities(parameter[0].substr(2, 2));
            for (const left in emojiData) {
                if (left === leftEmoji) {
                    for (const synthesis of emojiData[left]) {
                        if (synthesis.leftEmoji === leftEmoji && synthesis.rightEmoji === rightEmoji) {
                            let date = synthesis.date;
                            msg.reply([{
                                type: 'Image',
                                imageId: null,
                                url: `https://www.gstatic.com/android/keyboard/emojikitchen/${date}/u${leftEmoji}/u${leftEmoji}_u${rightEmoji}.png`,
                                path: null,
                                base64: null
                            }], msg)
                            return false;
                        }
                    }
                }
            }
            msg.reply([{
                type: 'Image',
                imageId: null,
                url: `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u1f600/u1f600_u1f422.png`,
                path: null,
                base64: null
            }], msg)
            return false;
        }
    }
}

module.exports = choose