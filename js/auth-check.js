// 認証チェック用の共通スクリプト
(function() {
    // 認証が不要なページのリスト
    const publicPages = [
        'index.html',
        'admin-login.html',
        '', // ルートパス
        '/'
    ];
    
    // 現在のページのファイル名を取得
    const currentPage = window.location.pathname.split('/').pop();
    
    // 公開ページの場合は認証チェックをスキップ
    if (publicPages.includes(currentPage)) {
        return;
    }
    
    // 認証チェック
    const isAuthenticated = sessionStorage.getItem('adminAuthenticated');
    const authTime = sessionStorage.getItem('authTime');
    
    // 認証がない、または1時間以上経過している場合はリダイレクト
    if (!isAuthenticated || !authTime || (Date.now() - parseInt(authTime) > 3600000)) {
        // 現在のURLを保存（ログイン後にリダイレクトするため）
        sessionStorage.setItem('redirectUrl', window.location.href);
        window.location.href = 'admin-login.html';
    }
})();