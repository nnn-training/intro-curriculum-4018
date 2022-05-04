'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');

describe('/login', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
   });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('ログインのためのリンクが含まれる', () => {
    return request(app)
      .get('/login')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(/<a href="\/auth\/github"/)
      .expect(200);
  });

  test('ログイン時はユーザー名が表示される', () => {
    return request(app)
      .get('/login')
      .expect(/testuser/)
      .expect(200);
  });
});

describe('/logout', () => {
  test('/ にリダイレクトされる', () => {
    return request(app)
      .get('/logout')
      .expect('Location', '/')
      .expect(302);
  });
});

describe('/schedules', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('予定が作成でき、表示される', async (done) => {
    await User.upsert({ userId: 0, username: 'testuser' });
    request(app)
      .post('/schedules')
      .send({
        scheduleName: 'テスト予定1',
        memo: 'テストメモ1\r\nテストメモ2',
        candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3'
      })
      .expect('Location', /schedules/)
      .expect(302)
      .end(async (err, res) => {
        const createdSchedulePath = res.headers.location;
        request(app)
          .get(createdSchedulePath)
          .expect(/テスト予定1/)
          .expect(/テストメモ1/)
          .expect(/テストメモ2/)
          .expect(/テスト候補1/)
          .expect(/テスト候補2/)
          .expect(/テスト候補3/)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            // テストで作成したデータを削除
            const scheduleId = createdSchedulePath.split('/schedules/')[1];
            const candidates = await Candidate.findAll({
              where: { scheduleId: scheduleId }
            });
            const promises = candidates.map(c => {
              return c.destroy();
            });
            await Promise.all(promises)
            const s = await Schedule.findByPk(scheduleId)
            await s.destroy()
            if (err) return done(err);
            done();
          });
      });
  });
});