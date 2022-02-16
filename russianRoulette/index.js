let duelList = [],
    endStr = [
        "脑洞大开",
        ""
    ],
    isWroking = false;
const russianRoulette = {
    name: "俄罗斯轮盘",
    command: [{
        name: "决斗",
        exce: (msg) => {
            let senderId = msg.sender.id;
            if (duelList.indexOf(senderId) === -1) {
                if (!isWroking) {
                    duelList.push(senderId);
                    msg.quoteReply([{ type: "Plain", text: `你已加入,当前人数 [${duelList.length}]` }], msg);
                } else {
                    msg.quoteReply([{ type: "Plain", text: `当前进行中,无法加入` }], msg);
                }
            } else {
                msg.quoteReply([{ type: "Plain", text: `已经在名单中` }], msg);
            }
        }
    }, {
        name: "开始",
        exce: (msg, parameter) => {
            let senderId = msg.sender.id,
                userNumber = duelList.length,
                stopTime = parameter[0] || 1,
                killNum = parameter[1] || 1;
            if (duelList.indexOf(senderId) !== -1) {
                if (!isWroking) {
                    isWroking = true;
                    let selectUser = [];
                    for (var i = 0; i < killNum; i++) {
                        if (duelList.length) {
                            let random = Math.floor(Math.random() * duelList.length);
                            selectUser.push(duelList.splice(random, 1)[0]);
                        } else {
                            break;
                        }
                    }
                    msg.reply([{ type: "Plain", text: `规则\n从${userNumber}人中,抽取${killNum}个幸运儿,奖励口球${stopTime}分钟` }], msg);
                    duelList = [];
                    setTimeout(function() {
                        selectUser.forEach(item => {
                            let plain = endStr[Math.floor(Math.random() * endStr.length)];
                            msg.reply([{ type: "Plain", text: `Boom！` }, { type: 'At', target: item, display: '' }, { type: "Plain", text: ` ${plain}` }], msg);
                        })
                        isWroking = false;
                    }, 3000)
                }
            } else if (!duelList.length) {
                msg.quoteReply([{ type: "Plain", text: `#开始\n口球时间\n中奖人数` }], msg);
            } else {
                msg.quoteReply([{ type: "Plain", text: `你没有加入,无法开始` }], msg);
            }
        }
    }]
}

module.exports = russianRoulette;