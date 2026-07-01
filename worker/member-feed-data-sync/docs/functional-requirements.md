# 目的 (Purpose)

会員フィードをGCSから取得しチャットの追加項目に表示する

# 基本機能 (Basic functionality)

- カラム名の連携
    - Liglaからカラムの情報を取得する
- カラム表示設定
    - トークウィンドウでどのカラムを表示するかを設定する
- 会員フィードデータ更新
    - gcsから会員フィードをアップデートする
- 会員フィード表示

# 実装方針 (Implement policy)

- カラム名の連携
    - Liglaからgcsにカラムのデータを書き込むときチャットシステムがデータをアップデートする
    - Liglaから次のgcsバケツにcsvデータでカラムの情報を書き込む
        - gcsのバケツ名：`ligla-chat-data-[stg/prd]`
        - パス：organization_name/settings/
        - ファイル名： [organization_name]-client_users-[yyyymmdd]_[hhmmssfff].csv
    - csvデータの例：

        ```markdown
        category_1,category_2,category_3,category_4,category_5,category_6,category_7,category_8,category_9,category_10,category_11,category_12,category_13,category_14,category_15,number_1,number_2,number_3,number_4,number_5,number_6,number_7,number_8,number_9,number_10,number_11,number_12,number_13,number_14,number_15,datetime_1,datetime_2,datetime_3,datetime_4,datetime_5,datetime_6,datetime_7,datetime_8,datetime_9,datetime_10,datetime_11,datetime_12,datetime_13,datetime_14,datetime_15
        c_name_1,c_address,,c_email,c_phone,,c_status,c_type,,c_region,c_code,,c_group,c_alias,c_label,n_id,,n_score,n_rank,,n_level,n_value,,n_index,n_ref,,n_count,n_total,,n_flag,dt_created,,dt_updated,dt_deleted,,dt_verified,dt_synced,,dt_imported,dt_exported,,dt_checked,dt_archived,,dt_flagged
        ```

- カラム表示設定
    - 管理画面からトークウィンドウで表示する項目の設定をする
    - 会員フィード管理ページ追加される
    - 会員フィード管理ページでは次の情報を表示する
        - チェックボックス
        - デフォルトカラム名
        - カラム名
    - デフォルトは全てがチェックされていない状態になる
    - 復元、保存ボタン
        - 復元ボタンでデータをレストアする
        - 保存ボタンで設定を保存する
- 会員フィード取得
    - [[WIP] 会員フィード連携：データ更新](https://www.notion.so/WIP-24c46cd1a4b88096a30ce9108e10aa8c?pvs=21)
    - Liglaが会員フィードをgcsに書き込んだあとcloud runがトリガーで実行しcloud sqlのデータをアップデートする
    - gcsのバケツ：
        - ligla_chat_data_[prd/stg]
            - ファイルがデフォルト30日で削除される設定であること
    - パス：
        - organization_name/client_users/
    - ファイル名
        - [organization_name]-client_user_data-[yyyymmdd]_[hhmmssfff].gzip
- 会員フィード表示
    - トークウィンドウで追加項目として表示する
    - 設定画面でカラムのチェックをしていないとき表示しない
        - デフォルト設定では表示しない
    - 追加項目の表示順番としてはノートの下に表示する

# 確認事項（Criteria for Success）

- トークウィンドウで正しく表示する
- 設定されていないとき非表示されていること

[[WIP] 会員フィード連携：データ更新](https://www.notion.so/WIP-24c46cd1a4b88096a30ce9108e10aa8c?pvs=21)
