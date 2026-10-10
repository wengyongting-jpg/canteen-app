// 入口：Express 静态托管 + JSON API，监听 0.0.0.0:3000
require('./src/env');
const express = require('express');
const path = require('path');
const { getDb } = require('./src/db');
const { setReviewMap } = require('./src/services/validator');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 校验服务依赖的评价索引（启动时与写入后刷新）
setReviewMap(getDb());

const { router: recommendRouter } = require('./routes/recommend');
const reviewsRouter = require('./routes/reviews');
const summaryRouter = require('./routes/summary');
const dishesRouter = require('./routes/dishes');
const homeRouter = require('./routes/home');
const miscRouter = require('./routes/misc');
const adminRouter = require('./routes/admin');

app.use('/api', recommendRouter);
app.use('/api', reviewsRouter);
app.use('/api', summaryRouter);
app.use('/api', dishesRouter);
app.use('/api', homeRouter);
app.use('/api', miscRouter);
app.use('/api', adminRouter);

// 评价写入后刷新校验索引（保证新评价可被 LLM 引用校验）
app.use('/api', (req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = data => {
    if (req.method === 'POST' && /\/reviews$/.test(req.path) && res.statusCode === 201) {
      setReviewMap(getDb());
    }
    return origJson(data);
  };
  next();
});

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[error]', err && err.message);
  res.status(500).json({ error: '服务器内部错误，请稍后再试' });
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`校园食堂点评推荐已启动: http://${HOST}:${PORT}`);
});
