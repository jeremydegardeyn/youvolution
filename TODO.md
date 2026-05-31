# YOUvolution TODOs

## Before Going Live

- [ ] **Enable email confirmation** in Supabase → Authentication → Settings → turn on "Enable email confirmations"
- [ ] **Configure custom SMTP** in Supabase → Authentication → SMTP Settings — use your own email provider (SendGrid, Resend, Postmark) so confirmation emails come from @youvolution.app instead of Supabase's default
- [ ] **Set up Google auth** — create OAuth credentials at console.cloud.google.com, add `https://vqugparylfrrfhmajszr.supabase.co/auth/v1/callback` as authorized redirect URI, paste Client ID + Secret into Supabase → Authentication → Providers → Google

## V2 Features
- [ ] Photo meal logging with AI vision
- [ ] Push notifications (daily plan reminder)
- [ ] Goal timeline / GPS-style progress view
- [ ] Accountability circles (small groups)
- [ ] Apple Developer account + App Store submission
