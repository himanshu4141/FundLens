import {
  extractGmailVerificationUrl,
  getSenderEmail,
  isGmailForwardingVerification,
} from '../gmail-verification';

describe('getSenderEmail', () => {
  it('returns empty string when from is missing', () => {
    expect(getSenderEmail(undefined)).toBe('');
  });

  it('returns the raw string when from is a string', () => {
    expect(getSenderEmail('forwarding-noreply@google.com')).toBe(
      'forwarding-noreply@google.com',
    );
  });

  it('returns email field when from is an object', () => {
    expect(
      getSenderEmail({ email: 'forwarding-noreply@google.com', name: 'Gmail Team' }),
    ).toBe('forwarding-noreply@google.com');
  });

  it('returns empty when object has no email field', () => {
    expect(getSenderEmail({ name: 'Mystery' })).toBe('');
  });
});

describe('isGmailForwardingVerification', () => {
  it('matches the canonical Gmail forwarding confirmation envelope', () => {
    expect(
      isGmailForwardingVerification({
        from: 'forwarding-noreply@google.com',
        subject: 'Gmail Forwarding Confirmation - Receive Mail from <user>@gmail.com',
      }),
    ).toBe(true);
  });

  it('matches when from is provided as an object', () => {
    expect(
      isGmailForwardingVerification({
        from: { email: 'forwarding-noreply@google.com', name: 'Gmail Team' },
        subject: 'Gmail Forwarding Confirmation - Code 123456789',
      }),
    ).toBe(true);
  });

  it('is case-insensitive on subject and sender', () => {
    expect(
      isGmailForwardingVerification({
        from: 'Forwarding-NoReply@google.com',
        subject: 'gmail forwarding confirmation',
      }),
    ).toBe(true);
  });

  it('rejects messages from a different sender', () => {
    expect(
      isGmailForwardingVerification({
        from: 'support@google.com',
        subject: 'Gmail Forwarding Confirmation',
      }),
    ).toBe(false);
  });

  it('rejects messages with the wrong subject', () => {
    expect(
      isGmailForwardingVerification({
        from: 'forwarding-noreply@google.com',
        subject: 'Security alert',
      }),
    ).toBe(false);
  });

  it('rejects when subject is missing', () => {
    expect(
      isGmailForwardingVerification({
        from: 'forwarding-noreply@google.com',
      }),
    ).toBe(false);
  });

  it('rejects when from is missing', () => {
    expect(
      isGmailForwardingVerification({
        subject: 'Gmail Forwarding Confirmation',
      }),
    ).toBe(false);
  });

  it('rejects when from looks like a spoof attempt with extra prefix', () => {
    expect(
      isGmailForwardingVerification({
        from: 'malicious-forwarding-noreply@google.com.attacker.example',
        subject: 'Gmail Forwarding Confirmation',
      }),
    ).toBe(false);
  });

  it('accepts display-name from headers', () => {
    expect(
      isGmailForwardingVerification({
        from: 'Gmail Team <forwarding-noreply@google.com>',
        subject: 'Gmail Forwarding Confirmation',
      }),
    ).toBe(true);
  });
});

describe('extractGmailVerificationUrl', () => {
  it('extracts the confirmation URL from text body', () => {
    const text = `
      Please click the link below to confirm.

      https://mail.google.com/mail/vf-AbCdEfGhIj_kLmNoP-1234

      Or enter this code: 098765432
    `;
    expect(extractGmailVerificationUrl({ text })).toBe(
      'https://mail.google.com/mail/vf-AbCdEfGhIj_kLmNoP-1234',
    );
  });

  it('extracts from html body when text is empty', () => {
    const html =
      '<p>Click <a href="https://mail.google.com/mail/vf-XYZ123abc">here</a> to confirm.</p>';
    expect(extractGmailVerificationUrl({ html })).toBe(
      'https://mail.google.com/mail/vf-XYZ123abc',
    );
  });

  it('extracts modern mail-settings confirmation URLs', () => {
    const text = `
      To confirm the request:
      https://mail-settings.google.com/mail/vf-%5BANGjdJ9NKlq190gVI6lLYoRFjus-S7V9p6wScSEAkZ0t3iRXQrTU-_SwFGI_1tqns_0cOGiIrH2gj0y9Cd1A1SOiwK4V6iJ9JO0UV4f5PQ%5D-gLvzgFQ6gT0exN-DLtmE4tG2LEc
    `;
    expect(extractGmailVerificationUrl({ text })).toBe(
      'https://mail-settings.google.com/mail/vf-%5BANGjdJ9NKlq190gVI6lLYoRFjus-S7V9p6wScSEAkZ0t3iRXQrTU-_SwFGI_1tqns_0cOGiIrH2gj0y9Cd1A1SOiwK4V6iJ9JO0UV4f5PQ%5D-gLvzgFQ6gT0exN-DLtmE4tG2LEc',
    );
  });

  it('extracts isolated Gmail confirmation URLs', () => {
    const text =
      'Confirm: https://isolated.mail.google.com/mail/vf-ab60dcb83a-user%40example.com-6QUCffRlVn2aE8qYep3SBoPfUJc';
    expect(extractGmailVerificationUrl({ text })).toBe(
      'https://isolated.mail.google.com/mail/vf-ab60dcb83a-user%40example.com-6QUCffRlVn2aE8qYep3SBoPfUJc',
    );
  });

  it('keeps query params and unescapes HTML ampersands', () => {
    const html =
      '<a href="https://mail.google.com/mail/vf-XYZ123abc?c=1&amp;v=2">confirm</a>';
    expect(extractGmailVerificationUrl({ html })).toBe(
      'https://mail.google.com/mail/vf-XYZ123abc?c=1&v=2',
    );
  });

  it('returns null when neither body contains the URL', () => {
    expect(
      extractGmailVerificationUrl({
        text: 'This is some unrelated email body.',
        html: '<p>No URL here.</p>',
      }),
    ).toBeNull();
  });

  it('returns null when both text and html are absent', () => {
    expect(extractGmailVerificationUrl({})).toBeNull();
  });

  it('returns the first matching URL when multiple appear', () => {
    const text =
      'First link: https://mail.google.com/mail/vf-AAAA111\nSecond: https://mail.google.com/mail/vf-BBBB222';
    expect(extractGmailVerificationUrl({ text })).toBe(
      'https://mail.google.com/mail/vf-AAAA111',
    );
  });

  it('does not extract a URL that does not match the vf- pattern', () => {
    expect(
      extractGmailVerificationUrl({
        text: 'https://mail.google.com/mail/u/0/#inbox',
      }),
    ).toBeNull();
  });
});
