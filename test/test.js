'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
//予定が作成でき、表示されるテストの実装するため、以下のモジュールの読み込み
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
//以下追記
describe('/schedules', () => {
  //testの前にpassportStabをインストールしてtestuserでログインしたことにする
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });
  //testが終わったら、ログアウトしてアンインストールする
  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  test('予定が作成でき、表示される', done => {
    //上で設定したユーザIDと名前で、
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        //POSTで /schedules にアクセスし、以下のオブジェクトを渡した時に、Locationヘッダのリダイレクト先に schedules が含まれ、302(リダイレクト)が返るか確認
        .post('/schedules')
        .send({
          scheduleName: 'テスト予定1',
          memo: 'テストメモ1\r\nテストメモ2',
          candidates: 'テスト候補日1\r\nテスト候補日2\r\nテスト候補日3'
        })
        .expect('Location', /schedules/)
        .expect(302)
        //レスポンス後、リダイレクト先のパスにGETでアクセスが来た時に、上で設定した予定とメモと候補日の表示がされるかどうかテスト
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          request(app)
            .get(createdSchedulePath)
            .expect(/テスト予定1/)
            .expect(/テストメモ1/)
            .expect(/テストメモ2/)
            .expect(/テスト候補日1/)
            .expect(/テスト候補日2/)
            .expect(/テスト候補日3/)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err);
              //パスからscheduleIdを取り出し、candidateデータモデルからそのIDに関連する候補日を全て抽出し、削除
              const scheduleId = createdSchedulePath.split('/schedules/')[1];
              Candidate.findAll({
                where: { scheduleId }
              }).then(candidates => {
                const promises = candidates.map(c => {
                  return c.destroy();
                });
                //上で定義したpromisesが全て終了したら(削除が完了したら)、
                Promise.all(promises).then(() => {
                  //scheduleデータモデルから主キーであるscheduleIdで該当する行を取り出して削除
                  Schedule.findByPk(scheduleId).then(s => {
                    s.destroy().then(() => {
                      if (err) return done(err);
                      done();
                    });
                  });
                });
              });
            });
        });
    });
  });
});