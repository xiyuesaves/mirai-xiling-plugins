// 复读判断模块
let previousMessage = {}, // 上一条消息
    ignorant = {}, //  冷却期消息
    lastMsgId = 0,
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
    for (var i = 0; i < ignorant[groupId].length; i++) {
        if (ignorant[groupId][i].msg === replaceText) {
            return true;
        }
    }
    return false;
}

// 清除图片中的imageId
function delImageId(messageChain) {
    return messageChain.map((element, index) => {
        delete element.imageId;
        return element;
    })
}

// 不复读含有特定单词的消息
function stopWord(replaceText) {
    let stopArr = ["[QQ红包]", "type: 'App'", "你的QQ暂不支持"]
    stopArr.forEach((element, index) => {
        if (replaceText.includes(element)) {
            return false;
        }
    })
    return true;
}

const replace = {
    name: "复读机",
    passive: {
        name: "复读机",
        exce: (msg) => {
            let groupId = msg.sender.group.id,
                messageChain = msg.messageChain,
                replaceText = JSON.stringify(messageChain).replace(/{"type":"Source".+?},|"url":".+?,"/g, "");
            if (!ignorant[groupId]) {
                ignorant[groupId] = [];
            }
            // 判断两条消息是否一致
            if (replaceText === previousMessage[groupId] && stopWord(replaceText) && lastMsgId + 1 === messageChain[0].id) {
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