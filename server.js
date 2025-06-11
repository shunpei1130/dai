// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// クライアントファイルを静的配信
// 元のコードでは 'public' ディレクトリを参照していましたが、このリポジトリでは
// index.html がルートに置かれているため、ルートを配信するようにします。
app.use(express.static(__dirname));

io.on('connection', (socket) => {
  console.log('ユーザー接続: ' + socket.id);

  // クライアントからゲームイベントを受け取る例
  socket.on('gameEvent', (data) => {
    // 同じルーム内の他のユーザーにイベントを送信
    socket.broadcast.emit('gameEvent', data);
  });

  socket.on('disconnect', () => {
    console.log('ユーザー切断: ' + socket.id);
  });
});

// サーバーをポート3000で起動
http.listen(3000, () => {
  console.log('サーバーがポート3000で起動中');
});
