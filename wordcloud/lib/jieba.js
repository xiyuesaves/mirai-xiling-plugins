const nodejieba = require("nodejieba");
process.on('message', (msg) => {
     let result = [];
    msg.forEach(data => {
		    nodejieba.extract(data.plain, 5).forEach(json => {
		        result.push(json.word);
		    })
		})
    process.send(result);
});