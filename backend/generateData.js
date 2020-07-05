const fs = require('fs');
const fileName = './assets/file_1.csv';

const writeLine = (line) => {
    return new Promise(resolve => {
        fs.writeFile(fileName, line, { flag: 'a', encoding: 'utf8' }, () => { return resolve(); });
    });
}

(async () => {
    await writeLine('name,email,number,tags\n');
})();

const randomString = (length, type) => {
    let result           = '';
    let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ';
    if(type === 'numbers'){
        characters = '0123456789';
    }
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

for(let i=0; i<190000; i++){
    const name = randomString(6);
    const email = name.replace(/ /ig, '').toLowerCase() + '@gmail.com';
    const fixedTags = ['it', 'sales', 'marketing', 'operations'];
    if(i % 1000 === 0){
        console.log(`Generated ${i} records`);
    }
    const tags = [];
    for(let i=0; i < Math.floor(Math.random() * 4 + 1); i++){
        tags.push(fixedTags[i]);
    }
    let record = `${name},${email},${randomString(10, 'numbers')},"${tags.join(',')}"\n`;
    (async () => {
        await writeLine(record);
    })();
};
