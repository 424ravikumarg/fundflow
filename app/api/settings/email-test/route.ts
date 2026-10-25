import { NextResponse } from 'next/server';
import { sendEmail, isEmailConfigured, getEmailProviderInfo } from '@/lib/email';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  const providerInfo = getEmailProviderInfo();
  return NextResponse.json({
    emailConfigured: isEmailConfigured(),
    provider: providerInfo,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const authUser = await getSessionUser(request);
    const targetEmail = body.testEmail || authUser?.email || 'ravikumar.g@outlook.com';

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid destination email.' }, { status: 400 });
    }

    const providerInfo = getEmailProviderInfo();

    if (!isEmailConfigured()) {
      return NextResponse.json({
        success: false,
        delivered: false,
        configured: false,
        error: 'No SMTP or email provider (Resend/SendGrid) configured in environment variables.',
        provider: providerInfo,
      });
    }

    const testResult = await sendEmail({
      to: targetEmail,
      subject: 'Fundflow Security — Email Dispatch Test',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111827; max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #ECEEF1;">
          <div style="display: inline-block; width: 40px; height: 40px; line-height: 40px; background: #6558D3; color: #ffffff; border-radius: 10px; font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 16px;">F</div>
          <h2 style="color: #111827; margin: 0 0 8px 0;">Email Configuration Successful!</h2>
          <p style="font-size: 13px; color: #4B5563; line-height: 1.5;">This confirms that your Fundflow email dispatcher is properly configured and communicating with your mail server (${providerInfo.provider}).</p>
          <div style="background: #F4F3FC; border: 1px solid #E4E1F9; border-radius: 12px; padding: 12px; margin: 16px 0; font-size: 12px; color: #6558D3;">
            <strong>✓ Status:</strong> Active & Ready for 2FA / OTP verification codes.
          </div>
          <p style="font-size: 11px; color: #9CA3AF; margin-top: 24px;">Fundflow — Smart Cash Flow & Financial Intelligence</p>
        </div>
      `,
      text: 'Fundflow Email Dispatch Test: Your email configuration is working properly!',
    });

    if (!testResult.delivered) {
      return NextResponse.json({
        success: false,
        delivered: false,
        error: testResult.error || 'Mail server rejected the message.',
        provider: providerInfo,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      delivered: true,
      message: `Test email successfully dispatched to ${targetEmail} via ${providerInfo.provider}!`,
      provider: providerInfo,
    });
  } catch (err: any) {
    console.error('Email test route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error testing email' }, { status: 500 });
  }
}
