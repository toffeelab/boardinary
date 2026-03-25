export function magicLinkEmailHtml(url: string) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boardinary 로그인</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#0c0a1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background-color:#1e1b3a;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#a78bfa;">Boardinary</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#a1a1c7;">게임 기획자 스토리보드 협업 툴</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#e2e8f0;text-align:center;">
                로그인 링크가 도착했습니다
              </h2>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1c7;text-align:center;">
                아래 버튼을 클릭하면 Boardinary에 로그인됩니다.<br>
                이 링크는 <strong style="color:#e2e8f0;">24시간</strong> 동안 유효하며, 한 번만 사용할 수 있습니다.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#8b5cf6;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">
                      로그인하기
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #2e2854;margin:0 0 20px;">

              <!-- Alternative: Copy Link -->
              <p style="margin:0 0 8px;font-size:12px;color:#a1a1c7;text-align:center;">
                버튼이 작동하지 않으면 아래 링크를 복사해서 브라우저에 붙여넣으세요.
              </p>
              <p style="margin:0 0 20px;font-size:11px;color:#8b5cf6;text-align:center;word-break:break-all;">
                ${url}
              </p>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color:#0c0a1a;border-radius:8px;padding:16px;">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1c7;">
                      <strong style="color:#e2e8f0;">다른 기기에서 로그인하고 싶으신가요?</strong><br>
                      이 이메일의 링크를 원하는 기기의 브라우저에서 열면 됩니다. PC, 태블릿, 모바일 어디서든 사용 가능합니다.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#6b7280;">
                이 메일을 요청한 적이 없다면 무시해주세요.<br>
                &copy; 2026 Boardinary. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function magicLinkEmailText(url: string) {
  return `Boardinary 로그인\n\n아래 링크를 클릭하면 Boardinary에 로그인됩니다:\n${url}\n\n이 링크는 24시간 동안 유효하며, 한 번만 사용할 수 있습니다.\n다른 기기에서도 이 링크를 열 수 있습니다.\n\n이 메일을 요청한 적이 없다면 무시해주세요.`;
}
