const express = require('express');
const app = express();

// 静的ファイルをpublicディレクトリから配信
app.use(express.static('public'));

app.listen(3000, () => {
  console.log('サーバーがポート3000で起動中');
});
