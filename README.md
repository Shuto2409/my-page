# My Dashboard

予定・タスク管理、日記、メモ、課題(ガントチャート付き)、仕事の分析ページをまとめた個人用ダッシュボードです。React + Vite製で、GitHub Pagesで無料公開できます。

## 公開までの手順(GitHub Pages)

### 1. GitHubにリポジトリを作る
1. https://github.com にログイン(アカウントがなければ新規登録)
2. 右上の「+」→「New repository」
3. リポジトリ名を決める(例: `personal-dashboard-app`)。**Public** を選択して「Create repository」

### 2. このフォルダの中身をアップロードする
一番簡単なのはブラウザからのアップロードです。

1. 作成したリポジトリのページで「uploading an existing file」をクリック
2. このフォルダの中身(`src`フォルダや`package.json`など)をすべてドラッグ&ドロップ
   - `node_modules`フォルダと`dist`フォルダは含めなくてOKです(自動生成されるため)
3. 「Commit changes」で保存

Gitコマンドに慣れている場合はターミナルから:
```bash
cd personal-dashboard-app
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/【あなたのユーザー名】/【リポジトリ名】.git
git push -u origin main
```

### 3. リポジトリ名を`vite.config.js`に反映する
このzipでは、すでにリポジトリ名 `my-page` に合わせて
```js
base: "/my-page/",
```
に設定済みです。もし別のリポジトリ名でアップロードする場合は、ここをそのリポジトリ名に書き換えてください(前後の`/`は残す)。

### 4. GitHub Pagesを有効にする
1. リポジトリの「Settings」タブを開く
2. 左メニューの「Pages」を選択
3. 「Build and deployment」の「Source」で **GitHub Actions** を選択

これだけで完了です。リポジトリに`main`ブランチへの変更がpushされるたびに、
`.github/workflows/deploy.yml` が自動でビルド・公開してくれます。

初回のpush後、リポジトリの「Actions」タブでビルドが進む様子を確認できます。
緑のチェックが付いたら、`https://【ユーザー名】.github.io/【リポジトリ名】/` でアクセスできます。

## データの保存について
このアプリのデータ(タスク・日記・メモ・課題)はブラウザの localStorage に保存されます。
同じブラウザ・同じ端末でアクセスすれば内容は残りますが、別の端末やブラウザからは見えません。
複数端末で同期したい場合は、別途データベース(Supabase、Firebaseなど)への接続が必要です。

## ローカルで試す場合
```bash
npm install
npm run dev
```
