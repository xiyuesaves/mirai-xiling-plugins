const nodejieba = require("nodejieba");
process.on('message', (msg) => {
    console.log('子进程接收到数据', msg);
    let result = [];
    msg.forEach(data => {
		    nodejieba.extract(data.plain, 5).forEach(json => {
		        result.push(json.word);
		    })
		})
    process.send(result);
    process.exit();
});