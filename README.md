# 通用需求單工具｜連接自己的 Google 試算表

Independent, ad-free browser tool by [Upliftorch](https://upliftorch.com/).

[線上使用 / Official demo](https://upliftorch.com/tools/requirements/) · [更多免費工具 / Free tools](https://upliftorch.com/tools)

## 功能與執行 / Usage

核心功能在瀏覽器執行；資料查詢、地圖、字型或第三方函式庫可能仍需網路。

The browser frontend may require network access for public data, map tiles, fonts or third-party libraries.

使用任何靜態 HTTP server 提供此資料夾，例如：

```sh
npx --yes http-server . -p 8080 -c-1
```

Open `http://localhost:8080/`. Files are not sample customer uploads. This repository contains only the selected tool frontend and required local assets.

### Google integration

Use your own Google Cloud project and allowed origins. Never commit credentials, access tokens or spreadsheet records.

複製 `config.example.js` 為 `config.js`，填入自己的 OAuth Client ID、受來源限制的 Picker API Key 與 Google Cloud project number。啟用 Google Sheets、Drive 與 Picker API；OAuth scope 是 `drive.file`，試算表由使用者自行選擇。設定允許的 JavaScript origin，使用測試使用者或完成 Google 所需的 OAuth 驗證。`config.js` 不會提交至 Git。

所有客戶與需求資料由使用者保存在自己的 Google 試算表；本專案不附任何客戶資料、範例試算表連結或公司憑證。

## Privacy / 隱私

- Removed advertising loaders, placements, ad account identifiers and tracking scripts.
- No personal identity, customer records, environment files, deployment credentials, account tokens or original Git history are included.
- Do not commit user-entered files, passwords, spreadsheet contents or credentials.
- External libraries, data providers and configured APIs can receive requests; local processing does not mean zero network activity.
- Public datasets are not bundled. Any existing public data-feed URLs remain dependencies, not a promise of continued availability or a license to redistribute the data.

## License

Upliftorch-authored source is MIT licensed; see [LICENSE](LICENSE). Third-party libraries, map tiles, data and optional media retain their upstream terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The MIT license does not grant trademark rights or override third-party licenses.

## About Upliftorch

[Upliftorch 官網](https://upliftorch.com/) — tools and software development. The links above identify the original creator and official demo; they are not a search-ranking guarantee.
